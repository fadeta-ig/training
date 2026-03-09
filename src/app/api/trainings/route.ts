import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { executeQuery } from '@/lib/db';

const trainingSchema = z.object({
    title: z.string().min(3, 'Title must be at least 3 characters long').max(150),
    content_html: z.string().min(10, 'Content must not be empty'),
    video_url: z.string().url('Invalid URL format').optional().or(z.literal('')),
});

export async function GET() {
    try {
        const trainings = await executeQuery(
            `SELECT id, title, created_at, updated_at FROM trainings ORDER BY created_at DESC`
        );
        return NextResponse.json({ success: true, data: trainings });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Internal Server Error';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const parsed = trainingSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { success: false, error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
                { status: 400 }
            );
        }

        const { title, content_html, video_url } = parsed.data;
        const trainingId = uuidv4();

        await executeQuery(
            `INSERT INTO trainings (id, title, content_html, video_url) VALUES (?, ?, ?, ?)`,
            [trainingId, title, content_html, video_url || null]
        );

        return NextResponse.json({ success: true, id: trainingId, message: 'Training created' }, { status: 201 });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Internal Server Error';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
