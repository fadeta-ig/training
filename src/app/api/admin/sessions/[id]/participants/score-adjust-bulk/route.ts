import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import pool, { executeQuery } from '@/lib/db';
import { withAuth, AuthenticatedUser } from '@/lib/api-auth';
import { logActivity } from '@/lib/audit';
import logger from '@/lib/logger';
import { getSessionExamMappings, getSessionResultContext } from '@/lib/exam-results';

const bulkAdjustScoreSchema = z.object({
    participant_ids: z.array(z.string().uuid()).min(1, 'Pilih minimal 1 peserta').max(1000)
        .refine((ids) => new Set(ids).size === ids.length, 'Daftar peserta mengandung ID duplikat'),
    module_item_id: z.string().uuid().optional(),
    adjustment_type: z.enum(['add', 'subtract', 'set']),
    value: z.number().min(0).max(100),
    reason: z.string().min(2, 'Alasan penyesuaian nilai wajib diisi (minimal 2 karakter)').max(255),
});

/**
 * POST /api/admin/sessions/[id]/participants/score-adjust-bulk
 * Penyesuaian nilai ujian secara massal untuk beberapa peserta terpilih.
 */
async function handlePost(
    request: NextRequest,
    authUser: AuthenticatedUser,
    context: { params: Promise<{ id: string }> }
) {
    let connection;
    try {
        const { id: sessionId } = await context.params;
        const body = await request.json();
        const parsed = bulkAdjustScoreSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { success: false, error: 'Validasi input gagal', details: parsed.error.flatten().fieldErrors },
                { status: 400 }
            );
        }

        const { participant_ids, module_item_id, adjustment_type, value, reason } = parsed.data;

        const sessionRows = await executeQuery<any[]>(
            `SELECT result_state FROM sessions WHERE id = ? LIMIT 1`,
            [sessionId],
        );
        if (!sessionRows.length) {
            return NextResponse.json({ success: false, error: 'Sesi tidak ditemukan' }, { status: 404 });
        }
        if (sessionRows[0].result_state === 'published') {
            return NextResponse.json(
                { success: false, error: 'Hasil sudah dipublikasikan. Buka revisi hasil sesi sebelum adjustment massal.' },
                { status: 409 },
            );
        }

        // 1. Dapatkan target module_item_id untuk ujian sesi ini
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
                    { success: false, error: 'Tidak ditemukan modul ujian pada sesi ini' },
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
                { success: false, error: 'Hasil sudah dipublikasikan. Buka revisi hasil sesi sebelum adjustment massal.' },
                { status: 409 },
            );
        }
        const enrollmentPlaceholders = participant_ids.map(() => '?').join(',');
        const [enrolledRows] = await connection.execute<any[]>(
            `SELECT user_id FROM session_participants
             WHERE session_id = ? AND user_id IN (${enrollmentPlaceholders})
             FOR UPDATE`,
            [sessionId, ...participant_ids],
        );
        if (enrolledRows.length !== participant_ids.length) {
            await connection.rollback();
            connection.release();
            connection = undefined;
            return NextResponse.json(
                { success: false, error: 'Adjustment massal dibatalkan karena ada peserta yang tidak terdaftar pada sesi ini' },
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

        let updatedCount = 0;

        for (const pId of participant_ids) {
            const [attemptRows] = await connection.execute<any[]>(
                `SELECT id, session_id, module_item_id, attempt_number,
                        original_score, score_adjustment, final_score
                 FROM exam_attempt_results
                 WHERE root_session_id = ? AND user_id = ? AND source_exam_id = ?
                   AND grading_pending = FALSE AND final_score IS NOT NULL
                 ORDER BY final_score DESC, completed_at DESC, attempt_number DESC
                 LIMIT 1
                 FOR UPDATE`,
                [resultContext.root_session_id, pId, mapping.source_exam_id],
            );
            if (attemptRows.length === 0) {
                await connection.rollback();
                connection.release();
                connection = undefined;
                return NextResponse.json(
                    { success: false, error: 'Riwayat attempt peserta belum tersedia. Jalankan sinkronisasi skema terlebih dahulu.', participant_id: pId },
                    { status: 409 },
                );
            }

            const targetAttempt = attemptRows[0];
            const [progressRows] = await connection.execute<any[]>(
                `SELECT id, status, COALESCE(grading_pending, 0) AS grading_pending
                 FROM user_progress
                 WHERE session_id = ? AND user_id = ? AND module_item_id = ?
                 LIMIT 1
                 FOR UPDATE`,
                [targetAttempt.session_id, pId, targetAttempt.module_item_id],
            );
            if (!progressRows.length || progressRows[0].status === 'grading_pending' || Boolean(progressRows[0].grading_pending)) {
                await connection.rollback();
                connection.release();
                connection = undefined;
                return NextResponse.json(
                    { success: false, error: 'Adjustment massal dibatalkan karena progres attempt tertinggi belum siap', participant_id: pId },
                    { status: 409 },
                );
            }
            const progressId = progressRows[0].id;
            const originalScore = Number(targetAttempt.original_score ?? targetAttempt.final_score ?? 0);
            const currentAdjustment = Number(targetAttempt.score_adjustment || 0);

            // Hitung nilai akhir baru
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

            await connection.execute(
                `UPDATE exam_attempt_results
                 SET original_score = ?, score_adjustment = ?, final_score = ?,
                     adjustment_reason = ?, adjusted_by = ?, adjusted_at = UTC_TIMESTAMP()
                 WHERE id = ?`,
                [originalScore, newAdjustment, finalScore, reason.trim(), authUser.id, targetAttempt.id],
            );

            const [bestRows] = await connection.execute<any[]>(
                `SELECT original_score, score_adjustment, final_score, adjustment_reason,
                        adjusted_by, adjusted_at
                 FROM exam_attempt_results
                 WHERE session_id = ? AND user_id = ? AND module_item_id = ?
                   AND grading_pending = FALSE AND final_score IS NOT NULL
                 ORDER BY final_score DESC, attempt_number DESC
                 LIMIT 1`,
                [targetAttempt.session_id, pId, targetAttempt.module_item_id],
            );
            const bestAttempt = bestRows[0];

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
                    Number(bestAttempt.original_score), Number(bestAttempt.score_adjustment || 0),
                    Number(bestAttempt.final_score), bestAttempt.adjustment_reason || null,
                    bestAttempt.adjusted_by || null, bestAttempt.adjusted_at || null, progressId,
                ]
            );

            updatedCount++;
        }

        await connection.commit();

        // Audit Trail Logging
        await logActivity(authUser.id, 'BULK_SCORE_ADJUSTMENT', 'user_progress', sessionId, {
            sessionId,
            participantCount: participant_ids.length,
            adjustmentType: adjustment_type,
            inputValue: value,
            reason: reason.trim(),
            moduleItemId: targetModuleItemId,
        });

        return NextResponse.json({
            success: true,
            message: `Nilai ${updatedCount} peserta berhasil disesuaikan (${adjustment_type === 'add' ? '+' : adjustment_type === 'subtract' ? '-' : '='}${value})`,
            data: {
                updated_count: updatedCount,
            },
        });
    } catch (error) {
        if (connection) await connection.rollback().catch(() => {});
        logger.error('BULK_SCORE_ADJUSTMENT', 'Gagal menyesuaikan nilai massal', error, authUser.id);
        const message = error instanceof Error ? error.message : 'Internal Server Error';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    } finally {
        if (connection) connection.release();
    }
}

export const POST = withAuth(handlePost, { allowedRoles: ['admin'] });
