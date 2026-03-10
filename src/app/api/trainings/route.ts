import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { executeQuery } from '@/lib/db';
import { trainingSchema } from '@/lib/validations/trainingSchema';
import { withAuth } from '@/lib/api-auth';

async function handleGet(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1', 10);
        const limit = parseInt(searchParams.get('limit') || '10', 10);
        const offset = (page - 1) * limit;

        const countResult = await executeQuery<{ total: number }[]>(`SELECT COUNT(*) as total FROM trainings`);
        const total = countResult[0]?.total || 0;

        const trainings = await executeQuery(
            `SELECT id, title, created_at, updated_at FROM trainings ORDER BY created_at DESC LIMIT ? OFFSET ?`,
            [limit, offset]
        );

        return NextResponse.json({
            success: true,
            data: trainings,
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

export const GET = withAuth(handleGet, { allowedRoles: ['admin'] });
export const POST = withAuth(handlePost, { allowedRoles: ['admin'] });
