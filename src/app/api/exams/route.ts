import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { executeQuery } from '@/lib/db';
import { examSchema } from '@/lib/validations/examSchema';
import { withAuth } from '@/lib/api-auth';
import { parsePagination } from '@/lib/sanitize';

async function handleGet(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const { page, limit, offset } = parsePagination(searchParams);

        const countResult = await executeQuery<{ total: number }[]>(`SELECT COUNT(*) as total FROM exams`);
        const total = countResult[0]?.total || 0;

        const exams = await executeQuery(
            `SELECT e.id, e.title, e.duration_minutes, e.passing_grade, e.allow_remedial, e.max_attempts, 
                    e.remedial_exam_id, re.title AS remedial_exam_title, e.created_at 
             FROM exams e 
             LEFT JOIN exams re ON e.remedial_exam_id = re.id 
             ORDER BY e.created_at DESC 
             LIMIT ? OFFSET ?`,
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

        const { 
            title, 
            duration_minutes, 
            passing_grade, 
            allow_remedial = false, 
            max_attempts = 1,
            remedial_exam_id = null,
        } = parsed.data;
        const examId = uuidv4();
        const finalRemedialExamId = allow_remedial && remedial_exam_id ? remedial_exam_id : null;

        await executeQuery(
            `INSERT INTO exams (id, title, duration_minutes, passing_grade, allow_remedial, max_attempts, remedial_exam_id) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [examId, title, duration_minutes, passing_grade, allow_remedial, max_attempts, finalRemedialExamId]
        );

        return NextResponse.json({ success: true, id: examId, message: 'Exam created' }, { status: 201 });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Internal Server Error';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

export const GET = withAuth(handleGet, { allowedRoles: ['admin', 'trainer'] });
export const POST = withAuth(handlePost, { allowedRoles: ['admin'] });
