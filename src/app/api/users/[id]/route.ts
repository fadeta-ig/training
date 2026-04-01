import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { executeQuery } from '@/lib/db';
import { z } from 'zod';
import { withAuth } from '@/lib/api-auth';

const userUpdateSchema = z.object({
    username: z.string().min(3, 'Username minimal 3 karakter').max(50),
    password: z.string().min(6, 'Password minimal 6 karakter').optional().or(z.literal('')),
    full_name: z.string().min(3, 'Nama lengkap minimal 3 karakter').max(100),
    role: z.enum(['admin', 'trainer'])
});

async function handleGet(
    request: NextRequest,
    _user: any,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const resolvedParams = await context.params;
        const users = await executeQuery(
            `SELECT id, username, full_name, role, created_at FROM users WHERE id = ?`,
            [resolvedParams.id]
        );

        const data = Array.isArray(users) ? users[0] : null;

        if (!data) {
            return NextResponse.json({ success: false, error: 'Pengguna tidak ditemukan' }, { status: 404 });
        }

        return NextResponse.json({ success: true, data });
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
    try {
        const resolvedParams = await context.params;
        const body = await request.json();
        const parsed = userUpdateSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { success: false, error: 'Validasi gagal', details: parsed.error.flatten().fieldErrors },
                { status: 400 }
            );
        }

        const { username, password, full_name, role } = parsed.data;

        const existing = await executeQuery<{ id: string }[]>(
            `SELECT id FROM users WHERE username = ? AND id != ?`,
            [username, resolvedParams.id]
        );

        if (Array.isArray(existing) && existing.length > 0) {
            return NextResponse.json(
                { success: false, error: 'Username sudah digunakan oleh akun lain' },
                { status: 400 }
            );
        }

        let query = `UPDATE users SET username = ?, full_name = ?, role = ?`;
        const queryParams: (string | number)[] = [username, full_name, role];

        if (password && password.trim() !== '') {
            const password_hash = await bcrypt.hash(password, 10);
            query += `, password_hash = ?`;
            queryParams.push(password_hash);
        }

        query += ` WHERE id = ?`;
        queryParams.push(resolvedParams.id);

        const result = await executeQuery<{ affectedRows: number }>(query, queryParams);

        if (result && 'affectedRows' in result && result.affectedRows === 0) {
            return NextResponse.json({ success: false, error: 'Pengguna tidak ditemukan' }, { status: 404 });
        }

        return NextResponse.json({ success: true, message: 'Data pengguna berhasil diperbarui' });
    } catch (error) {
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

        // Prevent deleting the last admin (role-based, no hardcoded IDs)
        const targetUser = await executeQuery<{ role: string }[]>(
            `SELECT role FROM users WHERE id = ?`,
            [resolvedParams.id]
        );

        if (targetUser?.[0]?.role === 'admin') {
            const adminCount = await executeQuery<{ count: number }[]>(
                `SELECT COUNT(*) as count FROM users WHERE role = 'admin'`
            );

            if ((adminCount?.[0]?.count || 0) <= 1) {
                return NextResponse.json(
                    { success: false, error: 'Tidak dapat menghapus admin terakhir di sistem' },
                    { status: 403 }
                );
            }
        }

        const result = await executeQuery<{ affectedRows: number }>(
            `DELETE FROM users WHERE id = ?`,
            [resolvedParams.id]
        );

        if (result && 'affectedRows' in result && result.affectedRows === 0) {
            return NextResponse.json({ success: false, error: 'Pengguna tidak ditemukan' }, { status: 404 });
        }

        return NextResponse.json({ success: true, message: 'Pengguna berhasil dihapus' });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Internal Server Error';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

export const GET = withAuth(handleGet, { allowedRoles: ['admin'] });
export const PUT = withAuth(handlePut, { allowedRoles: ['admin'] });
export const DELETE = withAuth(handleDelete, { allowedRoles: ['admin'] });
