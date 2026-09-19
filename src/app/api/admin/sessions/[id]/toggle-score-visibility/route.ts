import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { executeQuery } from '@/lib/db';
import { withAuth, AuthenticatedUser } from '@/lib/api-auth';
import { logActivity } from '@/lib/audit';
import logger from '@/lib/logger';
import pool from '@/lib/db';

const toggleVisibilitySchema = z.object({
    show_score: z.boolean(),
});

/**
 * PATCH /api/admin/sessions/[id]/toggle-score-visibility
 * Mengontrol publikasi nilai sesi (Draft / Disembunyikan vs Dipublikasikan ke Peserta).
 */
async function handlePatch(
    request: NextRequest,
    authUser: AuthenticatedUser,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id: sessionId } = await context.params;
        const body = await request.json();
        const parsed = toggleVisibilitySchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { success: false, error: 'Validasi gagal: format show_score harus boolean' },
                { status: 400 }
            );
        }

        const { show_score } = parsed.data;

        if (show_score) {
            return NextResponse.json(
                { success: false, error: 'Gunakan alur Publikasikan Hasil Sesi agar nilai, status remedial, dan notifikasi divalidasi bersama.' },
                { status: 409 },
            );
        }

        // 1. Verifikasi sesi
        const sessions = await executeQuery<any[]>(
            `SELECT id, title, show_score, session_type, parent_session_id
             FROM sessions WHERE id = ? LIMIT 1`,
            [sessionId]
        );

        if (!sessions || sessions.length === 0) {
            return NextResponse.json(
                { success: false, error: 'Sesi tidak ditemukan' },
                { status: 404 }
            );
        }

        const session = sessions[0];

        const rootSessionId = session.session_type === 'remedial' && session.parent_session_id
            ? session.parent_session_id
            : sessionId;
        const decisions = await executeQuery<any[]>(
            `SELECT COUNT(*) AS total FROM session_participants
             WHERE session_id = ? AND graduation_status <> 'pending'`,
            [rootSessionId],
        );
        if (Number(decisions[0]?.total || 0) > 0) {
            return NextResponse.json(
                { success: false, error: 'Hasil tidak dapat dibuka untuk revisi karena keputusan kelulusan sudah ditetapkan.' },
                { status: 409 },
            );
        }

        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();
            await connection.execute(
                `UPDATE sessions SET show_score = FALSE, result_state = 'draft'
                 WHERE id = ? OR (parent_session_id = ? AND result_state = 'published')`,
                [rootSessionId, rootSessionId],
            );
            await connection.execute(
                `UPDATE session_result_publications
                 SET status = 'superseded', superseded_at = UTC_TIMESTAMP()
                 WHERE root_session_id = ? AND status = 'active'`,
                [rootSessionId],
            );
            await connection.commit();
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }

        // 3. Log activity audit
        await logActivity(authUser.id, 'TOGGLE_SCORE_VISIBILITY', 'sessions', sessionId, {
            sessionId,
            sessionTitle: session.title,
            previousStatus: Boolean(session.show_score),
            newStatus: false,
            action: 'REOPEN_RESULT_REVISION',
        });

        return NextResponse.json({
            success: true,
            message: 'Hasil dibuka untuk revisi dan tidak lagi tampil di portal peserta. Publikasikan versi baru setelah adjustment selesai.',
            data: {
                session_id: sessionId,
                show_score: show_score,
            },
        });
    } catch (error) {
        logger.error('TOGGLE_SCORE_VISIBILITY', 'Gagal memperbarui status publikasi nilai', error, authUser.id);
        const message = error instanceof Error ? error.message : 'Internal Server Error';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

export const PATCH = withAuth(handlePatch, { allowedRoles: ['admin'] });
