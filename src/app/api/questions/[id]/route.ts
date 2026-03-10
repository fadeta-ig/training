import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { executeQuery } from '@/lib/db';

const QUESTION_TYPES = [
    'multiple_choice',
    'multiple_select',
    'true_false',
    'short_answer',
    'essay',
    'matching',
] as const;

const updateQuestionSchema = z.object({
    question_type: z.enum(QUESTION_TYPES, { message: 'Tipe soal tidak valid' }),
    question_text: z.string().min(3, 'Teks pertanyaan minimal 3 karakter'),
    question_image: z.string().nullable().optional(),
    options: z.array(z.object({
        text: z.string(),
        image: z.string().nullable().optional(),
    })).optional(),
    correct_option_index: z.number().int().min(0).optional(),
    correct_option_indices: z.array(z.number().int().min(0)).optional(),
    correct_answer: z.string().optional(),
    matching_pairs: z.array(z.object({
        left: z.string(),
        right: z.string(),
    })).optional(),
    points: z.number().int().min(1).default(1),
}).superRefine((data, ctx) => {
    const t = data.question_type;

    if (t === 'multiple_choice') {
        if (!data.options || data.options.length < 2) {
            ctx.addIssue({ code: 'custom', path: ['options'], message: 'Pilihan ganda membutuhkan minimal 2 opsi' });
        }
        if (data.correct_option_index === undefined || data.correct_option_index === null) {
            ctx.addIssue({ code: 'custom', path: ['correct_option_index'], message: 'Jawaban benar wajib dipilih' });
        }
    }

    if (t === 'multiple_select') {
        if (!data.options || data.options.length < 2) {
            ctx.addIssue({ code: 'custom', path: ['options'], message: 'Multi-jawaban membutuhkan minimal 2 opsi' });
        }
        if (!data.correct_option_indices || data.correct_option_indices.length === 0) {
            ctx.addIssue({ code: 'custom', path: ['correct_option_indices'], message: 'Minimal 1 jawaban benar wajib dipilih' });
        }
    }

    if (t === 'true_false') {
        if (data.correct_option_index === undefined || data.correct_option_index === null) {
            ctx.addIssue({ code: 'custom', path: ['correct_option_index'], message: 'Jawaban benar wajib dipilih' });
        }
    }

    if (t === 'short_answer') {
        if (!data.correct_answer || data.correct_answer.trim().length === 0) {
            ctx.addIssue({ code: 'custom', path: ['correct_answer'], message: 'Kunci jawaban singkat wajib diisi' });
        }
    }

    if (t === 'matching') {
        if (!data.matching_pairs || data.matching_pairs.length < 2) {
            ctx.addIssue({ code: 'custom', path: ['matching_pairs'], message: 'Menjodohkan membutuhkan minimal 2 pasangan' });
        }
    }
});

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
        const parsed = updateQuestionSchema.safeParse(body);

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
