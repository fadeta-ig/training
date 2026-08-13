import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import { questionSchema } from '@/lib/validations/questionSchema';
import { buildQuestionData } from '@/lib/question-helpers';
import { withAuth } from '@/lib/api-auth';

async function handleGet(
    request: NextRequest,
    _user: any,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const resolvedParams = await context.params;
        const questions = await executeQuery(
            `SELECT id, exam_id, question_type, question_text, question_image, options_json, correct_option_index, correct_answer, points, sequence_order FROM questions WHERE id = ?`,
            [resolvedParams.id]
        );

        const data = Array.isArray(questions) ? questions[0] : null;
        if (!data) {
            return NextResponse.json({ success: false, error: 'Soal tidak ditemukan' }, { status: 404 });
        }

        return NextResponse.json({ success: true, data });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Internal Server Error';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

async function handlePut(
    request: NextRequest,
    _user: any,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const resolvedParams = await context.params;
        const body = await request.json();
        const parsed = questionSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { success: false, error: 'Validasi gagal', details: parsed.error.flatten().fieldErrors },
                { status: 400 }
            );
        }

        const {
            exam_id,
            question_type,
            question_text,
            question_image,
            points,
        } = parsed.data;

        const existingQuestion = await executeQuery<{ id: string }[]>(
            `SELECT id FROM questions WHERE id = ? AND exam_id = ? LIMIT 1`,
            [resolvedParams.id, exam_id]
        );

        if (!Array.isArray(existingQuestion) || existingQuestion.length === 0) {
            return NextResponse.json(
                { success: false, error: 'Soal tidak ditemukan pada ujian ini' },
                { status: 404 }
            );
        }

        const { optionsJson, finalCorrectIndex, finalCorrectAnswer } = buildQuestionData(parsed.data);

        await executeQuery(
            `UPDATE questions SET question_type = ?, question_text = ?, question_image = ?, options_json = ?, correct_option_index = ?, correct_answer = ?, points = ? WHERE id = ? AND exam_id = ?`,
            [
                question_type,
                question_text,
                question_image || null,
                optionsJson,
                finalCorrectIndex,
                finalCorrectAnswer,
                points,
                resolvedParams.id,
                exam_id,
            ]
        );

        return NextResponse.json({ success: true, message: 'Soal berhasil diperbarui' });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Internal Server Error';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

async function handleDelete(
    request: NextRequest,
    _user: any,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const resolvedParams = await context.params;

        // Fetch target question to get exam_id for re-normalization
        const targetQuestions = await executeQuery<{ exam_id: string }[]>(
            `SELECT exam_id FROM questions WHERE id = ? LIMIT 1`,
            [resolvedParams.id]
        );

        const examId = Array.isArray(targetQuestions) && targetQuestions.length > 0 ? targetQuestions[0].exam_id : null;

        const result = await executeQuery<{ affectedRows: number }>(
            `DELETE FROM questions WHERE id = ?`,
            [resolvedParams.id]
        );

        if (result && 'affectedRows' in result && result.affectedRows === 0) {
            return NextResponse.json({ success: false, error: 'Soal tidak ditemukan' }, { status: 404 });
        }

        // Re-normalize sequence_order for remaining questions of this exam
        if (examId) {
            const remaining = await executeQuery<{ id: string }[]>(
                `SELECT id FROM questions WHERE exam_id = ? ORDER BY sequence_order ASC, id ASC`,
                [examId]
            );
            if (Array.isArray(remaining)) {
                for (let idx = 0; idx < remaining.length; idx++) {
                    await executeQuery(
                        `UPDATE questions SET sequence_order = ? WHERE id = ?`,
                        [idx + 1, remaining[idx].id]
                    );
                }
            }
        }

        return NextResponse.json({ success: true, message: 'Soal berhasil dihapus' });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Internal Server Error';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

export const GET = withAuth(handleGet, { allowedRoles: ['admin', 'trainer'] });
export const PUT = withAuth(handlePut, { allowedRoles: ['admin'] });
export const DELETE = withAuth(handleDelete, { allowedRoles: ['admin'] });
