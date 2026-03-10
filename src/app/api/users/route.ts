import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import { executeQuery } from '@/lib/db';
import { z } from 'zod';

const userSchema = z.object({
    username: z.string().min(3, 'Username minimal 3 karakter').max(50),
    password: z.string().min(6, 'Password minimal 6 karakter').optional(), // opsional saat update
    full_name: z.string().min(3, 'Nama lengkap minimal 3 karakter').max(100),
    role: z.enum(['admin', 'participant'])
});

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1', 10);
        const limit = parseInt(searchParams.get('limit') || '10', 10);
        const search = searchParams.get('search') || '';
        const offset = (page - 1) * limit;

        let countQuery = `SELECT COUNT(*) as total FROM users`;
        const countParams: (string | number)[] = [];

        let query = `SELECT id, username, full_name, role, created_at FROM users`;
        const params: (string | number)[] = [];

        if (search) {
            const searchClause = ` WHERE username LIKE ? OR full_name LIKE ?`;
            countQuery += searchClause;
            query += searchClause;
            countParams.push(`%${search}%`, `%${search}%`);
            params.push(`%${search}%`, `%${search}%`);
        }

        query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
        params.push(limit, offset);

        const countResult = await executeQuery<{ total: number }[]>(countQuery, countParams);
        const total = countResult[0]?.total || 0;

        const users = await executeQuery(query, params);

        return NextResponse.json({
            success: true,
            data: users,
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

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const parsed = userSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { success: false, error: 'Validasi gagal', details: parsed.error.flatten().fieldErrors },
                { status: 400 }
            );
        }

        const { username, password, full_name, role } = parsed.data;

        if (!password) {
            return NextResponse.json(
                { success: false, error: 'Password wajib diisi untuk pengguna baru' },
                { status: 400 }
            );
        }

        // Cek username duplikat
        const existing = await executeQuery<{ id: string }[]>(`SELECT id FROM users WHERE username = ?`, [username]);
        if (Array.isArray(existing) && existing.length > 0) {
            return NextResponse.json(
                { success: false, error: 'Username sudah digunakan' },
                { status: 400 }
            );
        }

        const password_hash = await bcrypt.hash(password, 10);
        const userId = uuidv4();

        await executeQuery(
            `INSERT INTO users (id, username, password_hash, full_name, role) VALUES (?, ?, ?, ?, ?)`,
            [userId, username, password_hash, full_name, role]
        );

        return NextResponse.json({ success: true, id: userId, message: 'Pengguna berhasil dibuat' }, { status: 201 });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Internal Server Error';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
