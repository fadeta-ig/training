import { NextRequest } from 'next/server';
import { executeQuery } from '@/lib/db';
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

/** Validate that a session exists and return its timing status. */
export async function validateSessionTiming(
    sessionId: string
): Promise<SessionTimingResult> {
    const rows = await executeQuery<Session[]>(
        `SELECT id, module_id, title, start_time, end_time, require_seb, show_score, seb_config_key, created_at
         FROM sessions WHERE id = ?`,
        [sessionId]
    );

    if (!rows || rows.length === 0) {
        throw new ParticipantError('Sesi tidak ditemukan', 404);
    }

    const session = rows[0];
    const now = new Date();
    const start = new Date(session.start_time);
    const end = new Date(session.end_time);

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
    session: Session
): void {
    if (!session.require_seb) return;

    const userAgent = request.headers.get('user-agent') || '';
    const isSebBrowser = userAgent.includes('SafeExamBrowser');

    if (!isSebBrowser) {
        throw new ParticipantError(
            'Ujian ini hanya dapat diakses melalui Safe Exam Browser (SEB)',
            403
        );
    }

    if (session.seb_config_key) {
        const clientHash = request.headers.get('x-safeexambrowser-configkeyhash') || '';
        if (clientHash !== session.seb_config_key) {
            throw new ParticipantError(
                'Konfigurasi SEB tidak valid. Pastikan Anda menggunakan file konfigurasi SEB yang benar.',
                403
            );
        }
    }
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
): Promise<{ id: string; status: string; score: number | null; attempts_count: number; last_attempt_start: string | null } | null> {
    const rows = await executeQuery<{ id: string; status: string; score: number | null; attempts_count: number; last_attempt_start: string | null }[]>(
        `SELECT id, status, score, attempts_count, last_attempt_start
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
