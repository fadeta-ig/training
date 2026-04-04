import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { executeQuery } from '@/lib/db';
import { trainingSchema } from '@/lib/validations/trainingSchema';
import { withAuth } from '@/lib/api-auth';
import type { TrainingMedia } from '@/types';

async function handleGet(
    request: NextRequest,
    _user: any,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const resolvedParams = await context.params;
        const result = await executeQuery<any[]>(
            `SELECT id, title, content_html, created_at, updated_at FROM trainings WHERE id = ?`,
            [resolvedParams.id]
        );

        if (!result || result.length === 0) {
            return NextResponse.json({ success: false, error: 'Training not found' }, { status: 404 });
        }

        const media = await executeQuery<TrainingMedia[]>(
            `SELECT id, training_id, media_type, media_url, original_filename, sequence_order, created_at FROM training_media WHERE training_id = ? ORDER BY sequence_order ASC`,
            [resolvedParams.id]
        );

        return NextResponse.json({
            success: true,
            data: { ...result[0], media: media || [] }
        });
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
        const parsed = trainingSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { success: false, error: 'Validation failed', details: parsed.error.issues },
                { status: 400 }
            );
        }

        const { title, content_html, media } = parsed.data;

        const result = await executeQuery<{ affectedRows: number }>(
            `UPDATE trainings SET title = ?, content_html = ? WHERE id = ?`,
            [title, content_html, resolvedParams.id]
        );

        if (result && 'affectedRows' in result && result.affectedRows === 0) {
            return NextResponse.json({ success: false, error: 'Training not found' }, { status: 404 });
        }

        // Replace all media: delete old, insert new
        await executeQuery(`DELETE FROM training_media WHERE training_id = ?`, [resolvedParams.id]);

        if (media && media.length > 0) {
            for (let i = 0; i < media.length; i++) {
                const item = media[i];
                await executeQuery(
                    `INSERT INTO training_media (id, training_id, media_type, media_url, original_filename, sequence_order) VALUES (?, ?, ?, ?, ?, ?)`,
                    [uuidv4(), resolvedParams.id, item.media_type, item.media_url, item.original_filename || null, i]
                );
            }
        }

        return NextResponse.json({ success: true, message: 'Training updated' });
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

export const GET = withAuth(handleGet, { allowedRoles: ['admin', 'trainer'] });
export const PUT = withAuth(handlePut, { allowedRoles: ['admin'] });
export const DELETE = withAuth(handleDelete, { allowedRoles: ['admin'] });
