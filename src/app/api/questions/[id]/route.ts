import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import { questionSchema } from '@/lib/validations/questionSchema';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const resolvedParams = await params;
        const questions = await executeQuery(
            `SELECT id, exam_id, question_type, text AS question_text, question_image, options_json, correct_option_index, correct_answer, points FROM questions WHERE id = ?`,
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

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const resolvedParams = await params;
        const body = await request.json();
        const parsed = questionSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { success: false, error: 'Validasi gagal', details: parsed.error.flatten().fieldErrors },
                { status: 400 }
            );
        }

        const {
            question_type,
            question_text,
            question_image,
            options,
            correct_option_index,
            correct_option_indices,
            correct_answer,
            matching_pairs,
            points,
        } = parsed.data;

        let optionsJson: string | null = null;
        let finalCorrectIndex: number | null = null;
        let finalCorrectAnswer: string | null = null;

        switch (question_type) {
            case 'multiple_choice':
                optionsJson = JSON.stringify(options);
                finalCorrectIndex = correct_option_index ?? null;
                break;
            case 'multiple_select':
                optionsJson = JSON.stringify({ options, correct_indices: correct_option_indices });
                break;
            case 'true_false':
                optionsJson = JSON.stringify([
                    { text: 'Benar', image: null },
                    { text: 'Salah', image: null },
                ]);
                finalCorrectIndex = correct_option_index ?? null;
                break;
            case 'short_answer':
                finalCorrectAnswer = correct_answer ?? null;
                break;
            case 'essay':
                break;
            case 'matching':
                optionsJson = JSON.stringify({ pairs: matching_pairs });
                break;
        }

        const result = await executeQuery<{ affectedRows: number }>(
            `UPDATE questions SET question_type = ?, text = ?, question_image = ?, options_json = ?, correct_option_index = ?, correct_answer = ?, points = ? WHERE id = ?`,
            [
                question_type,
                question_text,
                question_image || null,
                optionsJson,
                finalCorrectIndex,
                finalCorrectAnswer,
                points,
                resolvedParams.id,
            ]
        );

        if (result && 'affectedRows' in result && result.affectedRows === 0) {
            return NextResponse.json({ success: false, error: 'Soal tidak ditemukan' }, { status: 404 });
        }

        return NextResponse.json({ success: true, message: 'Soal berhasil diperbarui' });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Internal Server Error';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const resolvedParams = await params;

        const result = await executeQuery<{ affectedRows: number }>(
            `DELETE FROM questions WHERE id = ?`,
            [resolvedParams.id]
        );

        if (result && 'affectedRows' in result && result.affectedRows === 0) {
            return NextResponse.json({ success: false, error: 'Soal tidak ditemukan' }, { status: 404 });
        }

        return NextResponse.json({ success: true, message: 'Soal berhasil dihapus' });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Internal Server Error';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
