import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { executeQuery } from '@/lib/db';

const examSchema = z.object({
    title: z.string().min(3).max(150),
    duration_minutes: z.number().int().min(10).max(300),
    passing_grade: z.number().min(0).max(100),
});

export async function GET() {
    try {
        const exams = await executeQuery(
            `SELECT id, title, duration_minutes, passing_grade, created_at FROM exams ORDER BY created_at DESC`
        );
        return NextResponse.json({ success: true, data: exams });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Internal Server Error';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const parsed = examSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { success: false, error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
                { status: 400 }
            );
        }

        const { title, duration_minutes, passing_grade } = parsed.data;
        const examId = uuidv4();

        await executeQuery(
            `INSERT INTO exams (id, title, duration_minutes, passing_grade) VALUES (?, ?, ?, ?)`,
            [examId, title, duration_minutes, passing_grade]
        );

        return NextResponse.json({ success: true, id: examId, message: 'Exam created' }, { status: 201 });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Internal Server Error';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
