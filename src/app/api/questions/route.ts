import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { executeQuery } from '@/lib/db';
import { questionSchema } from '@/lib/validations/questionSchema';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const examId = searchParams.get('examId');

        const page = parseInt(searchParams.get('page') || '1', 10);
        const limit = parseInt(searchParams.get('limit') || '100', 10); // Default 100 limit for questions to avoid breaking existing exam flows
        const offset = (page - 1) * limit;

        let countQuery = `SELECT COUNT(*) as total FROM questions`;
        const countParams: (string | number)[] = [];

        let query = `SELECT id, exam_id, question_type, text AS question_text, question_image, options_json, correct_option_index, correct_answer, points FROM questions`;
        const params: (string | number)[] = [];

        if (examId) {
            countQuery += ` WHERE exam_id = ?`;
            countParams.push(examId);

            query += ` WHERE exam_id = ? ORDER BY id ASC LIMIT ? OFFSET ?`;
            params.push(examId, limit, offset);
        } else {
            query += ` ORDER BY id DESC LIMIT ? OFFSET ?`;
            params.push(limit, offset);
        }

        const countResult = await executeQuery<{ total: number }[]>(countQuery, countParams);
        const total = countResult[0]?.total || 0;

        const questions = await executeQuery(query, params);

        return NextResponse.json({
            success: true,
            data: questions,
            pagination: { total, page, limit, totalPages: Math.ceil(total / limit) }
        });
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
