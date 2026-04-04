import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { executeQuery } from '@/lib/db';
import pool from '@/lib/db';
import { moduleSchema } from '@/lib/validations/moduleSchema';
import { withAuth } from '@/lib/api-auth';

async function handleGet(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1', 10);
        const limit = parseInt(searchParams.get('limit') || '10', 10);
        const offset = (page - 1) * limit;

        const countResult = await executeQuery<{ total: number }[]>(`SELECT COUNT(*) as total FROM modules`);
        const total = countResult[0]?.total || 0;

        const modules = await executeQuery(
            `SELECT id, title, description, created_at FROM modules ORDER BY created_at DESC LIMIT ? OFFSET ?`,
            [limit, offset]
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

        const { title, description, items } = parsed.data;
        const moduleId = uuidv4();

        connection = await pool.getConnection();
        await connection.beginTransaction();

        await connection.execute(
            `INSERT INTO modules (id, title, description) VALUES (?, ?, ?)`,
            [moduleId, title, description || null]
        );

        for (const item of items) {
            const itemId = uuidv4();
            await connection.execute(
                `INSERT INTO module_items (id, module_id, item_type, item_id, sequence_order) VALUES (?, ?, ?, ?, ?)`,
                [itemId, moduleId, item.item_type, item.item_id, item.sequence_order]
            );
        }

        await connection.commit();
        connection.release();

        return NextResponse.json({ success: true, id: moduleId, message: 'Module created with items' }, { status: 201 });
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
