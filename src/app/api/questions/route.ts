import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { executeQuery } from '@/lib/db';

const questionSchema = z.object({
    exam_id: z.string().uuid('Invalid Exam ID'),
    question_text: z.string().min(5, 'Question text is required'),
    options: z.array(z.string()).min(2, 'At least 2 options are required').max(10),
    correct_option_index: z.number().int().min(0, 'Invalid option index')
}).refine(data => data.correct_option_index < data.options.length, {
    message: 'Correct option index must be within the options bounds',
    path: ['correct_option_index']
});

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const examId = searchParams.get('examId');

        let query = `SELECT id, exam_id, question_text, options_json, correct_option_index, created_at FROM questions`;
        let params: any[] = [];

        if (examId) {
            query += ` WHERE exam_id = ? ORDER BY created_at ASC`;
            params.push(examId);
        } else {
            query += ` ORDER BY created_at DESC`;
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
                { success: false, error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
                { status: 400 }
            );
        }

        const { exam_id, question_text, options, correct_option_index } = parsed.data;

        // Verify if exam exists
        const examCheck = await executeQuery<{ id: string }[]>(`SELECT id FROM exams WHERE id = ?`, [exam_id]);
        if (!Array.isArray(examCheck) || examCheck.length === 0) {
            return NextResponse.json({ success: false, error: 'Exam not found' }, { status: 404 });
        }

        const questionId = uuidv4();
        const optionsJson = JSON.stringify(options);

        await executeQuery(
            `INSERT INTO questions (id, exam_id, question_text, options_json, correct_option_index) VALUES (?, ?, ?, ?, ?)`,
            [questionId, exam_id, question_text, optionsJson, correct_option_index]
        );

        return NextResponse.json({ success: true, id: questionId, message: 'Question added' }, { status: 201 });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Internal Server Error';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
