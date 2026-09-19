import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import pool, { executeQuery } from '@/lib/db';
import { withAuth, AuthenticatedUser } from '@/lib/api-auth';
import { logActivity } from '@/lib/audit';
import logger from '@/lib/logger';
import { getSessionExamMappings, getSessionResultContext } from '@/lib/exam-results';

const adjustScoreSchema = z.object({
    module_item_id: z.string().uuid().optional(),
    adjustment_type: z.enum(['add', 'subtract', 'set', 'reset']),
    value: z.number().min(0).max(100).optional().default(0),
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
            `SELECT sp.id AS enrollment_id, sp.user_id, u.full_name, u.username,
                    s.result_state
             FROM session_participants sp
             JOIN users u ON sp.user_id = u.id
             JOIN sessions s ON s.id = sp.session_id
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
        if (enrollment.result_state === 'published') {
            return NextResponse.json(
                { success: false, error: 'Hasil sudah dipublikasikan. Buka revisi hasil sesi sebelum melakukan adjustment.' },
                { status: 409 },
            );
        }

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

        const resultContext = await getSessionResultContext(connection, sessionId, true);
        if (!resultContext) throw new Error('Konteks hasil sesi tidak ditemukan');
        if (resultContext.result_state === 'published') {
            await connection.rollback();
            connection.release();
            connection = undefined;
            return NextResponse.json(
                { success: false, error: 'Hasil sudah dipublikasikan. Buka revisi hasil sesi sebelum melakukan adjustment.' },
                { status: 409 },
            );
        }
        const mappings = await getSessionExamMappings(connection, resultContext);
        const mapping = mappings.find((entry) => entry.module_item_id === targetModuleItemId);
        if (!mapping) {
            await connection.rollback();
            connection.release();
            connection = undefined;
            return NextResponse.json({ success: false, error: 'Pemetaan exam tidak ditemukan' }, { status: 409 });
        }

        let [attemptRows] = await connection.execute<any[]>(
            `SELECT id, session_id, module_item_id, attempt_number,
                    original_score, score_adjustment, final_score
             FROM exam_attempt_results
             WHERE root_session_id = ? AND user_id = ? AND source_exam_id = ?
               AND grading_pending = FALSE AND final_score IS NOT NULL
             ORDER BY final_score DESC, completed_at DESC, attempt_number DESC
             LIMIT 1
             FOR UPDATE`,
            [resultContext.root_session_id, participantId, mapping.source_exam_id],
        );

        if (attemptRows.length === 0) {
            const [legacyProgressRows] = await connection.execute<any[]>(
                `SELECT id, score, original_score, score_adjustment, attempts_count
                 FROM user_progress
                 WHERE session_id = ? AND user_id = ? AND module_item_id = ?
                   AND score IS NOT NULL AND status = 'completed'
                 LIMIT 1
                 FOR UPDATE`,
                [sessionId, participantId, targetModuleItemId],
            );
            if (!legacyProgressRows.length) {
                await connection.rollback();
                connection.release();
                connection = undefined;
                return NextResponse.json(
                    { success: false, error: 'Nilai belum dapat disesuaikan karena peserta belum menyelesaikan ujian' },
                    { status: 409 },
                );
            }
            const { v4: uuidv4 } = await import('uuid');
            const attemptId = uuidv4();
            const legacyProgress = legacyProgressRows[0];
            const attemptNumber = Math.max(1, Number(legacyProgress.attempts_count || 1));
            await connection.execute(
                `INSERT INTO exam_attempt_results
                    (id, root_session_id, session_id, user_id, module_item_id, exam_id,
                     source_exam_id, attempt_number, original_score, score_adjustment,
                     final_score, grading_pending, completed_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, FALSE, UTC_TIMESTAMP())`,
                [
                    attemptId, resultContext.root_session_id, sessionId, participantId,
                    targetModuleItemId, mapping.exam_id, mapping.source_exam_id, attemptNumber,
                    Number(legacyProgress.original_score ?? legacyProgress.score),
                    Number(legacyProgress.score_adjustment || 0), Number(legacyProgress.score),
                ],
            );
            [attemptRows] = await connection.execute<any[]>(
                `SELECT id, session_id, module_item_id, attempt_number,
                        original_score, score_adjustment, final_score
                 FROM exam_attempt_results WHERE id = ? FOR UPDATE`,
                [attemptId],
            );
        }

        const targetAttempt = attemptRows[0];
        const [progressRows] = await connection.execute<any[]>(
            `SELECT id, status, COALESCE(grading_pending, 0) AS grading_pending
             FROM user_progress
             WHERE session_id = ? AND user_id = ? AND module_item_id = ?
             LIMIT 1
             FOR UPDATE`,
            [targetAttempt.session_id, participantId, targetAttempt.module_item_id],
        );
        if (!progressRows.length || progressRows[0].status === 'grading_pending' || Boolean(progressRows[0].grading_pending)) {
            await connection.rollback();
            connection.release();
            connection = undefined;
            return NextResponse.json(
                { success: false, error: 'Nilai attempt tertinggi belum dapat disesuaikan karena progres atau penilaian belum siap' },
                { status: 409 },
            );
        }
        const progressId = progressRows[0].id;
        const originalScore = Number(targetAttempt.original_score ?? targetAttempt.final_score ?? 0);
        const currentAdjustment = Number(targetAttempt.score_adjustment || 0);

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
        } else if (adjustment_type === 'reset') {
            newAdjustment = 0.00;
            finalScore = originalScore;
        }

        // 5. Update the selected best attempt, then recompute the session best.
        await connection.execute(
            `UPDATE exam_attempt_results
             SET original_score = ?, score_adjustment = ?, final_score = ?,
                 adjustment_reason = ?, adjusted_by = ?, adjusted_at = UTC_TIMESTAMP()
             WHERE id = ?`,
            [originalScore, newAdjustment, finalScore, reason.trim(), authUser.id, targetAttempt.id],
        );

        const [bestRows] = await connection.execute<any[]>(
            `SELECT id, original_score, score_adjustment, final_score, adjustment_reason,
                    adjusted_by, adjusted_at
             FROM exam_attempt_results
             WHERE session_id = ? AND user_id = ? AND module_item_id = ?
               AND grading_pending = FALSE AND final_score IS NOT NULL
             ORDER BY final_score DESC, attempt_number DESC
             LIMIT 1`,
            [targetAttempt.session_id, participantId, targetAttempt.module_item_id],
        );
        const bestAttemptInProgress = bestRows[0];

        await connection.execute(
            `UPDATE user_progress
             SET original_score = ?,
                 score_adjustment = ?,
                 score = ?,
                 adjustment_reason = ?,
                 adjusted_by = ?,
                 adjusted_at = ?,
                 status = 'completed'
             WHERE id = ?`,
            [
                Number(bestAttemptInProgress.original_score), Number(bestAttemptInProgress.score_adjustment || 0),
                Number(bestAttemptInProgress.final_score), bestAttemptInProgress.adjustment_reason || null,
                bestAttemptInProgress.adjusted_by || null, bestAttemptInProgress.adjusted_at || null, progressId,
            ]
        );

        const [highestRows] = await connection.execute<any[]>(
            `SELECT original_score, score_adjustment, final_score, adjustment_reason, adjusted_at
             FROM exam_attempt_results
             WHERE root_session_id = ? AND user_id = ? AND source_exam_id = ?
               AND grading_pending = FALSE AND final_score IS NOT NULL
             ORDER BY final_score DESC, completed_at DESC, attempt_number DESC
             LIMIT 1`,
            [resultContext.root_session_id, participantId, mapping.source_exam_id],
        );
        const highestAttempt = highestRows[0];

        await connection.commit();

        // 6. Audit Trail Logging
        const auditAction = adjustment_type === 'reset' ? 'SCORE_RESET' : 'SCORE_ADJUSTMENT';
        await logActivity(authUser.id, auditAction, 'user_progress', progressId, {
            sessionId,
            participantId,
            participantName: enrollment.full_name || enrollment.username,
            moduleItemId: targetModuleItemId,
            adjustmentType: adjustment_type,
            inputValue: value,
            originalScore,
            scoreAdjustment: newAdjustment,
            finalScore,
            highestScore: Number(highestAttempt.final_score),
            attemptNumber: Number(targetAttempt.attempt_number),
            reason: reason.trim(),
        });

        const successMessage = adjustment_type === 'reset'
            ? `Nilai peserta berhasil di-reset ke nilai awal (${Number(highestAttempt.final_score).toFixed(1)}).`
            : `Attempt tertinggi berhasil disesuaikan. Nilai tertinggi saat ini ${Number(highestAttempt.final_score).toFixed(1)}.`;

        return NextResponse.json({
            success: true,
            message: successMessage,
            data: {
                progress_id: progressId,
                original_score: Number(highestAttempt.original_score),
                score_adjustment: Number(highestAttempt.score_adjustment || 0),
                final_score: Number(highestAttempt.final_score),
                adjustment_reason: highestAttempt.adjustment_reason || null,
                adjusted_at: highestAttempt.adjusted_at || null,
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
