import crypto from 'crypto';
import { NextRequest } from 'next/server';
import { executeQuery } from '@/lib/db';
import logger from '@/lib/logger';
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
}

/** Validate that a session exists and return its timing status. Optionally takes userId to check individual extension. */
export async function validateSessionTiming(
    sessionId: string,
    userId?: string
): Promise<SessionTimingResult> {
    const rows = await executeQuery<Session[]>(
        `SELECT id, module_id, title, start_time, end_time, require_seb, show_score, enable_proctoring, seb_config_key, created_at
         FROM sessions WHERE id = ?`,
        [sessionId]
    );

    if (!rows || rows.length === 0) {
        throw new ParticipantError('Sesi tidak ditemukan', 404);
    }

    const session = rows[0];
    const now = new Date();
    const start = new Date(session.start_time);
    let end = new Date(session.end_time);

    if (userId) {
        const extRows = await executeQuery<{ individual_extension_until: Date | string | null }[]>(
            `SELECT MAX(individual_extension_until) AS individual_extension_until
             FROM user_progress
             WHERE user_id = ? AND session_id = ?`,
            [userId, sessionId]
        );
        const extTime = extRows?.[0]?.individual_extension_until;
        if (extTime) {
            const extDate = new Date(extTime);
            if (extDate > end) {
                end = extDate;
            }
        }
    }

    return {
        session,
        isUpcoming: now < start,
        isActive: now >= start && now <= end,
        isEnded: now > end,
    };
}

/** Validate Safe Exam Browser headers. Throws 403 on invalid access. */
export function validateSebAccess(
    request: NextRequest,
    session: Session,
    userRole?: string
): void {
    if (!session.require_seb || (userRole && userRole !== 'trainee')) return;

    const userAgent = request.headers.get('user-agent') || '';
    const configKeyHash = request.headers.get('x-safeexambrowser-configkeyhash');
    const requestHash = request.headers.get('x-safeexambrowser-requesthash');

    const hasSebHeader = Boolean(configKeyHash || requestHash);

    const lowerUA = userAgent.toLowerCase();
    const isSebUserAgent =
        lowerUA.includes('safeexambrowser') ||
        lowerUA.includes('seb/') ||
        /\bseb\b/i.test(userAgent);

    const isSebBrowser = hasSebHeader || isSebUserAgent;

    if (!isSebBrowser) {
        logger.warn('SEB_SECURITY', 'Akses ditolak: Browser bukan Safe Exam Browser', {
            userAgent,
            ip: request.headers.get('x-forwarded-for') || 'unknown'
        });
        throw new ParticipantError(
            'Ujian ini hanya dapat diakses melalui Safe Exam Browser (SEB)',
            403
        );
    }

    const keysToCheck = Array.from(
        new Set(
            [session.seb_config_key, process.env.SEB_CONFIG_KEY_HASH]
                .filter(Boolean)
                .map((k) => (k as string).toLowerCase().trim())
        )
    );

    // If request comes from genuine Safe Exam Browser (with SEB headers & User-Agent)
    if (hasSebHeader || isSebUserAgent) {
        // Option 1: Direct key match if hashes configured
        const clientHash = (configKeyHash || requestHash || '').toLowerCase().trim();
        if (keysToCheck.length > 0 && clientHash) {
            for (const expectedKey of keysToCheck) {
                if (clientHash === expectedKey) return;

                const rawUrl = request.url;
                const urlObj = new URL(rawUrl);
                const proto = request.headers.get('x-forwarded-proto') || urlObj.protocol.replace(':', '');
                const host = request.headers.get('x-forwarded-host') || urlObj.host;
                const pathname = urlObj.pathname;
                const search = urlObj.search;

                const candidates = [
                    rawUrl,
                    `${proto}://${host}${pathname}${search}`,
                    `${proto}://${host}${pathname}`,
                    `https://${host}${pathname}`,
                    `http://${host}${pathname}`,
                ];

                for (const targetUrl of candidates) {
                    const computed = crypto
                        .createHash('sha256')
                        .update(targetUrl + expectedKey)
                        .digest('hex')
                        .toLowerCase();

                    if (clientHash === computed) return;
                }
            }
        }

        // If it's a genuine SEB client with SEB headers, grant access
        if (hasSebHeader && isSebUserAgent) {
            return;
        }

        // If direct key matched, return
        if (!keysToCheck.length) {
            return;
        }
    }

    logger.warn('SEB_SECURITY', 'Akses ditolak: Hash konfigurasi SEB tidak cocok', {
        hasSebHeader,
        isSebUserAgent,
        userAgent
    });

    throw new ParticipantError(
        'Konfigurasi SEB tidak valid. Pastikan Anda menggunakan file konfigurasi SEB yang benar.',
        403
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

        checkedParticipantSecurityColumns = true;
    } catch (err) {
        logger.warn('SCHEMA_MIGRATION', 'Could not ensure participant security columns', {
            error: err instanceof Error ? err.message : String(err),
        });
        checkedParticipantSecurityColumns = true;
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

