import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { executeQuery } from '@/lib/db';
import { examSchema } from '@/lib/validations/examSchema';
import { withAuth } from '@/lib/api-auth';

async function handleGet(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1', 10);
        const limit = parseInt(searchParams.get('limit') || '10', 10);
        const offset = (page - 1) * limit;

        const countResult = await executeQuery<{ total: number }[]>(`SELECT COUNT(*) as total FROM exams`);
        const total = countResult[0]?.total || 0;

        const exams = await executeQuery(
            `SELECT id, title, duration_minutes, passing_grade, allow_remedial, max_attempts, created_at FROM exams ORDER BY created_at DESC LIMIT ? OFFSET ?`,
            [limit, offset]
        );

        return NextResponse.json({
            success: true,
            data: exams,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Internal Server Error';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

async function handlePost(request: NextRequest) {
    try {
        const body = await request.json();
        const parsed = examSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { success: false, error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
                { status: 400 }
            );
        }

        const { title, duration_minutes, passing_grade, allow_remedial = false, max_attempts = 1 } = parsed.data;
        const examId = uuidv4();

        await executeQuery(
            `INSERT INTO exams (id, title, duration_minutes, passing_grade, allow_remedial, max_attempts) VALUES (?, ?, ?, ?, ?, ?)`,
            [examId, title, duration_minutes, passing_grade, allow_remedial, max_attempts]
        );

        return NextResponse.json({ success: true, id: examId, message: 'Exam created' }, { status: 201 });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Internal Server Error';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

export const GET = withAuth(handleGet, { allowedRoles: ['admin', 'trainer'] });
export const POST = withAuth(handlePost, { allowedRoles: ['admin'] });
