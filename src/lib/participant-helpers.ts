import crypto from 'crypto';
import { NextRequest } from 'next/server';
import { executeQuery } from '@/lib/db';
import logger from '@/lib/logger';
import { looksLikeSebUserAgent, verifySebAccessToken, verifySebHashes } from '@/lib/seb-access';
import { normalizeDbDateToIso } from '@/lib/timezone';
import type { ModuleItem, Session, SessionParticipant } from '@/types';

/**
 * Shared helpers for participant API routes.
 * Eliminates duplicated enrollment verification, session timing checks,
 * and SEB validation logic across 6+ route handlers.
 */

/** Verify that a user is enrolled in a specific session. Throws on failure. */
export async function verifyEnrollment(
    sessionId: string,
    userId: string
): Promise<SessionParticipant> {
    const rows = await executeQuery<SessionParticipant[]>(
        `SELECT id, session_id, user_id FROM session_participants WHERE session_id = ? AND user_id = ?`,
        [sessionId, userId]
    );

    if (!rows || rows.length === 0) {
        throw new ParticipantError('Anda tidak terdaftar pada sesi ini', 403);
    }

    return rows[0];
}

/** Session timing status. */
export interface SessionTimingResult {
    session: Session;
    isUpcoming: boolean;
    isActive: boolean;
    isEnded: boolean;
    effectiveEndTime: Date;
    serverTime: string;
}

/** Validate that a session exists and return its timing status. Optionally takes userId to check individual extension. */
export async function validateSessionTiming(
    sessionId: string,
    userId?: string
): Promise<SessionTimingResult> {
    const rows = await executeQuery<(Session & { is_upcoming_db?: number; is_ended_db?: number })[]>(
        `SELECT s.id, s.module_id, s.title, s.start_time, s.end_time, s.require_seb, s.show_score, s.enable_proctoring, s.seb_config_key, s.created_at,
                COALESCE(m.enforce_sequence, 0) AS enforce_sequence,
                (NOW() < s.start_time) AS is_upcoming_db,
                (NOW() > s.end_time) AS is_ended_db
         FROM sessions s
         LEFT JOIN modules m ON s.module_id = m.id
         WHERE s.id = ?`,
        [sessionId]
    );

    if (!rows || rows.length === 0) {
        throw new ParticipantError('Sesi tidak ditemukan', 404);
    }

    const session = {
        ...rows[0],
        enforce_sequence: Boolean(rows[0].enforce_sequence),
    };
    const now = new Date();
    const startIso = normalizeDbDateToIso(session.start_time);
    const endIso = normalizeDbDateToIso(session.end_time);
    const start = new Date(startIso);
    let end = new Date(endIso);

    let hasActiveExtension = false;

    if (userId) {
        const extRows = await executeQuery<{ individual_extension_until: Date | string | null; has_active_extension: number }[]>(
            `SELECT MAX(individual_extension_until) AS individual_extension_until,
                    COALESCE(MAX(UTC_TIMESTAMP() <= individual_extension_until), 0) AS has_active_extension
             FROM user_progress
             WHERE user_id = ? AND session_id = ?`,
            [userId, sessionId]
        );
        const extTime = extRows?.[0]?.individual_extension_until;
        hasActiveExtension = Boolean(extRows?.[0]?.has_active_extension);

        if (extTime) {
            const rawStr = String(extTime);
            const isoUtc = rawStr.endsWith('Z') ? rawStr : `${rawStr.replace(' ', 'T')}Z`;
            const extDate = new Date(isoUtc);
            if (!isNaN(extDate.getTime()) && (hasActiveExtension || extDate > end)) {
                end = extDate;
            }
        }
    }

    // Database-level evaluation eliminates OS-level timezone mismatches between Windows & macOS
    const isUpcoming = session.is_upcoming_db !== undefined ? Boolean(session.is_upcoming_db) : now < start;
    const isEnded = session.is_ended_db !== undefined ? (Boolean(session.is_ended_db) && !hasActiveExtension) : now > end;
    const isActive = !isUpcoming && !isEnded;

    return {
        session,
        isUpcoming,
        isActive,
        isEnded,
        effectiveEndTime: end,
        serverTime: new Date().toISOString(),
    };
}

/**
 * Validate a short-lived SEB preflight token or a request-bound Config Key hash.
 * User-Agent is diagnostic only and can never grant exam access.
 */
