import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import pool, { executeQuery } from '@/lib/db';
import { withAuth, AuthenticatedUser } from '@/lib/api-auth';
import { logActivity } from '@/lib/audit';
import logger from '@/lib/logger';
import { v4 as uuidv4 } from 'uuid';

const bulkAdjustScoreSchema = z.object({
    participant_ids: z.array(z.string().uuid()).min(1, 'Pilih minimal 1 peserta'),
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

        let updatedCount = 0;

        for (const pId of participant_ids) {
            // Ambil data progress peserta saat ini
            const [progressRows] = await connection.execute<any[]>(
                `SELECT id, score, original_score, score_adjustment, status, COALESCE(grading_pending, 0) AS grading_pending
                 FROM user_progress
                 WHERE session_id = ? AND user_id = ? AND module_item_id = ?
                 LIMIT 1
                 FOR UPDATE`,
                [sessionId, pId, targetModuleItemId]
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
                        { success: false, error: 'Penyesuaian massal dibatalkan karena ada peserta yang masih menunggu penilaian esai', participant_id: pId },
                        { status: 409 },
                    );
                }
                progressId = pRow.id;
                originalScore = pRow.original_score !== null && pRow.original_score !== undefined
                    ? Number(pRow.original_score)
                    : Number(pRow.score || 0);
                currentAdjustment = Number(pRow.score_adjustment || 0);
            } else {
                progressId = uuidv4();
                originalScore = 0;
                currentAdjustment = 0;

                await connection.execute(
                    `INSERT INTO user_progress (id, user_id, session_id, module_item_id, status, score, original_score, score_adjustment)
                     VALUES (?, ?, ?, ?, 'completed', 0, 0, 0)`,
                    [progressId, pId, sessionId, targetModuleItemId]
                );
            }

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
