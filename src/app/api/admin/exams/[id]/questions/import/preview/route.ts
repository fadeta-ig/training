import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { withAuth, AuthenticatedUser } from '@/lib/api-auth';
import { executeQuery } from '@/lib/db';
import { checkRateLimit } from '@/lib/rate-limit';
import {
    parseAndValidateQuestionImport,
    QUESTION_IMPORT_MAX_FILE_BYTES,
    QUESTION_IMPORT_TEMPLATE_VERSION,
    type QuestionImportInput,
    type QuestionImportParseResult,
} from '@/lib/question-import';
import {
    getQuestionImportBlockedMessage,
    getQuestionImportExamUsage,
    isQuestionImportBlocked,
} from '@/lib/question-import-usage';
import logger from '@/lib/logger';

const PREVIEW_TTL_HOURS = 2;
const ALLOWED_MIME_TYPES = new Set([
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/octet-stream',
    'application/zip',
    'application/x-zip-compressed',
]);

interface ExistingBatchRow {
    id: string;
    status: 'previewed' | 'committed' | 'rolled_back' | 'expired' | 'failed';
}

function sanitizeOriginalFilename(name: string): string {
    return name.replace(/[^A-Za-z0-9._()\- ]/g, '_').slice(0, 255) || 'Template_Import_Soal_LMS.xlsx';
}

function summarizeAnswer(input: QuestionImportInput | undefined): string {
    if (!input) return '-';
    switch (input.question_type) {
        case 'multiple_choice':
            return input.correct_option_index === undefined ? '-' : `Opsi benar: ${String.fromCharCode(65 + input.correct_option_index)}`;
        case 'multiple_select':
            return `Opsi benar: ${(input.correct_option_indices ?? []).map((index) => String.fromCharCode(65 + index)).join(', ') || '-'}`;
        case 'true_false':
            return input.correct_option_index === 0 ? 'BENAR' : input.correct_option_index === 1 ? 'SALAH' : '-';
        case 'short_answer':
            return `Kunci: ${input.correct_answer || '-'}`;
        case 'essay':
            return 'Dinilai manual';
        case 'matching':
            return `${input.matching_pairs?.length ?? 0} pasangan · all-or-nothing`;
    }
}

