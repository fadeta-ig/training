import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import pool, { executeQuery } from '@/lib/db';
import { withAuth, AuthenticatedUser } from '@/lib/api-auth';
import { logActivity } from '@/lib/audit';
import logger from '@/lib/logger';

const adjustScoreSchema = z.object({
    module_item_id: z.string().uuid().optional(),
    adjustment_type: z.enum(['add', 'subtract', 'set']),
    value: z.number().min(0).max(100),
    reason: z.string().min(2, 'Alasan penyesuaian nilai wajib diisi (minimal 2 karakter)').max(255),
});

/**
 * POST /api/admin/sessions/[id]/participants/[participantId]/score-adjust
 * Memperbarui nilai ujian peserta secara transparan dengan audit trail.
 */
async function handlePost(
    request: NextRequest,
    authUser: AuthenticatedUser,
    context: { params: Promise<{ id: string; participantId: string }> }
) {
    let connection;
    try {
        const { id: sessionId, participantId } = await context.params;
        const body = await request.json();
        const parsed = adjustScoreSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { success: false, error: 'Validasi input gagal', details: parsed.error.flatten().fieldErrors },
                { status: 400 }
            );
        }

        const { module_item_id, adjustment_type, value, reason } = parsed.data;

        // 1. Verifikasi kepesertaan dalam sesi
        const enrollments = await executeQuery<any[]>(
            `SELECT sp.id AS enrollment_id, sp.user_id, u.full_name, u.username
             FROM session_participants sp
             JOIN users u ON sp.user_id = u.id
             WHERE sp.session_id = ? AND sp.user_id = ?
             LIMIT 1`,
            [sessionId, participantId]
        );

        if (!enrollments || enrollments.length === 0) {
            return NextResponse.json(
                { success: false, error: 'Peserta tidak terdaftar pada sesi ini' },
                { status: 404 }
            );
        }

        const enrollment = enrollments[0];

        // 2. Cari target exam item dalam sesi ini
        let targetModuleItemId: string = module_item_id || '';
        if (!targetModuleItemId) {
            const examItems = await executeQuery<any[]>(
                `SELECT mi.id
                 FROM module_items mi
                 JOIN sessions s ON s.module_id = mi.module_id
                 WHERE s.id = ? AND mi.item_type = 'exam'
                 ORDER BY mi.sequence_order ASC
                 LIMIT 1`,
                [sessionId]
            );

            if (!examItems || examItems.length === 0) {
                return NextResponse.json(
                    { success: false, error: 'Tidak ditemukan item modul ujian pada sesi ini' },
                    { status: 404 }
                );
            }
            targetModuleItemId = examItems[0].id;
        }

        connection = await pool.getConnection();
        await connection.beginTransaction();

        // 3. Ambil data user_progress terkait
        const [progressRows] = await connection.execute<any[]>(
            `SELECT id, score, original_score, score_adjustment, status, COALESCE(grading_pending, 0) AS grading_pending
             FROM user_progress
             WHERE session_id = ? AND user_id = ? AND module_item_id = ?
             LIMIT 1
             FOR UPDATE`,
            [sessionId, participantId, targetModuleItemId]
        );

        let progressId: string;
        let originalScore = 0;
        let currentAdjustment = 0;

        if (progressRows.length > 0) {
            const pRow = progressRows[0];
            if (pRow.status === 'grading_pending' || Boolean(pRow.grading_pending)) {
                await connection.rollback();
                connection.release();
                connection = undefined;
                return NextResponse.json(
                    { success: false, error: 'Nilai belum dapat disesuaikan karena penilaian esai masih berlangsung' },
                    { status: 409 },
                );
            }
            progressId = pRow.id;
            originalScore = pRow.original_score !== null && pRow.original_score !== undefined
                ? Number(pRow.original_score)
                : Number(pRow.score || 0);
            currentAdjustment = Number(pRow.score_adjustment || 0);
        } else {
            // Jika belum ada record user_progress, buat baru
            const { v4: uuidv4 } = await import('uuid');
            progressId = uuidv4();
            originalScore = 0;
            currentAdjustment = 0;

            await connection.execute(
                `INSERT INTO user_progress (id, user_id, session_id, module_item_id, status, score, original_score, score_adjustment)
                 VALUES (?, ?, ?, ?, 'completed', 0, 0, 0)`,
                [progressId, participantId, sessionId, targetModuleItemId]
            );
        }

        // 4. Kalkulasi nilai akhir dan penyesuaian (Clamped antara 0 s.d 100)
        let newAdjustment = currentAdjustment;
        let finalScore = 0;

        if (adjustment_type === 'add') {
            newAdjustment = Math.round((currentAdjustment + value) * 100) / 100;
            finalScore = Math.min(100, Math.max(0, Math.round((originalScore + newAdjustment) * 100) / 100));
        } else if (adjustment_type === 'subtract') {
            newAdjustment = Math.round((currentAdjustment - value) * 100) / 100;
            finalScore = Math.min(100, Math.max(0, Math.round((originalScore + newAdjustment) * 100) / 100));
        } else if (adjustment_type === 'set') {
            finalScore = Math.min(100, Math.max(0, Math.round(value * 100) / 100));
            newAdjustment = Math.round((finalScore - originalScore) * 100) / 100;
        }

        // 5. Update user_progress
        await connection.execute(
            `UPDATE user_progress
             SET original_score = ?,
                 score_adjustment = ?,
                 score = ?,
                 adjustment_reason = ?,
                 adjusted_by = ?,
                 adjusted_at = NOW(),
                 status = 'completed'
             WHERE id = ?`,
            [originalScore, newAdjustment, finalScore, reason.trim(), authUser.id, progressId]
        );

        await connection.commit();

        // 6. Audit Trail Logging
        await logActivity(authUser.id, 'SCORE_ADJUSTMENT', 'user_progress', progressId, {
            sessionId,
            participantId,
            participantName: enrollment.full_name || enrollment.username,
            moduleItemId: targetModuleItemId,
            adjustmentType: adjustment_type,
            inputValue: value,
            originalScore,
            scoreAdjustment: newAdjustment,
            finalScore,
            reason: reason.trim(),
        });

        return NextResponse.json({
            success: true,
            message: `Nilai peserta berhasil disesuaikan menjadi ${finalScore.toFixed(1)}`,
            data: {
                progress_id: progressId,
                original_score: originalScore,
                score_adjustment: newAdjustment,
                final_score: finalScore,
                adjustment_reason: reason.trim(),
                adjusted_at: new Date().toISOString(),
            },
        });
    } catch (error) {
        if (connection) await connection.rollback().catch(() => {});
        logger.error('SCORE_ADJUSTMENT', 'Gagal menyesuaikan nilai peserta', error, authUser.id);
        const message = error instanceof Error ? error.message : 'Internal Server Error';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    } finally {
        if (connection) connection.release();
    }
}

export const POST = withAuth(handlePost, { allowedRoles: ['admin'] });
