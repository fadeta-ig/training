import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { executeQuery } from '@/lib/db';
import pool from '@/lib/db';
import { moduleSchema } from '@/lib/validations/moduleSchema';
import { withAuth, type AuthenticatedUser } from '@/lib/api-auth';
import { parsePagination } from '@/lib/sanitize';
import { assertModuleItemReferences } from '@/lib/module-items';
import { resolveUserCategoryScope } from '@/lib/data-scoping';

async function handleGet(request: NextRequest, user: AuthenticatedUser) {
    try {
        const { searchParams } = new URL(request.url);
        const { page, limit, offset } = parsePagination(searchParams);
        const search = searchParams.get('search')?.trim() || searchParams.get('q')?.trim() || '';
        const categoryId = searchParams.get('category_id') || 'all';
        const sequence = searchParams.get('sequence') || 'all';
        const composition = searchParams.get('composition') || 'all';
        const sort = searchParams.get('sort') || 'created_desc';

        const conditions: string[] = [];
        const conditionParams: (string | number)[] = [];

        // Scoping per role: Trainer hanya melihat modul di kategori yang di-assign
        const scope = await resolveUserCategoryScope(user, 'm');
        if (scope.sqlCondition) {
            conditions.push(scope.sqlCondition.replace(/^\s*AND\s*/i, ''));
            conditionParams.push(...scope.params);
        }

        if (categoryId !== 'all' && categoryId) {
            conditions.push(`m.category_id = ?`);
            conditionParams.push(categoryId);
        }

        if (search) {
            conditions.push(`(m.title LIKE ? OR m.description LIKE ? OR lc.name LIKE ? OR lc.code LIKE ?)`);
            conditionParams.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
        }

        if (sequence === 'enforced') {
            conditions.push(`m.enforce_sequence = 1`);
        } else if (sequence === 'free') {
            conditions.push(`(m.enforce_sequence = 0 OR m.enforce_sequence IS NULL)`);
        }

        if (composition === 'complete') {
            conditions.push(`EXISTS (SELECT 1 FROM module_items mi WHERE mi.module_id = m.id AND mi.item_type = 'training') AND EXISTS (SELECT 1 FROM module_items mi WHERE mi.module_id = m.id AND mi.item_type = 'exam')`);
        } else if (composition === 'training_only') {
            conditions.push(`EXISTS (SELECT 1 FROM module_items mi WHERE mi.module_id = m.id AND mi.item_type = 'training') AND NOT EXISTS (SELECT 1 FROM module_items mi WHERE mi.module_id = m.id AND mi.item_type = 'exam')`);
        } else if (composition === 'exam_only') {
            conditions.push(`EXISTS (SELECT 1 FROM module_items mi WHERE mi.module_id = m.id AND mi.item_type = 'exam') AND NOT EXISTS (SELECT 1 FROM module_items mi WHERE mi.module_id = m.id AND mi.item_type = 'training')`);
        } else if (composition === 'empty') {
            conditions.push(`NOT EXISTS (SELECT 1 FROM module_items mi WHERE mi.module_id = m.id)`);
        }

        const whereClause = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';

        const SORT_MAP: Record<string, string> = {
            created_desc: 'm.created_at DESC',
            created_asc: 'm.created_at ASC',
            title_asc: 'm.title ASC',
            title_desc: 'm.title DESC',
            items_desc: 'item_count DESC, m.title ASC',
        };
        const orderClause = SORT_MAP[sort] || 'm.created_at DESC';

        const countResult = await executeQuery<{ total: number }[]>(
            `SELECT COUNT(*) as total 
             FROM modules m
             LEFT JOIN learning_categories lc ON m.category_id = lc.id
             ${whereClause}`,
            conditionParams
        );
        const total = countResult[0]?.total || 0;

        const modules = await executeQuery(
            `SELECT m.id, m.category_id, lc.name AS category_name, lc.code AS category_code, lc.color AS category_color,
                    m.title, m.description, m.enforce_sequence, m.created_at,
                    (SELECT COUNT(*) FROM module_items mi WHERE mi.module_id = m.id) AS item_count,
                    (SELECT COUNT(*) FROM module_items mi WHERE mi.module_id = m.id AND mi.item_type = 'training') AS training_count,
                    (SELECT COUNT(*) FROM module_items mi WHERE mi.module_id = m.id AND mi.item_type = 'exam') AS exam_count,
                    (SELECT COUNT(*) FROM sessions s WHERE s.module_id = m.id) AS session_count
             FROM modules m
             LEFT JOIN learning_categories lc ON m.category_id = lc.id
             ${whereClause}
             ORDER BY ${orderClause}
             LIMIT ? OFFSET ?`,
            [...conditionParams, limit, offset]
        );

        return NextResponse.json({
            success: true,
            data: modules,
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
    let connection;
    try {
        const body = await request.json();
        const parsed = moduleSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { success: false, error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
                { status: 400 }
            );
        }

        const { category_id, title, description, enforce_sequence, items } = parsed.data;
        const moduleId = uuidv4();

        connection = await pool.getConnection();
        await connection.beginTransaction();

        await connection.execute(
            `INSERT INTO modules (id, category_id, title, description, enforce_sequence) VALUES (?, ?, ?, ?, ?)`,
            [moduleId, category_id || null, title, description || null, enforce_sequence ? 1 : 0]
        );

        await assertModuleItemReferences(connection, items);

        for (const item of items) {
            const itemId = uuidv4();
            await connection.execute(
                `INSERT INTO module_items (id, module_id, item_type, item_id, sequence_order) VALUES (?, ?, ?, ?, ?)`,
                [itemId, moduleId, item.item_type, item.item_id, item.sequence_order]
            );
        }

        await connection.commit();
        connection.release();
        connection = undefined;

        return NextResponse.json({ success: true, id: moduleId, message: 'Modul berhasil dibuat dengan item' }, { status: 201 });
    } catch (error) {
        if (connection) {
            await connection.rollback();
            connection.release();
        }
        const message = error instanceof Error ? error.message : 'Internal Server Error';
        const isValidationError = error instanceof Error && error.name === 'ModuleItemsError';
        return NextResponse.json(
            { success: false, error: isValidationError ? message : 'Gagal membuat modul' },
            { status: isValidationError ? 400 : 500 },
        );
    }
}

export const GET = withAuth(handleGet, { allowedRoles: ['admin', 'trainer'] });
export const POST = withAuth(handlePost, { allowedRoles: ['admin'] });
