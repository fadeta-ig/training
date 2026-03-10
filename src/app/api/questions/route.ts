import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { executeQuery } from '@/lib/db';

/** Supported question types for the modular bank soal */
const QUESTION_TYPES = [
    'multiple_choice',
    'multiple_select',
    'true_false',
    'short_answer',
    'essay',
    'matching',
] as const;

type QuestionType = (typeof QUESTION_TYPES)[number];

/**
 * Base schema with shared fields, then refined per question type.
 * This approach avoids deeply nested discriminated unions.
 */
const questionSchema = z.object({
    exam_id: z.string().uuid('ID Ujian tidak valid'),
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
        } else if (data.options && data.correct_option_index >= data.options.length) {
            ctx.addIssue({ code: 'custom', path: ['correct_option_index'], message: 'Index jawaban benar melebihi jumlah opsi' });
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
            ctx.addIssue({ code: 'custom', path: ['correct_option_index'], message: 'Jawaban benar wajib dipilih (0=Benar, 1=Salah)' });
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

    // 'essay' has no specific validation — graded manually
});

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const examId = searchParams.get('examId');

        let query = `SELECT id, exam_id, question_type, text AS question_text, question_image, options_json, correct_option_index, correct_answer, points FROM questions`;
        const params: (string | number)[] = [];

        if (examId) {
            query += ` WHERE exam_id = ? ORDER BY id ASC`;
            params.push(examId);
        } else {
            query += ` ORDER BY id DESC`;
        }

        const questions = await executeQuery(query, params);
        return NextResponse.json({ success: true, data: questions });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Internal Server Error';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
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
            options,
            correct_option_index,
            correct_option_indices,
            correct_answer,
            matching_pairs,
            points,
        } = parsed.data;

        // Verify exam exists
        const examCheck = await executeQuery<{ id: string }[]>(`SELECT id FROM exams WHERE id = ?`, [exam_id]);
        if (!Array.isArray(examCheck) || examCheck.length === 0) {
            return NextResponse.json({ success: false, error: 'Ujian tidak ditemukan' }, { status: 404 });
        }

        const questionId = uuidv4();

        // Build options_json based on type
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
                // No auto-grading
                break;
            case 'matching':
                optionsJson = JSON.stringify({ pairs: matching_pairs });
                break;
        }

        await executeQuery(
            `INSERT INTO questions (id, exam_id, question_type, text, question_image, options_json, correct_option_index, correct_answer, points) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                questionId,
                exam_id,
                question_type,
                question_text,
                question_image || null,
                optionsJson,
                finalCorrectIndex,
                finalCorrectAnswer,
                points,
            ]
        );

        return NextResponse.json({ success: true, id: questionId, message: 'Soal berhasil ditambahkan' }, { status: 201 });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Internal Server Error';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
