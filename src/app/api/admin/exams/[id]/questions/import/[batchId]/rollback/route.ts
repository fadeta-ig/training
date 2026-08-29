import { NextRequest, NextResponse } from 'next/server';
import type { RowDataPacket } from 'mysql2/promise';
import pool from '@/lib/db';
import { withAuth, AuthenticatedUser } from '@/lib/api-auth';
import { checkRateLimit } from '@/lib/rate-limit';
import {
    getQuestionImportBlockedMessage,
    getQuestionImportExamUsage,
    isQuestionImportBlocked,
} from '@/lib/question-import-usage';
import { logActivity } from '@/lib/audit';
import logger from '@/lib/logger';

interface BatchRow extends RowDataPacket {
    id: string;
    exam_id: string;
    status: 'previewed' | 'committed' | 'rolled_back' | 'expired' | 'failed';
    question_count: number;
}

interface CountRow extends RowDataPacket {
    total: number | string;
}

async function handleDelete(
    request: NextRequest,
    user: AuthenticatedUser,
    context: { params: Promise<{ id: string; batchId: string }> },
) {
    const blocked = checkRateLimit(request, {
        windowMs: 60_000,
        maxRequests: 5,
        identifier: user.id,
        message: 'Terlalu banyak permintaan rollback. Silakan tunggu satu menit.',
    });
    if (blocked) return blocked;

    let connection;
    try {
        const { id: examId, batchId } = await context.params;
        const usage = await getQuestionImportExamUsage(examId);
        if (!usage.examExists) {
            return NextResponse.json({ success: false, error: 'Ujian tidak ditemukan' }, { status: 404 });
        }
        if (isQuestionImportBlocked(usage)) {
            return NextResponse.json({ success: false, error: getQuestionImportBlockedMessage(usage), usage }, { status: 409 });
        }

        connection = await pool.getConnection();
        await connection.beginTransaction();
        await connection.execute('SELECT id FROM exams WHERE id = ? LIMIT 1 FOR UPDATE', [examId]);

        const [batchRows] = await connection.execute<BatchRow[]>(
            `SELECT id, exam_id, status, question_count
             FROM question_import_batches
             WHERE id = ? AND exam_id = ?
             LIMIT 1 FOR UPDATE`,
            [batchId, examId],
        );
        const batch = batchRows[0];
        if (!batch) {
            await connection.rollback();
            connection.release();
            connection = undefined;
            return NextResponse.json({ success: false, error: 'Batch import tidak ditemukan' }, { status: 404 });
        }
        if (batch.status === 'rolled_back') {
            await connection.commit();
            connection.release();
            connection = undefined;
            return NextResponse.json({ success: true, idempotent: true, message: 'Batch sudah dibatalkan sebelumnya', data: { batchId, removedCount: 0 } });
        }
        if (batch.status !== 'committed') {
            await connection.rollback();
            connection.release();
            connection = undefined;
            return NextResponse.json({ success: false, error: `Batch berstatus ${batch.status} dan tidak dapat di-rollback` }, { status: 409 });
        }

        const [answerRows] = await connection.execute<CountRow[]>(
            `SELECT COUNT(*) AS total
             FROM exam_answers ea
             INNER JOIN questions q ON q.id = ea.question_id
             WHERE q.import_batch_id = ?`,
            [batchId],
        );
        const [draftRows] = await connection.execute<CountRow[]>(
            `SELECT COUNT(*) AS total
             FROM exam_answer_drafts ead
             INNER JOIN questions q ON q.id = ead.question_id
             WHERE q.import_batch_id = ?`,
            [batchId],
        );
        const usedAnswerCount = Number(answerRows[0]?.total ?? 0);
        const usedDraftCount = Number(draftRows[0]?.total ?? 0);
        if (usedAnswerCount > 0 || usedDraftCount > 0) {
            await connection.rollback();
            connection.release();
            connection = undefined;
            return NextResponse.json({
                success: false,
                error: `Rollback diblokir karena soal hasil import sudah memiliki ${usedAnswerCount} jawaban final dan ${usedDraftCount} draft jawaban.`,
            }, { status: 409 });
        }

        const [questionRows] = await connection.execute<Array<RowDataPacket & { id: string }>>(
            'SELECT id FROM questions WHERE import_batch_id = ? AND exam_id = ? FOR UPDATE',
            [batchId, examId],
        );
        await connection.execute('DELETE FROM questions WHERE import_batch_id = ? AND exam_id = ?', [batchId, examId]);

        const [remainingRows] = await connection.execute<Array<RowDataPacket & { id: string }>>(
            'SELECT id FROM questions WHERE exam_id = ? ORDER BY sequence_order ASC, id ASC FOR UPDATE',
            [examId],
        );
        for (let index = 0; index < remainingRows.length; index += 1) {
            await connection.execute('UPDATE questions SET sequence_order = ? WHERE id = ?', [index + 1, remainingRows[index].id]);
        }

        await connection.execute(
            `UPDATE question_import_batches
             SET status = 'rolled_back', rolled_back_at = UTC_TIMESTAMP(), payload_json = NULL
             WHERE id = ?`,
            [batchId],
        );
        await connection.commit();
        connection.release();
        connection = undefined;

        await logActivity(user.id, 'ROLLBACK_QUESTION_IMPORT', 'question_import_batches', batchId, {
            examId,
            removedCount: questionRows.length,
        });

        return NextResponse.json({
            success: true,
            message: `${questionRows.length} soal hasil import berhasil dibatalkan`,
            data: { batchId, removedCount: questionRows.length },
        });
    } catch (error) {
        if (connection) {
            try { await connection.rollback(); } catch { /* connection may already be closed */ }
            connection.release();
        }
        logger.error('QUESTION_IMPORT_ROLLBACK', 'Rollback import soal gagal', error, user.id);
        return NextResponse.json({ success: false, error: 'Gagal membatalkan import soal' }, { status: 500 });
    }
}

export const DELETE = withAuth(handleDelete, { allowedRoles: ['admin'] });
