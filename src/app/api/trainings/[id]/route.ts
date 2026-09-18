import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { executeQuery } from '@/lib/db';
import { trainingSchema } from '@/lib/validations/trainingSchema';
import { withAuth } from '@/lib/api-auth';
import type { TrainingMedia } from '@/types';
import { sanitizeRichHtml } from '@/lib/sanitize';
import pool from '@/lib/db';
import { cleanupUnusedUploads } from '@/lib/upload-cleanup';

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
            data: {
                ...result[0],
                content_html: sanitizeRichHtml(result[0].content_html),
                media: media || [],
            }
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
    let connection;
    let removedMediaUrls: string[] = [];
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

        connection = await pool.getConnection();
        await connection.beginTransaction();
        const [existingMedia] = await connection.execute<Array<{ media_url: string }> & any[]>(
            'SELECT media_url FROM training_media WHERE training_id = ? FOR UPDATE',
            [resolvedParams.id],
        );
        removedMediaUrls = existingMedia.map((item) => item.media_url);

        const [result] = await connection.execute<any>(
            `UPDATE trainings SET title = ?, content_html = ? WHERE id = ?`,
            [title, content_html, resolvedParams.id]
        );

        if (result && 'affectedRows' in result && result.affectedRows === 0) {
            await connection.rollback();
            connection.release();
            connection = undefined;
            return NextResponse.json({ success: false, error: 'Training not found' }, { status: 404 });
        }

        // Replace all media: delete old, insert new
        await connection.execute(`DELETE FROM training_media WHERE training_id = ?`, [resolvedParams.id]);

        if (media && media.length > 0) {
            for (let i = 0; i < media.length; i++) {
                const item = media[i];
                await connection.execute(
                    `INSERT INTO training_media (id, training_id, media_type, media_url, original_filename, sequence_order) VALUES (?, ?, ?, ?, ?, ?)`,
                    [uuidv4(), resolvedParams.id, item.media_type, item.media_url, item.original_filename || null, i]
                );
            }
        }

        await connection.commit();
        connection.release();
        connection = undefined;
        const retainedUrls = new Set((media || []).map((item) => item.media_url));
        await cleanupUnusedUploads(removedMediaUrls.filter((url) => !retainedUrls.has(url)));

        return NextResponse.json({ success: true, message: 'Training updated' });
    } catch {
        if (connection) {
            await connection.rollback();
            connection.release();
        }
        return NextResponse.json({ success: false, error: 'Gagal memperbarui materi pelatihan' }, { status: 500 });
    }
}

async function handleDelete(
    request: NextRequest,
    _user: any,
    context: { params: Promise<{ id: string }> }
) {
    let connection;
    let mediaUrls: string[] = [];
    try {
        const resolvedParams = await context.params;

        connection = await pool.getConnection();
        await connection.beginTransaction();
        const [usageRows] = await connection.execute<Array<{ total: number | string }> & any[]>(
            `SELECT COUNT(*) AS total FROM module_items
             WHERE item_type = 'training' AND item_id = ?`,
            [resolvedParams.id],
        );
        if (Number(usageRows[0]?.total || 0) > 0) {
            await connection.rollback();
            connection.release();
            connection = undefined;
            return NextResponse.json(
                { success: false, error: 'Materi yang masih digunakan dalam modul tidak dapat dihapus' },
                { status: 409 },
            );
        }
        const [mediaRows] = await connection.execute<Array<{ media_url: string }> & any[]>(
            'SELECT media_url FROM training_media WHERE training_id = ? FOR UPDATE',
            [resolvedParams.id],
        );
        mediaUrls = mediaRows.map((item) => item.media_url);
        const [result] = await connection.execute<any>('DELETE FROM trainings WHERE id = ?', [resolvedParams.id]);

        if (result && 'affectedRows' in result && result.affectedRows === 0) {
            await connection.rollback();
            connection.release();
            connection = undefined;
            return NextResponse.json({ success: false, error: 'Training not found' }, { status: 404 });
        }

        await connection.commit();
        connection.release();
        connection = undefined;
        await cleanupUnusedUploads(mediaUrls);

        return NextResponse.json({ success: true, message: 'Training deleted' });
    } catch {
        if (connection) {
            await connection.rollback();
            connection.release();
        }
        return NextResponse.json({ success: false, error: 'Gagal menghapus materi pelatihan' }, { status: 500 });
    }
}

export const GET = withAuth(handleGet, { allowedRoles: ['admin', 'trainer'] });
export const PUT = withAuth(handlePut, { allowedRoles: ['admin'] });
export const DELETE = withAuth(handleDelete, { allowedRoles: ['admin'] });
