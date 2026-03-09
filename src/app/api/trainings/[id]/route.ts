import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { executeQuery } from '@/lib/db';

const updateTrainingSchema = z.object({
    title: z.string().min(3, 'Title must be at least 3 characters long').max(150),
    content_html: z.string().min(10, 'Content must not be empty'),
    video_url: z.string().url('Invalid URL format').optional().or(z.literal('')),
});

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const resolvedParams = await params;
        const result = await executeQuery<any[]>(
            `SELECT * FROM trainings WHERE id = ?`,
            [resolvedParams.id]
        );

        if (!result || result.length === 0) {
            return NextResponse.json({ success: false, error: 'Training not found' }, { status: 404 });
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
        const parsed = updateTrainingSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { success: false, error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
                { status: 400 }
            );
        }

        const { title, content_html, video_url } = parsed.data;

        const result = await executeQuery<{ affectedRows: number }>(
            `UPDATE trainings SET title = ?, content_html = ?, video_url = ? WHERE id = ?`,
            [title, content_html, video_url || null, resolvedParams.id]
        );

        if (result && 'affectedRows' in result && result.affectedRows === 0) {
            return NextResponse.json({ success: false, error: 'Training not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true, message: 'Training updated' });
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

        // ON DELETE CASCADE handles related module_items and progress links
        const result = await executeQuery<{ affectedRows: number }>(
            `DELETE FROM trainings WHERE id = ?`,
            [resolvedParams.id]
        );

        if (result && 'affectedRows' in result && result.affectedRows === 0) {
            return NextResponse.json({ success: false, error: 'Training not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true, message: 'Training deleted' });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Internal Server Error';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
