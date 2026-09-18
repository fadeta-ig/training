import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import pool from '@/lib/db';
import { moduleSchema } from '@/lib/validations/moduleSchema';
import { withAuth } from '@/lib/api-auth';
import { ModuleItemsError, synchronizeModuleItems } from '@/lib/module-items';

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

        const { title, description, enforce_sequence, items } = parsed.data;

        connection = await pool.getConnection();
        await connection.beginTransaction();

        const [moduleRows] = await connection.execute<Array<{ id: string }> & any[]>(
            'SELECT id FROM modules WHERE id = ? LIMIT 1 FOR UPDATE',
            [resolvedParams.id],
        );
        if (moduleRows.length === 0) {
            await connection.rollback();
            connection.release();
            connection = undefined;
            return NextResponse.json({ success: false, error: 'Module not found' }, { status: 404 });
        }

        await connection.execute(
            `UPDATE modules SET title = ?, description = ?, enforce_sequence = ? WHERE id = ?`,
            [title, description || null, enforce_sequence ? 1 : 0, resolvedParams.id]
        );

        await synchronizeModuleItems(connection, resolvedParams.id, items);

        await connection.commit();
        connection.release();
        connection = undefined;
        return NextResponse.json({ success: true, message: 'Module updated successfully' });
    } catch (error) {
        if (connection) {
            await connection.rollback();
            connection.release();
        }
        const isConflict = error instanceof ModuleItemsError;
        return NextResponse.json(
            { success: false, error: isConflict ? error.message : 'Gagal memperbarui modul' },
            { status: isConflict ? 409 : 500 },
        );
    }
}

async function handleDelete(
    request: NextRequest,
    _user: any,
    context: { params: Promise<{ id: string }> }
) {
    let connection;
    try {
        const resolvedParams = await context.params;

        connection = await pool.getConnection();
        await connection.beginTransaction();
        const [usageRows] = await connection.execute<Array<{ sessions: number | string; progress: number | string }> & any[]>(
            `SELECT
                (SELECT COUNT(*) FROM sessions WHERE module_id = ?) AS sessions,
                (SELECT COUNT(*) FROM user_progress up
                 INNER JOIN module_items mi ON mi.id = up.module_item_id
                 WHERE mi.module_id = ?) AS progress`,
            [resolvedParams.id, resolvedParams.id],
        );
        if (Number(usageRows[0]?.sessions || 0) > 0 || Number(usageRows[0]?.progress || 0) > 0) {
            await connection.rollback();
            connection.release();
            connection = undefined;
            return NextResponse.json(
                { success: false, error: 'Modul yang sudah digunakan sesi atau memiliki progres peserta tidak dapat dihapus' },
                { status: 409 },
            );
        }

        const [result] = await connection.execute<any>('DELETE FROM modules WHERE id = ?', [resolvedParams.id]);

        if (result && 'affectedRows' in result && result.affectedRows === 0) {
            await connection.rollback();
            connection.release();
            connection = undefined;
            return NextResponse.json({ success: false, error: 'Module not found' }, { status: 404 });
        }

        await connection.commit();
        connection.release();
        connection = undefined;

        return NextResponse.json({ success: true, message: 'Module deleted' });
    } catch {
        if (connection) {
            await connection.rollback();
            connection.release();
        }
        return NextResponse.json({ success: false, error: 'Gagal menghapus modul' }, { status: 500 });
    }
}

export const GET = withAuth(handleGet, { allowedRoles: ['admin', 'trainer'] });
export const PUT = withAuth(handlePut, { allowedRoles: ['admin'] });
export const DELETE = withAuth(handleDelete, { allowedRoles: ['admin'] });
