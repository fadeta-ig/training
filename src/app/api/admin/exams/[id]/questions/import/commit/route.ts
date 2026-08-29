import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import pool, { executeQuery } from '@/lib/db';
import { withAuth, AuthenticatedUser } from '@/lib/api-auth';
import { checkRateLimit } from '@/lib/rate-limit';
import { questionSchema } from '@/lib/validations/questionSchema';
import { buildQuestionData } from '@/lib/question-helpers';
import { QUESTION_IMPORT_TEMPLATE_VERSION, type CanonicalImportedQuestion } from '@/lib/question-import';
import {
    getQuestionImportBlockedMessage,
    getQuestionImportExamUsage,
    isQuestionImportBlocked,
} from '@/lib/question-import-usage';
import { logActivity } from '@/lib/audit';
import logger from '@/lib/logger';

const commitSchema = z.object({
    batchId: z.string().uuid('ID batch import tidak valid'),
    acknowledgeHistoricalUsage: z.boolean().optional().default(false),
});

interface BatchRow extends RowDataPacket {
    id: string;
    exam_id: string;
    created_by: string | null;
    file_sha256: string;
    payload_sha256: string;
    template_version: string;
    status: 'previewed' | 'committed' | 'rolled_back' | 'expired' | 'failed';
    question_count: number;
    total_points: number;
    payload_json: string | null;
    is_expired: number | string;
}

interface StoredPayload {
    contractVersion: string;
    examId: string;
    questions: CanonicalImportedQuestion[];
}

interface CountRow extends RowDataPacket {
    total: number | string;
}

function parseStoredPayload(value: string): StoredPayload | null {
    try {
        const parsed = JSON.parse(value) as Partial<StoredPayload>;
        if (
            parsed.contractVersion !== QUESTION_IMPORT_TEMPLATE_VERSION
            || typeof parsed.examId !== 'string'
            || !Array.isArray(parsed.questions)
        ) return null;
        return parsed as StoredPayload;
    } catch {
        return null;
    }
}

async function returnCommittedBatch(examId: string, batchId: string): Promise<NextResponse | null> {
    const batches = await executeQuery<Array<{ id: string; status: string; question_count: number; total_points: number }>>(
        `SELECT id, status, question_count, total_points
         FROM question_import_batches
         WHERE id = ? AND exam_id = ?
         LIMIT 1`,
        [batchId, examId],
    );
    const batch = batches[0];
    if (batch?.status !== 'committed') return null;

    const counts = await executeQuery<Array<{ total: number | string }>>(
        'SELECT COUNT(*) AS total FROM questions WHERE import_batch_id = ?',
        [batchId],
    );
    return NextResponse.json({
        success: true,
        idempotent: true,
        message: 'Batch ini sudah berhasil diimport sebelumnya',
        data: {
            batchId,
            importedCount: Number(counts[0]?.total ?? batch.question_count),
            totalPoints: Number(batch.total_points),
        },
    });
}

