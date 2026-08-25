import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import { examSchema } from '@/lib/validations/examSchema';
import { withAuth } from '@/lib/api-auth';

async function handleGet(
    request: NextRequest,
    _user: any,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const resolvedParams = await context.params;
        const result = await executeQuery<any[]>(
            `SELECT e.*, re.title AS remedial_exam_title 
             FROM exams e 
             LEFT JOIN exams re ON e.remedial_exam_id = re.id 
             WHERE e.id = ?`,
            [resolvedParams.id]
        );

        if (!result || result.length === 0) {
            return NextResponse.json({ success: false, error: 'Exam not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true, data: result[0] });
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

        // Prevent self-reference
        if (remedial_exam_id && remedial_exam_id === resolvedParams.id) {
            return NextResponse.json(
                { success: false, error: 'Paket ujian remedial tidak boleh merujuk ke ujian ini sendiri' },
                { status: 400 }
            );
        }

        const finalRemedialExamId = allow_remedial && remedial_exam_id ? remedial_exam_id : null;

        const result = await executeQuery<{ affectedRows: number }>(
            `UPDATE exams SET title = ?, duration_minutes = ?, passing_grade = ?, allow_remedial = ?, max_attempts = ?, remedial_exam_id = ? WHERE id = ?`,
            [title, duration_minutes, passing_grade, allow_remedial, max_attempts, finalRemedialExamId, resolvedParams.id]
        );

        if (result && 'affectedRows' in result && result.affectedRows === 0) {
            return NextResponse.json({ success: false, error: 'Exam not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true, message: 'Exam updated' });
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

        const result = await executeQuery<{ affectedRows: number }>(
            `DELETE FROM exams WHERE id = ?`,
            [resolvedParams.id]
        );

        if (result && 'affectedRows' in result && result.affectedRows === 0) {
            return NextResponse.json({ success: false, error: 'Exam not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true, message: 'Exam deleted' });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Internal Server Error';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

export const GET = withAuth(handleGet, { allowedRoles: ['admin', 'trainer'] });
export const PUT = withAuth(handlePut, { allowedRoles: ['admin'] });
export const DELETE = withAuth(handleDelete, { allowedRoles: ['admin'] });
