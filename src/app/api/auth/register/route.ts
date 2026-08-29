import { NextRequest, NextResponse } from 'next/server';
import pool, { executeQuery } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { checkRateLimit } from '@/lib/rate-limit';
import { validateMutationOrigin } from '@/lib/api-auth';
import { logActivity } from '@/lib/audit';
import { extractInstitutionCode } from '@/lib/nip';

const REGISTER_RATE_LIMIT = {
    windowMs: 60_000,
    maxRequests: 5,
    message: 'Terlalu banyak permintaan pendaftaran. Silakan tunggu 1 menit.',
};

const registerSchema = z.object({
    full_name: z.string().trim().min(2, 'Nama lengkap minimal 2 karakter').max(100, 'Nama terlalu panjang'),
    username: z.string().trim().email('Format email tidak valid').max(255),
    password: z.string().min(8, 'Password minimal 8 karakter').max(128, 'Password maksimal 128 karakter'),
    phone_number: z.string().trim().min(6, 'Nomor telepon/WhatsApp minimal 6 digit').max(20, 'Nomor telepon maksimal 20 digit').optional().nullable(),
    institution: z.string().trim().min(2, 'Nama instansi/unit kerja minimal 2 karakter').max(150),
    gender: z.enum(['L', 'P'], { message: 'Jenis kelamin wajib dipilih (L atau P)' }),
    date_of_birth: z.string().optional().nullable(),
    address: z.string().trim().max(500).optional().nullable(),
    target_certification_id: z.string().trim().optional().nullable(),
    target_certification_name: z.string().trim().max(255).optional().nullable(),
    target_month: z.string().trim().optional().nullable(),
    target_year: z.string().trim().optional().nullable(),
});

export async function POST(request: NextRequest) {
    const invalidOrigin = validateMutationOrigin(request);
    if (invalidOrigin) return invalidOrigin;

    const blocked = checkRateLimit(request, REGISTER_RATE_LIMIT);
    if (blocked) return blocked;

    try {
        const body = await request.json();
        const parseResult = registerSchema.safeParse(body);

        if (!parseResult.success) {
            const firstError = parseResult.error.issues[0]?.message || 'Data pendaftaran tidak valid';
            return NextResponse.json(
                { success: false, error: firstError, errors: parseResult.error.flatten() },
                { status: 400 }
            );
        }

        const data = parseResult.data;
        const normalizedUsername = data.username.toLowerCase();

        // 1. Check if username / email already exists
        const existingUsers = await executeQuery<any[]>(
            `SELECT id FROM users WHERE LOWER(username) = ? LIMIT 1`,
            [normalizedUsername]
        );

        if (Array.isArray(existingUsers) && existingUsers.length > 0) {
            return NextResponse.json(
                { success: false, error: 'Email / Username sudah terdaftar di sistem. Silakan gunakan email lain atau login.' },
                { status: 409 }
            );
        }

        // 2. Hash Password
        const passwordHash = await bcrypt.hash(data.password, 10);

        // 3. Resolve Target Period & Institution Code
        let targetPeriod = null;
        if (data.target_month && data.target_year) {
            targetPeriod = `${data.target_month} ${data.target_year}`;
        } else if (data.target_month) {
            targetPeriod = data.target_month;
        }

        const institutionCode = extractInstitutionCode(data.institution);
        const userId = uuidv4();
        const profileId = uuidv4();

        // 4. Perform atomic transactional insert
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            // Insert User with pending approval status
            await connection.execute(
                `INSERT INTO users (id, role, approval_status, full_name, username, password_hash)
                 VALUES (?, 'trainee', 'pending', ?, ?, ?)`,
                [userId, data.full_name, normalizedUsername, passwordHash]
            );

            // Insert Participant Profile
            await connection.execute(
                `INSERT INTO participant_profiles 
                 (id, user_id, nip, phone_number, address, date_of_birth, gender, institution, institution_code, target_certification_id, target_certification_name, target_period, batch)
                 VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
                [
                    profileId,
                    userId,
                    data.phone_number || null,
                    data.address || null,
                    data.date_of_birth || null,
                    data.gender,
                    data.institution,
                    institutionCode,
                    data.target_certification_id || null,
                    data.target_certification_name || null,
                    targetPeriod,
                ]
            );

            await connection.commit();
        } catch (dbError) {
            await connection.rollback();
            throw dbError;
        } finally {
            connection.release();
        }

        // 5. Log audit trail
        await logActivity(userId, 'USER_REGISTRATION_SUBMITTED', 'users', userId, {
            email: normalizedUsername,
            full_name: data.full_name,
            institution: data.institution,
            target_certification: data.target_certification_name || null,
            target_period: targetPeriod,
        });

        return NextResponse.json(
            {
                success: true,
                message: 'Pendaftaran berhasil dikirim. Akun Anda sedang menunggu persetujuan dari Administrator.',
                data: {
                    id: userId,
                    full_name: data.full_name,
                    username: normalizedUsername,
                },
            },
            { status: 201 }
        );
    } catch (error) {
        console.error('[AUTH_REGISTER_ERROR]', error);
        return NextResponse.json(
            { success: false, error: 'Terjadi kesalahan sistem saat memproses pendaftaran. Silakan coba lagi.' },
            { status: 500 }
        );
    }
}
