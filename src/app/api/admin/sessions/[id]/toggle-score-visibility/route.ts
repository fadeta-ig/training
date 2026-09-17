import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { executeQuery } from '@/lib/db';
import { withAuth, AuthenticatedUser } from '@/lib/api-auth';
import { logActivity } from '@/lib/audit';
import logger from '@/lib/logger';

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

        // 1. Verifikasi sesi
        const sessions = await executeQuery<any[]>(
            `SELECT id, title, show_score FROM sessions WHERE id = ? LIMIT 1`,
            [sessionId]
        );

        if (!sessions || sessions.length === 0) {
            return NextResponse.json(
                { success: false, error: 'Sesi tidak ditemukan' },
                { status: 404 }
            );
        }

        const session = sessions[0];

        // 2. Update status show_score
        await executeQuery(
            `UPDATE sessions SET show_score = ? WHERE id = ?`,
            [show_score ? 1 : 0, sessionId]
        );

        // 3. Log activity audit
        await logActivity(authUser.id, 'TOGGLE_SCORE_VISIBILITY', 'sessions', sessionId, {
            sessionId,
            sessionTitle: session.title,
            previousStatus: Boolean(session.show_score),
            newStatus: show_score,
            action: show_score ? 'PUBLISH_SCORES' : 'HIDE_SCORES',
        });

        return NextResponse.json({
            success: true,
            message: show_score
                ? 'Nilai berhasil dipublikasikan. Peserta sekarang dapat melihat hasil ujian di dashboard mereka.'
                : 'Nilai berhasil disembunyikan. Status dikembalikan ke DRAFT/EVALUASI internal.',
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
