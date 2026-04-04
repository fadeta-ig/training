import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { executeQuery } from '@/lib/db';
import pool from '@/lib/db';
import { moduleSchema } from '@/lib/validations/moduleSchema';
import { withAuth } from '@/lib/api-auth';

async function handleGet(
    request: NextRequest,
    _user: any,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const resolvedParams = await context.params;
        const result = await executeQuery<any[]>(
            `SELECT * FROM modules WHERE id = ?`,
            [resolvedParams.id]
        );

        if (!result || result.length === 0) {
            return NextResponse.json({ success: false, error: 'Module not found' }, { status: 404 });
        }

        const items = await executeQuery<any[]>(
            `SELECT * FROM module_items WHERE module_id = ? ORDER BY sequence_order ASC`,
            [resolvedParams.id]
        );

        return NextResponse.json({ success: true, data: { ...result[0], items } });
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
    try {
        const resolvedParams = await context.params;
        const body = await request.json();
        const parsed = moduleSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { success: false, error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
                { status: 400 }
            );
        }

        const { title, description, items } = parsed.data;

        connection = await pool.getConnection();
        await connection.beginTransaction();

        await connection.execute(
            `UPDATE modules SET title = ?, description = ? WHERE id = ?`,
            [title, description || null, resolvedParams.id]
        );

        // Replace all items
        await connection.execute(`DELETE FROM module_items WHERE module_id = ?`, [resolvedParams.id]);

        for (const item of items) {
            const itemId = uuidv4();
            await connection.execute(
                `INSERT INTO module_items (id, module_id, item_type, item_id, sequence_order) VALUES (?, ?, ?, ?, ?)`,
                [itemId, resolvedParams.id, item.item_type, item.item_id, item.sequence_order]
            );
        }

        await connection.commit();
        connection.release();
        return NextResponse.json({ success: true, message: 'Module updated successfully' });
    } catch (error) {
        if (connection) {
            await connection.rollback();
            connection.release();
        }
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
            `DELETE FROM modules WHERE id = ?`,
            [resolvedParams.id]
        );

        if (result && 'affectedRows' in result && result.affectedRows === 0) {
            return NextResponse.json({ success: false, error: 'Module not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true, message: 'Module deleted' });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Internal Server Error';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

export const GET = withAuth(handleGet, { allowedRoles: ['admin', 'trainer'] });
export const PUT = withAuth(handlePut, { allowedRoles: ['admin'] });
export const DELETE = withAuth(handleDelete, { allowedRoles: ['admin'] });