function buildClientPreview(parsed: QuestionImportParseResult) {
    const canonicalByCode = new Map(parsed.questions.map((question) => [question.source_code, question]));
    const errorCount = parsed.issues.filter((issue) => issue.severity === 'error').length;
    const warningCount = parsed.issues.length - errorCount;
    return {
        templateVersion: parsed.templateVersion,
        summary: { ...parsed.summary, errorCount, warningCount },
        previewRows: parsed.previewRows.map((row) => ({
            sourceCode: row.source_code,
            sourceRow: row.source_row,
            sequence: row.import_order,
            type: row.question_type,
            typeLabel: row.question_type_label,
            questionText: row.question_text,
            points: row.points,
            answerSummary: summarizeAnswer(canonicalByCode.get(row.source_code)?.input),
        })),
        issues: parsed.issues,
    };
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
        message: 'Terlalu banyak percobaan preview. Silakan tunggu satu menit.',
    });
    if (blocked) return blocked;

    try {
        const { id: examId } = await context.params;
        const usage = await getQuestionImportExamUsage(examId);
        if (!usage.examExists) {
            return NextResponse.json({ success: false, error: 'Ujian tidak ditemukan' }, { status: 404 });
        }
        if (isQuestionImportBlocked(usage)) {
            return NextResponse.json({
                success: false,
                error: getQuestionImportBlockedMessage(usage),
                usage,
            }, { status: 409 });
        }

        const declaredLength = Number(request.headers.get('content-length'));
        if (Number.isFinite(declaredLength) && declaredLength > QUESTION_IMPORT_MAX_FILE_BYTES + 1_048_576) {
            return NextResponse.json({ success: false, error: 'Ukuran request melebihi batas import 5 MB' }, { status: 413 });
        }

        const formData = await request.formData();
        const file = formData.get('file');
        if (!(file instanceof File)) {
            return NextResponse.json({ success: false, error: 'File XLSX wajib dipilih' }, { status: 400 });
        }
        if (!file.name.toLowerCase().endsWith('.xlsx')) {
            return NextResponse.json({ success: false, error: 'Hanya file Excel .xlsx yang didukung' }, { status: 400 });
        }
        if (file.type && !ALLOWED_MIME_TYPES.has(file.type)) {
            return NextResponse.json({ success: false, error: 'MIME type file tidak sesuai dengan XLSX' }, { status: 400 });
        }
        if (file.size < 1 || file.size > QUESTION_IMPORT_MAX_FILE_BYTES) {
            return NextResponse.json({ success: false, error: 'Ukuran file harus lebih dari 0 byte dan maksimal 5 MB' }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const parsed = await parseAndValidateQuestionImport(buffer, examId);
        if (!parsed.valid) {
            logger.warn('QUESTION_IMPORT_PREVIEW', 'Validasi template import soal gagal', {
                examId,
                fileName: sanitizeOriginalFilename(file.name),
                errorCount: parsed.issues.filter((issue) => issue.severity === 'error').length,
            }, user.id);
            return NextResponse.json({
                success: false,
                valid: false,
                error: 'Template masih memiliki kesalahan. Perbaiki seluruh error sebelum import.',
                data: buildClientPreview(parsed),
            }, { status: 422 });
        }

        const payload = {
            contractVersion: QUESTION_IMPORT_TEMPLATE_VERSION,
            examId,
            questions: parsed.questions,
        };
        const payloadJson = JSON.stringify(payload);
        const payloadSha256 = crypto.createHash('sha256').update(payloadJson).digest('hex');

        await executeQuery(
            `UPDATE question_import_batches
             SET status = 'expired', payload_json = NULL
             WHERE status = 'previewed' AND expires_at < UTC_TIMESTAMP()`,
        );

        const committed = await executeQuery<ExistingBatchRow[]>(
            `SELECT id, status
             FROM question_import_batches
             WHERE exam_id = ? AND payload_sha256 = ? AND status = 'committed'
             ORDER BY committed_at DESC
             LIMIT 1`,
            [examId, payloadSha256],
        );
        if (committed.length > 0) {
            return NextResponse.json({
                success: false,
                error: 'Isi soal yang identik sudah pernah diimport ke ujian ini. Sistem menolak duplikasi soal.',
                duplicateBatchId: committed[0].id,
            }, { status: 409 });
        }

        const reusable = await executeQuery<ExistingBatchRow[]>(
            `SELECT id, status
             FROM question_import_batches
             WHERE exam_id = ? AND created_by = ? AND payload_sha256 = ?
               AND status = 'previewed' AND expires_at >= UTC_TIMESTAMP()
             ORDER BY created_at DESC
             LIMIT 1`,
            [examId, user.id, payloadSha256],
        );
        const batchId = reusable[0]?.id ?? uuidv4();
        const originalFilename = sanitizeOriginalFilename(file.name);

        if (reusable.length > 0) {
            await executeQuery(
                `UPDATE question_import_batches
                 SET original_filename = ?, file_sha256 = ?, payload_sha256 = ?, template_version = ?,
                     question_count = ?, total_points = ?, payload_json = ?,
                     expires_at = DATE_ADD(UTC_TIMESTAMP(), INTERVAL ${PREVIEW_TTL_HOURS} HOUR)
                 WHERE id = ? AND status = 'previewed'`,
                [
                    originalFilename,
                    parsed.fileSha256,
                    payloadSha256,
                    QUESTION_IMPORT_TEMPLATE_VERSION,
                    parsed.summary.totalQuestions,
                    parsed.summary.totalPoints,
                    payloadJson,
                    batchId,
                ],
            );
        } else {
            await executeQuery(
                `INSERT INTO question_import_batches (
                    id, exam_id, created_by, original_filename, file_sha256, payload_sha256,
                    template_version, status, question_count, total_points, payload_json, expires_at
                 ) VALUES (?, ?, ?, ?, ?, ?, ?, 'previewed', ?, ?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL ${PREVIEW_TTL_HOURS} HOUR))`,
                [
                    batchId,
                    examId,
                    user.id,
                    originalFilename,
                    parsed.fileSha256,
                    payloadSha256,
                    QUESTION_IMPORT_TEMPLATE_VERSION,
                    parsed.summary.totalQuestions,
                    parsed.summary.totalPoints,
                    payloadJson,
                ],
            );
        }

        return NextResponse.json({
            success: true,
            valid: true,
            message: 'Template valid dan siap diimport',
            data: {
                ...buildClientPreview(parsed),
                batchId,
                originalFilename,
                historicalAnswerCount: usage.historicalAnswerCount,
                requiresHistoricalAcknowledgement: usage.historicalAnswerCount > 0,
                expiresInMinutes: PREVIEW_TTL_HOURS * 60,
            },
        });
    } catch (error) {
        logger.error('QUESTION_IMPORT_PREVIEW', 'Gagal memproses preview import soal', error, user.id);
        return NextResponse.json({ success: false, error: 'Gagal memproses file import soal' }, { status: 500 });
    }
}

export const POST = withAuth(handlePost, { allowedRoles: ['admin'] });
