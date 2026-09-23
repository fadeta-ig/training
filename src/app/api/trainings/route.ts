import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { executeQuery } from '@/lib/db';
import { trainingSchema } from '@/lib/validations/trainingSchema';
import { withAuth, type AuthenticatedUser } from '@/lib/api-auth';
import { parsePagination } from '@/lib/sanitize';
import { resolveUserCategoryScope } from '@/lib/data-scoping';
import pool from '@/lib/db';

async function handleGet(request: NextRequest, user: AuthenticatedUser) {
    try {
        const { searchParams } = new URL(request.url);
        const { page, limit, offset } = parsePagination(searchParams);
        const search = searchParams.get('search')?.trim() || searchParams.get('q')?.trim() || '';
        const categoryId = searchParams.get('category_id') || 'all';
        const mediaType = searchParams.get('media_type') || 'all';
        const usage = searchParams.get('usage') || 'all';
        const sort = searchParams.get('sort') || 'created_desc';

        const conditions: string[] = [];
        const conditionParams: (string | number)[] = [];

        // Scoping per role: Trainer hanya melihat kategori yang di-assign
        const scope = await resolveUserCategoryScope(user, 't');
        if (scope.sqlCondition) {
            conditions.push(scope.sqlCondition.replace(/^\s*AND\s*/i, ''));
            conditionParams.push(...scope.params);
        }

        if (categoryId === 'uncategorized' || categoryId === 'none') {
            conditions.push(`(t.category_id IS NULL OR t.category_id = '')`);
        } else if (categoryId !== 'all' && categoryId) {
            conditions.push(`t.category_id = ?`);
            conditionParams.push(categoryId);
        }

        if (search) {
            conditions.push(`(t.title LIKE ? OR lc.name LIKE ? OR lc.code LIKE ?)`);
            conditionParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        if (mediaType === 'video') {
            conditions.push(`EXISTS (SELECT 1 FROM training_media tm WHERE tm.training_id = t.id AND tm.media_type = 'video')`);
        } else if (mediaType === 'document') {
            conditions.push(`EXISTS (SELECT 1 FROM training_media tm WHERE tm.training_id = t.id AND tm.media_type IN ('document', 'pdf'))`);
        } else if (mediaType === 'none') {
            conditions.push(`NOT EXISTS (SELECT 1 FROM training_media tm WHERE tm.training_id = t.id)`);
        }

        if (usage === 'in_module') {
            conditions.push(`EXISTS (SELECT 1 FROM module_items mi WHERE mi.item_id = t.id AND mi.item_type = 'training')`);
        } else if (usage === 'standalone') {
            conditions.push(`NOT EXISTS (SELECT 1 FROM module_items mi WHERE mi.item_id = t.id AND mi.item_type = 'training')`);
        }

        const whereClause = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';

        const SORT_MAP: Record<string, string> = {
            created_desc: 't.created_at DESC',
            created_asc: 't.created_at ASC',
            title_asc: 't.title ASC',
            title_desc: 't.title DESC',
            updated_desc: 't.updated_at DESC',
        };
        const orderClause = SORT_MAP[sort] || 't.created_at DESC';

        const countResult = await executeQuery<{ total: number }[]>(
            `SELECT COUNT(*) as total 
             FROM trainings t
             LEFT JOIN learning_categories lc ON t.category_id = lc.id
             ${whereClause}`,
            conditionParams
        );
        const total = countResult[0]?.total || 0;

        const trainings = await executeQuery(
            `SELECT t.id, t.category_id, lc.name AS category_name, lc.code AS category_code, lc.color AS category_color,
                    t.title, t.created_at, t.updated_at,
                    (SELECT COUNT(*) FROM training_media tm WHERE tm.training_id = t.id) AS media_count,
                    (SELECT COUNT(*) FROM module_items mi WHERE mi.item_id = t.id AND mi.item_type = 'training') AS module_count
             FROM trainings t
             LEFT JOIN learning_categories lc ON t.category_id = lc.id
             ${whereClause}
             ORDER BY ${orderClause}
             LIMIT ? OFFSET ?`,
            [...conditionParams, limit, offset]
        );

        return NextResponse.json({
            success: true,
            data: trainings,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Internal Server Error';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

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

        const { category_id, title, content_html, media } = parsed.data;
        const trainingId = uuidv4();

        connection = await pool.getConnection();
        await connection.beginTransaction();
        await connection.execute(
            `INSERT INTO trainings (id, category_id, title, content_html) VALUES (?, ?, ?, ?)`,
            [trainingId, category_id || null, title, content_html]
        );

        if (media && media.length > 0) {
            await insertMediaItems(connection, trainingId, media);
        }

        await connection.commit();
        connection.release();
        connection = undefined;

        return NextResponse.json({ success: true, id: trainingId, message: 'Materi berhasil dibuat' }, { status: 201 });
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