async function handlePost(
    request: NextRequest,
    user: AuthenticatedUser,
    context: { params: Promise<{ id: string }> },
) {
    const blocked = checkRateLimit(request, {
        windowMs: 60_000,
        maxRequests: 10,
        identifier: user.id,
        message: 'Terlalu banyak permintaan commit import. Silakan tunggu satu menit.',
    });
    if (blocked) return blocked;

    let connection;
    try {
        const { id: examId } = await context.params;
        const parsedBody = commitSchema.safeParse(await request.json());
        if (!parsedBody.success) {
            return NextResponse.json({
                success: false,
                error: 'Permintaan commit tidak valid',
                details: parsedBody.error.flatten().fieldErrors,
            }, { status: 400 });
        }
        const { batchId, acknowledgeHistoricalUsage } = parsedBody.data;

        const idempotentResponse = await returnCommittedBatch(examId, batchId);
        if (idempotentResponse) return idempotentResponse;

        const usage = await getQuestionImportExamUsage(examId);
        if (!usage.examExists) {
            return NextResponse.json({ success: false, error: 'Ujian tidak ditemukan' }, { status: 404 });
        }
        if (isQuestionImportBlocked(usage)) {
            return NextResponse.json({ success: false, error: getQuestionImportBlockedMessage(usage), usage }, { status: 409 });
        }
        if (usage.historicalAnswerCount > 0 && !acknowledgeHistoricalUsage) {
            return NextResponse.json({
                success: false,
                error: `Ujian memiliki ${usage.historicalAnswerCount} jawaban historis. Konfirmasi bahwa perubahan hanya ditujukan untuk penggunaan ujian berikutnya.`,
                requiresHistoricalAcknowledgement: true,
            }, { status: 409 });
        }

        connection = await pool.getConnection();
        await connection.beginTransaction();

        // Lock the exam row first so imports for the same exam are serialized.
        const [examRows] = await connection.execute<RowDataPacket[]>(
            'SELECT id FROM exams WHERE id = ? LIMIT 1 FOR UPDATE',
            [examId],
        );
        if (examRows.length === 0) {
            await connection.rollback();
            connection.release();
            connection = undefined;
            return NextResponse.json({ success: false, error: 'Ujian tidak ditemukan' }, { status: 404 });
        }

        const [batchRows] = await connection.execute<BatchRow[]>(
            `SELECT id, exam_id, created_by, file_sha256, payload_sha256, template_version,
                    status, question_count, total_points, payload_json,
                    (expires_at <= UTC_TIMESTAMP()) AS is_expired
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
            return NextResponse.json({ success: false, error: 'Batch preview tidak ditemukan' }, { status: 404 });
        }
        if (batch.created_by !== user.id) {
            await connection.rollback();
            connection.release();
            connection = undefined;
            return NextResponse.json({ success: false, error: 'Batch preview dibuat oleh admin lain' }, { status: 403 });
        }
        if (batch.status === 'committed') {
            const [counts] = await connection.execute<CountRow[]>(
                'SELECT COUNT(*) AS total FROM questions WHERE import_batch_id = ?',
                [batchId],
            );
            await connection.commit();
            connection.release();
            connection = undefined;
            return NextResponse.json({
                success: true,
                idempotent: true,
                message: 'Batch ini sudah berhasil diimport sebelumnya',
                data: { batchId, importedCount: Number(counts[0]?.total ?? batch.question_count), totalPoints: Number(batch.total_points) },
            });
        }
        if (batch.status !== 'previewed') {
            await connection.rollback();
            connection.release();
            connection = undefined;
            return NextResponse.json({ success: false, error: `Batch tidak dapat di-commit karena berstatus ${batch.status}` }, { status: 409 });
        }
        if (Number(batch.is_expired) === 1) {
            await connection.execute(
                "UPDATE question_import_batches SET status = 'expired', payload_json = NULL WHERE id = ?",
                [batchId],
            );
            await connection.commit();
            connection.release();
            connection = undefined;
            return NextResponse.json({ success: false, error: 'Preview sudah kedaluwarsa. Upload ulang file untuk membuat preview baru.' }, { status: 410 });
        }
        if (!batch.payload_json || batch.template_version !== QUESTION_IMPORT_TEMPLATE_VERSION) {
            await connection.rollback();
            connection.release();
            connection = undefined;
            return NextResponse.json({ success: false, error: 'Payload preview tidak tersedia atau versi template tidak sesuai' }, { status: 409 });
        }

        const actualPayloadSha256 = crypto.createHash('sha256').update(batch.payload_json).digest('hex');
        if (actualPayloadSha256 !== batch.payload_sha256) {
            await connection.execute(
                "UPDATE question_import_batches SET status = 'failed', payload_json = NULL WHERE id = ?",
                [batchId],
            );
            await connection.commit();
            connection.release();
            connection = undefined;
            logger.error('QUESTION_IMPORT_COMMIT', 'Hash payload staging tidak cocok', new Error('Payload hash mismatch'), user.id);
            return NextResponse.json({ success: false, error: 'Integritas payload preview tidak valid. Upload ulang file.' }, { status: 409 });
        }

        const payload = parseStoredPayload(batch.payload_json);
        if (!payload || payload.examId !== examId) {
            await connection.rollback();
            connection.release();
            connection = undefined;
            return NextResponse.json({ success: false, error: 'Payload preview tidak sesuai dengan ujian tujuan' }, { status: 409 });
        }
        if (payload.questions.length !== Number(batch.question_count)) {
            await connection.rollback();
            connection.release();
            connection = undefined;
            return NextResponse.json({ success: false, error: 'Jumlah soal pada payload preview tidak konsisten' }, { status: 409 });
        }

        const duplicateSourceCodes = new Set<string>();
        const prepared = payload.questions.map((question) => {
            const sourceCodeKey = question.source_code.toUpperCase();
            if (duplicateSourceCodes.has(sourceCodeKey)) throw new Error(`Kode soal duplikat pada staging: ${question.source_code}`);
            duplicateSourceCodes.add(sourceCodeKey);
            if (question.input.exam_id !== examId) throw new Error(`Exam ID tidak konsisten untuk ${question.source_code}`);

            const validated = questionSchema.safeParse(question.input);
            if (!validated.success) {
                const details = Object.values(validated.error.flatten().fieldErrors).flat().join('; ');
                throw new Error(`Validasi akhir gagal untuk ${question.source_code}: ${details}`);
            }
            return {
                question,
                data: validated.data,
                derived: buildQuestionData(validated.data),
            };
        });
        const totalPoints = prepared.reduce((sum, item) => sum + item.data.points, 0);
        if (totalPoints !== Number(batch.total_points)) throw new Error('Total bobot payload tidak konsisten dengan preview');

        const [duplicateBatches] = await connection.execute<BatchRow[]>(
            `SELECT id
             FROM question_import_batches
             WHERE exam_id = ? AND payload_sha256 = ? AND status = 'committed' AND id <> ?
             LIMIT 1 FOR UPDATE`,
            [examId, batch.payload_sha256, batchId],
        );
        if (duplicateBatches.length > 0) {
            await connection.rollback();
            connection.release();
            connection = undefined;
            return NextResponse.json({ success: false, error: 'Isi soal yang identik sudah pernah diimport ke ujian ini' }, { status: 409 });
        }

        const [orderRows] = await connection.execute<Array<RowDataPacket & { max_order: number | string }>>(
            'SELECT COALESCE(MAX(sequence_order), 0) AS max_order FROM questions WHERE exam_id = ?',
            [examId],
        );
        const startOrder = Number(orderRows[0]?.max_order ?? 0);
        const insertedIds: string[] = [];

        for (const item of prepared) {
            const questionId = uuidv4();
            insertedIds.push(questionId);
            await connection.execute<ResultSetHeader>(
                `INSERT INTO questions (
                    id, exam_id, question_type, question_text, question_image, options_json,
                    correct_option_index, correct_answer, points, sequence_order,
                    import_batch_id, source_question_code, source_sheet, source_row
                 ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'SOAL', ?)`,
                [
                    questionId,
                    examId,
                    item.data.question_type,
                    item.data.question_text,
                    item.data.question_image || null,
                    item.derived.optionsJson,
                    item.derived.finalCorrectIndex,
                    item.derived.finalCorrectAnswer,
                    item.data.points,
                    startOrder + item.question.import_order,
                    batchId,
                    item.question.source_code,
                    item.question.source_row,
                ],
            );
        }

        await connection.execute(
            `UPDATE question_import_batches
             SET status = 'committed', committed_at = UTC_TIMESTAMP(), payload_json = NULL
             WHERE id = ? AND status = 'previewed'`,
            [batchId],
        );
        await connection.commit();
        connection.release();
        connection = undefined;

        await logActivity(user.id, 'BULK_IMPORT_QUESTIONS', 'question_import_batches', batchId, {
            examId,
            importedCount: insertedIds.length,
            totalPoints,
            fileSha256: batch.file_sha256,
            templateVersion: batch.template_version,
            historicalAnswerCount: usage.historicalAnswerCount,
        });

        return NextResponse.json({
            success: true,
            message: `${insertedIds.length} soal berhasil diimport secara atomik`,
            data: {
                batchId,
                importedCount: insertedIds.length,
                totalPoints,
                firstSequenceOrder: insertedIds.length > 0 ? startOrder + 1 : null,
                lastSequenceOrder: insertedIds.length > 0 ? startOrder + insertedIds.length : null,
            },
        }, { status: 201 });
    } catch (error) {
        if (connection) {
            try { await connection.rollback(); } catch { /* connection may already be closed */ }
            connection.release();
        }
        logger.error('QUESTION_IMPORT_COMMIT', 'Transaksi import soal gagal', error, user.id);
        const message = error instanceof Error ? error.message : 'Terjadi kesalahan saat commit import soal';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

export const POST = withAuth(handlePost, { allowedRoles: ['admin'] });