export async function validateSebAccess(
    request: NextRequest,
    session: Session,
    context: { userId: string; userRole?: string },
): Promise<void> {
    if (!session.require_seb || (context.userRole && context.userRole !== 'trainee')) return;

    const userAgent = request.headers.get('user-agent') || '';
    const accessToken = request.headers.get('x-lms-seb-token');
    const tokenResult = await verifySebAccessToken(accessToken, {
        userId: context.userId,
        sessionId: session.id,
    });
    if (tokenResult.valid) return;

    // Backwards-compatible request-bound validation for SEB versions which inject
    // Config Key headers into fetch/XHR. This path is still fail-closed.
    const hashResult = verifySebHashes(request, session.seb_config_key);
    if (hashResult.valid) return;

    const isSebUserAgent = looksLikeSebUserAgent(userAgent);
    logger.warn('SEB_SECURITY', 'Akses ditolak: preflight atau Config Key SEB tidak valid', {
        hasAccessToken: Boolean(accessToken),
        hasConfigHeader: Boolean(request.headers.get('x-safeexambrowser-configkeyhash')),
        isSebUserAgent,
        userAgent,
        ip: request.headers.get('x-forwarded-for') || 'unknown',
    }, context.userId);

    throw new ParticipantError(
        isSebUserAgent
            ? 'Validasi SEB belum selesai atau sudah kedaluwarsa. Jalankan pemeriksaan ulang dari halaman ujian.'
            : 'Ujian ini hanya dapat diakses melalui Safe Exam Browser (SEB).',
        403,
    );
}

export async function getSessionModuleItem(
    moduleId: string,
    itemType: 'training' | 'exam',
    itemId: string
): Promise<ModuleItem> {
    const rows = await executeQuery<ModuleItem[]>(
        `SELECT id, module_id, item_type, item_id, sequence_order
         FROM module_items
         WHERE module_id = ? AND item_type = ? AND item_id = ?
         LIMIT 1`,
        [moduleId, itemType, itemId]
    );

    if (!rows || rows.length === 0) {
        throw new ParticipantError('Item tidak termasuk dalam sesi ini', 403);
    }

    return rows[0];
}

export async function hasBlockingPreviousItems(
    sessionId: string,
    userId: string,
    moduleId: string,
    sequenceOrder: number
): Promise<boolean> {
    const rows = await executeQuery<{ count: number }[]>(
        `SELECT COUNT(*) AS count
         FROM module_items mi
         LEFT JOIN user_progress up
           ON up.module_item_id = mi.id
          AND up.user_id = ?
          AND up.session_id = ?
          AND up.status = 'completed'
         WHERE mi.module_id = ?
           AND mi.sequence_order < ?
           AND up.id IS NULL`,
        [userId, sessionId, moduleId, sequenceOrder]
    );

    return Number(rows?.[0]?.count || 0) > 0;
}

export async function getItemProgress(
    sessionId: string,
    userId: string,
    moduleItemId: string
): Promise<{ id: string; status: string; score: number | null; attempts_count: number; attempt_version: number; last_attempt_start: string | null; individual_extension_until: string | null } | null> {
    const rows = await executeQuery<{ id: string; status: string; score: number | null; attempts_count: number; attempt_version: number; last_attempt_start: string | null; individual_extension_until: string | null }[]>(
        `SELECT id, status, score, attempts_count, attempt_version, last_attempt_start, individual_extension_until
         FROM user_progress
         WHERE user_id = ? AND session_id = ? AND module_item_id = ?
         LIMIT 1`,
        [userId, sessionId, moduleItemId]
    );

    return rows?.[0] || null;
}

export async function assertCurrentItemAccessible(
    sessionId: string,
    userId: string,
    session: Session,
    moduleItem: ModuleItem,
    allowCompleted = true
): Promise<void> {
    const progress = await getItemProgress(sessionId, userId, moduleItem.id);

    if (allowCompleted && progress?.status === 'completed') {
        return;
    }

    // If module does not enforce sequential progression (enforce_sequence is false/falsy),
    // all items in the active session are freely accessible without prerequisites!
    if (!session.enforce_sequence) {
        return;
    }

    const blocked = await hasBlockingPreviousItems(
        sessionId,
        userId,
        session.module_id,
        moduleItem.sequence_order
    );

    if (blocked) {
        throw new ParticipantError('Selesaikan item sebelumnya terlebih dahulu', 403);
    }
}

/**
 * Custom error class for participant route handlers.
 * Carries an HTTP status code for easy response creation.
 */
export class ParticipantError extends Error {
    constructor(
        message: string,
        public readonly statusCode: number = 400
    ) {
        super(message);
        this.name = 'ParticipantError';
    }
}

let checkedInitialPasswordColumn = false;
let checkedParticipantSecurityColumns = false;

/**
 * Ensures that the initial_password column exists in participant_profiles table.
 * Executed defensively to avoid runtime SQL errors on legacy database schemas.
 */
export async function ensureInitialPasswordColumn(): Promise<void> {
    if (checkedInitialPasswordColumn) return;
    try {
        const columns = await executeQuery<{ COLUMN_NAME: string }[]>(
            `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'participant_profiles' AND COLUMN_NAME = 'initial_password'`
        );
        if (!columns || columns.length === 0) {
            await executeQuery(
                `ALTER TABLE participant_profiles ADD COLUMN initial_password VARCHAR(255) NULL AFTER registration_date`
            );
        }
        checkedInitialPasswordColumn = true;
    } catch (err) {
        logger.warn('SCHEMA_MIGRATION', 'Could not ensure initial_password column', {
            error: err instanceof Error ? err.message : String(err),
        });
        checkedInitialPasswordColumn = true;
    }
}

