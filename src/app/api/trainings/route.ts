import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { executeQuery } from '@/lib/db';
import { trainingSchema } from '@/lib/validations/trainingSchema';
import { withAuth } from '@/lib/api-auth';
import { parsePagination } from '@/lib/sanitize';
import pool from '@/lib/db';

async function handleGet(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const { page, limit, offset } = parsePagination(searchParams);

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

/**
 * Inserts media rows into `training_media` for a given training.
 * Reusable for both POST (create) and PUT (update) flows.
 */
async function insertMediaItems(
    connection: import('mysql2/promise').PoolConnection,
    trainingId: string,
    media: Array<{ media_type: string; media_url: string; original_filename?: string }>
): Promise<void> {
    for (let i = 0; i < media.length; i++) {
        const item = media[i];
        await connection.execute(
            `INSERT INTO training_media (id, training_id, media_type, media_url, original_filename, sequence_order) VALUES (?, ?, ?, ?, ?, ?)`,
            [uuidv4(), trainingId, item.media_type, item.media_url, item.original_filename || null, i]
        );
    }
}

async function handlePost(request: NextRequest) {
    let connection;
    try {
        const body = await request.json();
        const parsed = trainingSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { success: false, error: 'Validation failed', details: parsed.error.issues },
                { status: 400 }
            );
        }

        const { title, content_html, media } = parsed.data;
        const trainingId = uuidv4();

        connection = await pool.getConnection();
        await connection.beginTransaction();
        await connection.execute(
            `INSERT INTO trainings (id, title, content_html) VALUES (?, ?, ?)`,
            [trainingId, title, content_html]
        );

        if (media && media.length > 0) {
            await insertMediaItems(connection, trainingId, media);
        }

        await connection.commit();
        connection.release();
        connection = undefined;

        return NextResponse.json({ success: true, id: trainingId, message: 'Training created' }, { status: 201 });
    } catch {
        if (connection) {
            await connection.rollback();
            connection.release();
        }
        return NextResponse.json({ success: false, error: 'Gagal membuat materi pelatihan' }, { status: 500 });
    }
}

export const GET = withAuth(handleGet, { allowedRoles: ['admin', 'trainer'] });
export const POST = withAuth(handlePost, { allowedRoles: ['admin'] });
