import { NextRequest } from 'next/server';
import { executeQuery } from '@/lib/db';
import type { Session, SessionParticipant } from '@/types';

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
