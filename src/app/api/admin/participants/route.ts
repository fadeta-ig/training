import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import { executeQuery } from '@/lib/db';
import { z } from 'zod';
import { withAuth, AuthenticatedUser } from '@/lib/api-auth';
import { logActivity } from '@/lib/audit';
import pool from '@/lib/db';

const participantSchema = z.object({
    name: z.string().min(3, 'Nama lengkap minimal 3 karakter').max(100),
    email: z.string().email('Format email tidak valid'),
    phone_number: z.string().optional().nullable(),
    address: z.string().optional().nullable(),
    date_of_birth: z.string().optional().nullable(),
    gender: z.preprocess((val) => (val === '' ? null : val), z.enum(['L', 'P']).nullable().optional()),
    institution: z.string().optional().nullable(),
});

function generateRandomPassword(length = 8) {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < length; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
}

async function handleGet(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1', 10);
        const limit = parseInt(searchParams.get('limit') || '10', 10);
        const search = searchParams.get('search') || '';
        const offset = (page - 1) * limit;

        let countQuery = `
      SELECT COUNT(*) as total 
      FROM users u
      LEFT JOIN participant_profiles p ON u.id = p.user_id
      WHERE u.role = 'trainee'
    `;
        const countParams: (string | number)[] = [];

        let query = `
      SELECT 
        u.id, u.username as email, u.full_name as name, u.created_at,
        p.phone_number, p.address, DATE_FORMAT(p.date_of_birth, '%Y-%m-%d') as date_of_birth, p.gender, p.institution
      FROM users u
      LEFT JOIN participant_profiles p ON u.id = p.user_id
      WHERE u.role = 'trainee'
    `;
        const params: (string | number)[] = [];

        if (search) {
            const searchClause = ` AND (u.username LIKE ? OR u.full_name LIKE ? OR p.institution LIKE ?)`;
            countQuery += searchClause;
            query += searchClause;
            countParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        query += ` ORDER BY u.created_at DESC LIMIT ? OFFSET ?`;
        params.push(limit, offset);

        const countResult = await executeQuery<{ total: number }[]>(countQuery, countParams);
        const total = countResult[0]?.total || 0;

        const participants = await executeQuery(query, params);

        return NextResponse.json({
            success: true,
            data: participants,
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

async function handlePost(request: NextRequest, authUser: AuthenticatedUser) {
    try {
        const body = await request.json();
        const parsed = participantSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { success: false, error: 'Validasi gagal', details: parsed.error.flatten().fieldErrors },
                { status: 400 }
            );
        }

        const { name, email, phone_number, address, date_of_birth, gender, institution } = parsed.data;

        const existing = await executeQuery<{ id: string }[]>(`SELECT id FROM users WHERE username = ?`, [email]);
        if (Array.isArray(existing) && existing.length > 0) {
            return NextResponse.json(
                { success: false, error: 'Email sudah terdaftar sebagai pengguna' },
                { status: 400 }
            );
        }

        const rawPassword = generateRandomPassword();
        const password_hash = await bcrypt.hash(rawPassword, 10);
        const userId = uuidv4();
        const profileId = uuidv4();

        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            await connection.execute(
                `INSERT INTO users (id, username, password_hash, full_name, role) VALUES (?, ?, ?, ?, ?)`,
                [userId, email, password_hash, name, 'trainee']
            );

            await connection.execute(
                `INSERT INTO participant_profiles (id, user_id, phone_number, address, date_of_birth, gender, institution) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [profileId, userId, phone_number || null, address || null, date_of_birth || null, gender || null, institution || null]
            );

            await connection.commit();
        } catch (dbError) {
            await connection.rollback();
            throw dbError;
        } finally {
            connection.release();
        }

        // Emit Audit Trail
        await logActivity(authUser.id, 'CREATE_USER', 'users', userId, {
            role: 'trainee',
            email: email,
            name: name
        });

        // Return the generated password so admin can share it manually
        return NextResponse.json({
            success: true,
            id: userId,
            message: 'Peserta berhasil dibuat',
            credentials: {
                username: email,
                password: rawPassword,
            }
        }, { status: 201 });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Internal Server Error';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

export const GET = withAuth(handleGet, { allowedRoles: ['admin', 'trainer'] });
export const POST = withAuth(handlePost, { allowedRoles: ['admin'] });
