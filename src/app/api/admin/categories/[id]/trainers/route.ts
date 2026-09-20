import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { executeQuery } from '@/lib/db';
import { withAuth, type AuthenticatedUser } from '@/lib/api-auth';
import { assignTrainersSchema } from '@/lib/validations/categorySchema';
import pool from '@/lib/db';

async function handleGet(
    _request: NextRequest,
    _user: AuthenticatedUser,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id: categoryId } = await context.params;

        const category = await executeQuery<{ id: string; name: string }[]>(
            `SELECT id, name FROM learning_categories WHERE id = ? LIMIT 1`,
            [categoryId]
        );
        if (!category || category.length === 0) {
            return NextResponse.json({ success: false, error: 'Kategori tidak ditemukan' }, { status: 404 });
        }

        // Ambil semua pengguna dengan role = 'trainer' dan status apakah di-assign ke kategori ini
        const trainers = await executeQuery<any[]>(
            `SELECT u.id, u.full_name, u.username,
                    EXISTS (
                        SELECT 1 FROM category_trainers ct 
                        WHERE ct.category_id = ? AND ct.trainer_id = u.id
                    ) AS is_assigned,
                    (SELECT ct.assigned_at FROM category_trainers ct WHERE ct.category_id = ? AND ct.trainer_id = u.id LIMIT 1) AS assigned_at
             FROM users u
             WHERE u.role = 'trainer'
             ORDER BY u.full_name ASC`,
            [categoryId, categoryId]
        );

        const formatted = trainers.map((t) => ({
            ...t,
            is_assigned: Boolean(t.is_assigned),
        }));

        return NextResponse.json({
            success: true,
            category: category[0],
            data: formatted,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Internal Server Error';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

async function handlePost(
    request: NextRequest,
    user: AuthenticatedUser,
    context: { params: Promise<{ id: string }> }
) {
    let connection;
    try {
        const { id: categoryId } = await context.params;
        const body = await request.json();
        const parsed = assignTrainersSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { success: false, error: 'Validasi form gagal', details: parsed.error.flatten().fieldErrors },
                { status: 400 }
            );
        }

        const { trainer_ids } = parsed.data;

        connection = await pool.getConnection();
        await connection.beginTransaction();

        // 1. Cek apakah kategori ada
        const [catRows] = await connection.execute<any[]>(
            `SELECT id FROM learning_categories WHERE id = ? FOR UPDATE`,
            [categoryId]
        );
        if (catRows.length === 0) {
            await connection.rollback();
            connection.release();
            connection = undefined;
            return NextResponse.json({ success: false, error: 'Kategori tidak ditemukan' }, { status: 404 });
        }

        // 2. Hapus seluruh assignment lama untuk kategori ini
        await connection.execute(`DELETE FROM category_trainers WHERE category_id = ?`, [categoryId]);

        // 3. Masukkan assignment baru
        if (trainer_ids.length > 0) {
            for (const trainerId of trainer_ids) {
                await connection.execute(
                    `INSERT INTO category_trainers (id, category_id, trainer_id, assigned_by, assigned_at)
                     VALUES (?, ?, ?, ?, NOW())`,
                    [uuidv4(), categoryId, trainerId, user.id]
                );
            }
        }

        await connection.commit();
        connection.release();
        connection = undefined;

        return NextResponse.json({
            success: true,
            message: `Berhasil memperbarui penugasan trainer (${trainer_ids.length} trainer ditugaskan)`,
        });
    } catch (error) {
        if (connection) {
            await connection.rollback();
            connection.release();
        }
        const message = error instanceof Error ? error.message : 'Internal Server Error';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

export const GET = withAuth(handleGet, { allowedRoles: ['admin'] });
export const POST = withAuth(handlePost, { allowedRoles: ['admin'] });
