import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { executeQuery } from '@/lib/db';
import { withAuth, type AuthenticatedUser } from '@/lib/api-auth';
import { categorySchema } from '@/lib/validations/categorySchema';
import { parsePagination } from '@/lib/sanitize';
import { getTrainerCategoryIds } from '@/lib/data-scoping';
import pool from '@/lib/db';

async function handleGet(request: NextRequest, user: AuthenticatedUser) {
    try {
        const { searchParams } = new URL(request.url);
        const { page, limit, offset } = parsePagination(searchParams);
        const search = searchParams.get('search')?.trim() || '';
        const status = searchParams.get('status') || 'all'; // 'all' | 'active' | 'inactive'
        const sort = searchParams.get('sort') || 'created_desc';
        const allList = searchParams.get('all') === 'true'; // return all for dropdown

        const conditions: string[] = [];
        const conditionParams: (string | number)[] = [];

        // Scoping: Jika trainer, hanya tampilkan kategori yang di-assign padanya
        if (user.role === 'trainer') {
            const assignedIds = await getTrainerCategoryIds(user.id);
            if (assignedIds.length === 0) {
                return NextResponse.json({
                    success: true,
                    data: [],
                    pagination: { total: 0, page: 1, limit, totalPages: 0 },
                });
            }
            const placeholders = assignedIds.map(() => '?').join(',');
            conditions.push(`lc.id IN (${placeholders})`);
            conditionParams.push(...assignedIds);
        }

        if (search) {
            conditions.push(`(lc.name LIKE ? OR lc.code LIKE ? OR lc.description LIKE ?)`);
            conditionParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        if (status === 'active') {
            conditions.push(`lc.is_active = 1`);
        } else if (status === 'inactive') {
            conditions.push(`lc.is_active = 0`);
        }

        const whereClause = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';

        // Jika request parameter `all=true`, kembalikan seluruh daftar tanpa pagination (untuk select dropdown)
        if (allList) {
            const categories = await executeQuery(
                `SELECT lc.id, lc.name, lc.code, lc.color, lc.is_active
                 FROM learning_categories lc
                 ${whereClause}
                 ORDER BY lc.name ASC`,
                conditionParams
            );
            return NextResponse.json({ success: true, data: categories });
        }

        const countResult = await executeQuery<{ total: number }[]>(
            `SELECT COUNT(*) as total FROM learning_categories lc ${whereClause}`,
            conditionParams
        );
        const total = countResult[0]?.total || 0;

        let orderByClause = 'ORDER BY lc.created_at DESC';
        switch (sort) {
            case 'created_asc':
                orderByClause = 'ORDER BY lc.created_at ASC';
                break;
            case 'name_asc':
                orderByClause = 'ORDER BY lc.name ASC';
                break;
            case 'name_desc':
                orderByClause = 'ORDER BY lc.name DESC';
                break;
            case 'trainers_desc':
                orderByClause = 'ORDER BY trainer_count DESC, lc.name ASC';
                break;
            case 'items_desc':
                orderByClause = 'ORDER BY (training_count + exam_count + module_count) DESC, lc.name ASC';
                break;
            case 'created_desc':
            default:
                orderByClause = 'ORDER BY lc.created_at DESC';
                break;
        }

        const categories = await executeQuery(
            `SELECT lc.id, lc.name, lc.code, lc.description, lc.color, lc.is_active, lc.created_at, lc.updated_at,
                    (SELECT COUNT(*) FROM category_trainers ct WHERE ct.category_id = lc.id) AS trainer_count,
                    (SELECT COUNT(*) FROM trainings t WHERE t.category_id = lc.id) AS training_count,
                    (SELECT COUNT(*) FROM exams e WHERE e.category_id = lc.id) AS exam_count,
                    (SELECT COUNT(*) FROM modules m WHERE m.category_id = lc.id) AS module_count
             FROM learning_categories lc
             ${whereClause}
             ${orderByClause}
             LIMIT ? OFFSET ?`,
            [...conditionParams, limit, offset]
        );

        return NextResponse.json({
            success: true,
            data: categories,
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

async function handlePost(request: NextRequest, user: AuthenticatedUser) {
    let connection;
    try {
        const body = await request.json();
        const parsed = categorySchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { success: false, error: 'Validasi form gagal', details: parsed.error.flatten().fieldErrors },
                { status: 400 }
            );
        }

        const { name, code, description, color, is_active, trainer_ids } = parsed.data;

        // Cek keunikan kode
        const existing = await executeQuery<{ id: string }[]>(
            `SELECT id FROM learning_categories WHERE code = ? LIMIT 1`,
            [code]
        );
        if (existing.length > 0) {
            return NextResponse.json(
                { success: false, error: `Kode kategori "${code}" sudah digunakan` },
                { status: 409 }
            );
        }

        const categoryId = uuidv4();
        connection = await pool.getConnection();
        await connection.beginTransaction();

        await connection.execute(
            `INSERT INTO learning_categories (id, name, code, description, color, is_active, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [categoryId, name, code, description || null, color, is_active ? 1 : 0, user.id]
        );

        // Jika ada trainer_ids yang di-assign langsung saat pembuatan
        if (trainer_ids && trainer_ids.length > 0) {
            for (const trainerId of trainer_ids) {
                await connection.execute(
                    `INSERT INTO category_trainers (id, category_id, trainer_id, assigned_by)
                     VALUES (?, ?, ?, ?)`,
                    [uuidv4(), categoryId, trainerId, user.id]
                );
            }
        }

        await connection.commit();
        connection.release();
        connection = undefined;

        return NextResponse.json(
            { success: true, id: categoryId, message: 'Kategori pembelajaran berhasil dibuat' },
            { status: 201 }
        );
    } catch (error) {
        if (connection) {
            await connection.rollback();
            connection.release();
        }
        const message = error instanceof Error ? error.message : 'Internal Server Error';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

export const GET = withAuth(handleGet, { allowedRoles: ['admin', 'trainer'] });
export const POST = withAuth(handlePost, { allowedRoles: ['admin'] });
