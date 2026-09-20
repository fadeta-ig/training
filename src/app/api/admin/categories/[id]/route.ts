import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import { withAuth, type AuthenticatedUser } from '@/lib/api-auth';
import { categorySchema } from '@/lib/validations/categorySchema';
import { assertTrainerAccess } from '@/lib/data-scoping';
import pool from '@/lib/db';

async function handleGet(
    request: NextRequest,
    user: AuthenticatedUser,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await context.params;

        const categories = await executeQuery<any[]>(
            `SELECT lc.id, lc.name, lc.code, lc.description, lc.color, lc.is_active, lc.created_at, lc.updated_at,
                    (SELECT COUNT(*) FROM trainings t WHERE t.category_id = lc.id) AS training_count,
                    (SELECT COUNT(*) FROM exams e WHERE e.category_id = lc.id) AS exam_count,
                    (SELECT COUNT(*) FROM modules m WHERE m.category_id = lc.id) AS module_count
             FROM learning_categories lc
             WHERE lc.id = ? LIMIT 1`,
            [id]
        );

        if (!categories || categories.length === 0) {
            return NextResponse.json({ success: false, error: 'Kategori tidak ditemukan' }, { status: 404 });
        }

        // Cek scoping jika trainer
        if (user.role === 'trainer') {
            const hasAccess = await executeQuery<any[]>(
                `SELECT 1 FROM category_trainers WHERE category_id = ? AND trainer_id = ? LIMIT 1`,
                [id, user.id]
            );
            if (!hasAccess || hasAccess.length === 0) {
                return NextResponse.json({ success: false, error: 'Anda tidak memiliki akses ke kategori ini' }, { status: 403 });
            }
        }

        const trainers = await executeQuery(
            `SELECT u.id, u.full_name, u.username, ct.assigned_at
             FROM category_trainers ct
             JOIN users u ON ct.trainer_id = u.id
             WHERE ct.category_id = ?
             ORDER BY u.full_name ASC`,
            [id]
        );

        return NextResponse.json({
            success: true,
            data: {
                ...categories[0],
                trainers: trainers || [],
            },
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Internal Server Error';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

async function handlePut(
    request: NextRequest,
    user: AuthenticatedUser,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await context.params;
        const body = await request.json();
        const parsed = categorySchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { success: false, error: 'Validasi form gagal', details: parsed.error.flatten().fieldErrors },
                { status: 400 }
            );
        }

        const { name, code, description, color, is_active } = parsed.data;

        // Cek keunikan kode jika berubah
        const existing = await executeQuery<{ id: string }[]>(
            `SELECT id FROM learning_categories WHERE code = ? AND id != ? LIMIT 1`,
            [code, id]
        );
        if (existing.length > 0) {
            return NextResponse.json(
                { success: false, error: `Kode kategori "${code}" sudah digunakan oleh kategori lain` },
                { status: 409 }
            );
        }

        const result = await executeQuery<any>(
            `UPDATE learning_categories 
             SET name = ?, code = ?, description = ?, color = ?, is_active = ?
             WHERE id = ?`,
            [name, code, description || null, color, is_active ? 1 : 0, id]
        );

        if (result && 'affectedRows' in result && result.affectedRows === 0) {
            return NextResponse.json({ success: false, error: 'Kategori tidak ditemukan' }, { status: 404 });
        }

        return NextResponse.json({ success: true, message: 'Kategori berhasil diperbarui' });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Internal Server Error';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

async function handleDelete(
    _request: NextRequest,
    _user: AuthenticatedUser,
    context: { params: Promise<{ id: string }> }
) {
    let connection;
    try {
        const { id } = await context.params;

        connection = await pool.getConnection();
        await connection.beginTransaction();

        // Validasi: Cek apakah kategori ini masih menaungi materi, ujian, atau modul
        const [usageRows] = await connection.execute<Array<{ total: number | string }> & any[]>(
            `SELECT (
                (SELECT COUNT(*) FROM trainings WHERE category_id = ?) +
                (SELECT COUNT(*) FROM exams WHERE category_id = ?) +
                (SELECT COUNT(*) FROM modules WHERE category_id = ?)
            ) AS total`,
            [id, id, id]
        );

        const totalUsage = Number(usageRows[0]?.total || 0);
        if (totalUsage > 0) {
            await connection.rollback();
            connection.release();
            connection = undefined;
            return NextResponse.json(
                {
                    success: false,
                    error: `Kategori ini tidak dapat dihapus karena masih menaungi ${totalUsage} aset pembelajaran (materi, ujian, atau modul). Pindahkan atau hapus aset terlebih dahulu.`,
                },
                { status: 409 }
            );
        }

        const [result] = await connection.execute<any>('DELETE FROM learning_categories WHERE id = ?', [id]);

        if (result && 'affectedRows' in result && result.affectedRows === 0) {
            await connection.rollback();
            connection.release();
            connection = undefined;
            return NextResponse.json({ success: false, error: 'Kategori tidak ditemukan' }, { status: 404 });
        }

        await connection.commit();
        connection.release();
        connection = undefined;

        return NextResponse.json({ success: true, message: 'Kategori berhasil dihapus' });
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
export const PUT = withAuth(handlePut, { allowedRoles: ['admin'] });
export const DELETE = withAuth(handleDelete, { allowedRoles: ['admin'] });
