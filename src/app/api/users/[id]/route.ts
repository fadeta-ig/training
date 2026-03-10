import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { executeQuery } from '@/lib/db';
import { z } from 'zod';

const userUpdateSchema = z.object({
    username: z.string().min(3, 'Username minimal 3 karakter').max(50),
    password: z.string().min(6, 'Password minimal 6 karakter').optional().or(z.literal('')),
    full_name: z.string().min(3, 'Nama lengkap minimal 3 karakter').max(100),
    role: z.enum(['admin', 'participant'])
});

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const resolvedParams = await params;
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

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const resolvedParams = await params;
        const body = await request.json();
        const parsed = userUpdateSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { success: false, error: 'Validasi gagal', details: parsed.error.flatten().fieldErrors },
                { status: 400 }
            );
        }

        const { username, password, full_name, role } = parsed.data;

        // Cek username duplikat selain miliknya sendiri
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

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const resolvedParams = await params;

        // Cegah penghapusan admin default jika belum ada proteksi lain
        if (resolvedParams.id === 'admin-uuid-001') {
            return NextResponse.json(
                { success: false, error: 'Akun Admin utama tidak bisa dihapus' },
                { status: 403 }
            );
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
