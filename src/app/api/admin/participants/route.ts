import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import { executeQuery } from '@/lib/db';
import { z } from 'zod';
import { withAuth, AuthenticatedUser } from '@/lib/api-auth';
import { logActivity } from '@/lib/audit';
import pool from '@/lib/db';
import crypto from 'crypto';
import { parsePagination } from '@/lib/sanitize';
import { generateSingleNip } from '@/lib/nip';

const participantSchema = z.object({
    name: z.string().min(3, 'Nama lengkap minimal 3 karakter').max(100),
    email: z.string().email('Format email tidak valid'),
    phone_number: z.string().optional().nullable(),
    address: z.string().optional().nullable(),
    date_of_birth: z.string().optional().nullable(),
    gender: z.preprocess((val) => (val === '' ? null : val), z.enum(['L', 'P']).nullable().optional()),
    institution: z.string().optional().nullable(),
    batch: z.preprocess((val) => (val === '' || val === null || val === undefined ? 1 : Number(val)), z.number().int().min(1).default(1)),
    registration_date: z.preprocess((val) => (val === '' || val === null || val === undefined ? new Date().toISOString().slice(0, 10) : String(val)), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal pendaftaran harus YYYY-MM-DD').default(() => new Date().toISOString().slice(0, 10))),
});

function generateRandomPassword(length = 14) {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < length; i++) {
        password += chars.charAt(crypto.randomInt(chars.length));
    }
    return password;
}

async function handleGet(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const { page, limit, offset } = parsePagination(searchParams, 10, 10000);
        const search = searchParams.get('search') || '';
        const institution = searchParams.get('institution') || '';
        const batchParam = searchParams.get('batch');

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
        p.nip, p.phone_number, p.address, 
        DATE_FORMAT(p.date_of_birth, '%Y-%m-%d') as date_of_birth, 
        p.gender, p.institution, p.institution_code, p.batch,
        DATE_FORMAT(COALESCE(p.registration_date, p.created_at), '%Y-%m-%d') as registration_date
      FROM users u
      LEFT JOIN participant_profiles p ON u.id = p.user_id
      WHERE u.role = 'trainee'
    `;
        const params: (string | number)[] = [];

        if (search) {
            const searchClause = ` AND (u.username LIKE ? OR u.full_name LIKE ? OR p.institution LIKE ? OR p.nip LIKE ?)`;
            countQuery += searchClause;
            query += searchClause;
            countParams.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
            params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
        }

        if (institution && institution !== 'all') {
            if (institution === '__NONE__') {
                const instClause = ` AND (p.institution IS NULL OR p.institution = '')`;
                countQuery += instClause;
                query += instClause;
            } else {
                const instClause = ` AND p.institution = ?`;
                countQuery += instClause;
                query += instClause;
                countParams.push(institution);
                params.push(institution);
            }
        }

        if (batchParam && batchParam !== 'all') {
            const parsedBatch = parseInt(batchParam, 10);
            if (!isNaN(parsedBatch)) {
                const batchClause = ` AND p.batch = ?`;
                countQuery += batchClause;
                query += batchClause;
                countParams.push(parsedBatch);
                params.push(parsedBatch);
            }
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

        const { name, email, phone_number, address, date_of_birth, gender, institution, batch, registration_date } = parsed.data;

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
        let generatedNip = '';
        let institutionCode = '';

        try {
            await connection.beginTransaction();

            // Auto-generate NIP within transaction
            const nipResult = await generateSingleNip(connection, {
                institution: institution || null,
                batch: batch,
                registration_date: registration_date,
            });
            generatedNip = nipResult.nip;
            institutionCode = nipResult.institutionCode;

            await connection.execute(
                `INSERT INTO users (id, username, password_hash, full_name, role) VALUES (?, ?, ?, ?, ?)`,
                [userId, email, password_hash, name, 'trainee']
            );

            await connection.execute(
                `INSERT INTO participant_profiles (id, user_id, nip, phone_number, address, date_of_birth, gender, institution, institution_code, batch, registration_date) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    profileId,
                    userId,
                    generatedNip,
                    phone_number || null,
                    address || null,
                    date_of_birth || null,
                    gender || null,
                    institution || null,
                    institutionCode || null,
                    batch,
                    registration_date,
                ]
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
            name: name,
            nip: generatedNip,
            institution: institution,
            batch: batch,
            registration_date: registration_date,
        });

        // Return credentials including NIP
        return NextResponse.json({
            success: true,
            id: userId,
            message: 'Peserta berhasil dibuat',
            credentials: {
                username: email,
                password: rawPassword,
                nip: generatedNip,
                batch: batch,
                registration_date: registration_date,
                institution: institution || null,
            }
        }, { status: 201 });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Internal Server Error';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

export const GET = withAuth(handleGet, { allowedRoles: ['admin', 'trainer'] });
export const POST = withAuth(handlePost, { allowedRoles: ['admin'] });