/**
 * Ensures participant_profiles has nullable gender and must_change_password column.
 * Guarantees zero-risk migration without requiring manual DB commands.
 */
export async function ensureParticipantSecurityColumns(): Promise<void> {
    if (checkedParticipantSecurityColumns) return;
    await ensureInitialPasswordColumn();

    try {
        // 1. Ensure gender is nullable
        const genderCols = await executeQuery<{ COLUMN_NAME: string; IS_NULLABLE: string }[]>(
            `SELECT COLUMN_NAME, IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS 
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'participant_profiles' AND COLUMN_NAME = 'gender'`
        );
        if (genderCols && genderCols.length > 0 && genderCols[0].IS_NULLABLE === 'NO') {
            await executeQuery(
                `ALTER TABLE participant_profiles MODIFY COLUMN gender ENUM('L', 'P') NULL DEFAULT NULL`
            );
        }

        // 2. Ensure must_change_password column exists
        const mustChangeCols = await executeQuery<{ COLUMN_NAME: string }[]>(
            `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'participant_profiles' AND COLUMN_NAME = 'must_change_password'`
        );
        if (!mustChangeCols || mustChangeCols.length === 0) {
            await executeQuery(
                `ALTER TABLE participant_profiles ADD COLUMN must_change_password BOOLEAN NOT NULL DEFAULT FALSE AFTER initial_password`
            );
        }

        // 3. Ensure id_card_number exists
        const idCardCols = await executeQuery<{ COLUMN_NAME: string }[]>(
            `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'participant_profiles' AND COLUMN_NAME = 'id_card_number'`
        );

        if (!idCardCols || idCardCols.length === 0) {
            await executeQuery(
                `ALTER TABLE participant_profiles ADD COLUMN id_card_number VARCHAR(50) NULL AFTER nip`
            );
            await executeQuery(
                `ALTER TABLE participant_profiles ADD INDEX idx_participant_id_card (id_card_number)`
            ).catch(() => undefined);
        }

        checkedParticipantSecurityColumns = true;
    } catch (err) {
        logger.warn('SCHEMA_MIGRATION', 'Could not ensure participant security columns', {
            error: err instanceof Error ? err.message : String(err),
        });
        checkedParticipantSecurityColumns = true;
    }
}

let checkedExamDraftVersionColumn = false;

/**
 * Ensures exam_answer_drafts has client_version column for revision-based optimistic concurrency control.
 */
export async function ensureExamDraftVersionColumn(): Promise<void> {
    if (checkedExamDraftVersionColumn) return;
    try {
        const cols = await executeQuery<{ COLUMN_NAME: string }[]>(
            `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'exam_answer_drafts' AND COLUMN_NAME = 'client_version'`
        );
        if (!cols || cols.length === 0) {
            await executeQuery(
                `ALTER TABLE exam_answer_drafts ADD COLUMN client_version INT NOT NULL DEFAULT 1 AFTER selected_option`
            );
        }
        checkedExamDraftVersionColumn = true;
    } catch (err) {
        logger.warn('SCHEMA_MIGRATION', 'Could not ensure exam_answer_drafts client_version column', {
            error: err instanceof Error ? err.message : String(err),
        });
        checkedExamDraftVersionColumn = true;
    }
}

/**
 * Generates a clean, highly secure, readable random password.
 * - Always starts with an alphabetic letter (A-Z, a-z) to avoid Excel/CSV formula prefix issues (=, +, -, @).
 * - Excludes visually ambiguous characters (0, O, o, 1, l, I).
 * - Guaranteed to contain uppercase, lowercase, numbers (2-9), and safe symbols (!#$%&*).
 * - 100% compatible with Excel, CSV, and human reading.
 */
export function generateSecurePassword(length = 12): string {
    const letters = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';
    const numbers = '23456789';
    // Safe symbols that never conflict with HTML entities (&amp;), formula prefixes, or URL delimiters
    const symbols = '!@*#';
    const allChars = letters + numbers + symbols;

    const uppers = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lowers = 'abcdefghjkmnpqrstuvwxyz';

    // Guarantee first char is an alphabet letter
    const firstChar = letters[crypto.randomInt(letters.length)];

    // Pick at least 1 uppercase, 1 lowercase, 1 number, 1 symbol
    const requiredChars = [
        uppers[crypto.randomInt(uppers.length)],
        lowers[crypto.randomInt(lowers.length)],
        numbers[crypto.randomInt(numbers.length)],
        symbols[crypto.randomInt(symbols.length)],
    ];

    const remainingLength = Math.max(0, length - 1 - requiredChars.length);
    const middleChars: string[] = [];
    for (let i = 0; i < remainingLength; i++) {
        middleChars.push(allChars[crypto.randomInt(allChars.length)]);
    }

    // Shuffle required and middle characters
    const rest = [...requiredChars, ...middleChars];
    for (let i = rest.length - 1; i > 0; i--) {
        const j = crypto.randomInt(i + 1);
        [rest[i], rest[j]] = [rest[j], rest[i]];
    }

    return firstChar + rest.join('');
}
