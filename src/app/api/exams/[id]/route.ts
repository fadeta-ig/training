import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import { examSchema } from '@/lib/validations/examSchema';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const resolvedParams = await params;
        const result = await executeQuery<any[]>(
            `SELECT * FROM exams WHERE id = ?`,
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

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const resolvedParams = await params;
        const body = await request.json();
        const parsed = examSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { success: false, error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
                { status: 400 }
            );
        }

        const { title, duration_minutes, passing_grade } = parsed.data;

        const result = await executeQuery<{ affectedRows: number }>(
            `UPDATE exams SET title = ?, duration_minutes = ?, passing_grade = ? WHERE id = ?`,
            [title, duration_minutes, passing_grade, resolvedParams.id]
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

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const resolvedParams = await params;

        // ON DELETE CASCADE will handle questions and module_items
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
