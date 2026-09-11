import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import pool from '@/lib/db';
import { withAuth, AuthenticatedUser } from '@/lib/api-auth';
import { ensureParticipantSecurityColumns } from '@/lib/participant-helpers';
import logger from '@/lib/logger';

const firstLoginSchema = z.object({
    full_name: z.string().trim().min(3, 'Nama lengkap minimal 3 karakter').max(100, 'Nama lengkap maksimal 100 karakter'),
    gender: z.enum(['L', 'P'], { message: 'Silakan pilih jenis kelamin Anda (Laki-laki atau Perempuan)' }),
    phone_number: z.union([z.string().trim().min(8, 'Nomor telepon/WhatsApp minimal 8 digit').max(25, 'Nomor telepon maksimal 25 digit'), z.literal(''), z.null()]).optional(),
    date_of_birth: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD'), z.literal(''), z.null()]).optional(),
    address: z.string().trim().max(500, 'Alamat maksimal 500 karakter').optional().nullable(),
    new_password: z.string().min(8, 'Kata sandi baru minimal 8 karakter').max(128, 'Kata sandi baru maksimal 128 karakter'),
    confirm_password: z.string().min(8).max(128),
}).refine((data) => data.new_password === data.confirm_password, {
    message: 'Konfirmasi kata sandi tidak cocok dengan kata sandi baru',
    path: ['confirm_password'],
});

async function handlePost(request: NextRequest, user: AuthenticatedUser) {
    try {
        await ensureParticipantSecurityColumns();

        const body = await request.json();
        const parsed = firstLoginSchema.safeParse(body);

        if (!parsed.success) {
            const firstError = parsed.error.issues[0]?.message || 'Data aktivasi akun tidak valid';
            return NextResponse.json(
                { success: false, error: firstError, details: parsed.error.flatten().fieldErrors },
                { status: 400 }
            );
        }

        const { full_name, gender, phone_number, date_of_birth, address, new_password } = parsed.data;

        // Hash new secure password
        const passwordHash = await bcrypt.hash(new_password, 10);
        const dobVal = date_of_birth && date_of_birth.trim() ? date_of_birth.trim() : null;

        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            // 1. Update user record (full_name and new hashed password)
            await connection.execute(
                `UPDATE users SET full_name = ?, password_hash = ? WHERE id = ?`,
                [full_name, passwordHash, user.id]
            );

            // 2. Update participant profile record (gender, contact, clear must_change_password)
            await connection.execute(
                `UPDATE participant_profiles 
                 SET gender = ?, phone_number = ?, date_of_birth = ?, address = ?, initial_password = ?, must_change_password = 0 
                 WHERE user_id = ?`,
                [
                    gender,
                    phone_number || null,
                    dobVal,
                    address || null,
                    new_password,
                    user.id,
                ]
            );

            await connection.commit();
        } catch (dbError) {
            await connection.rollback();
            throw dbError;
        } finally {
            connection.release();
        }

        // 3. Record security audit log
        await logger.audit(
            user.id,
            'FIRST_LOGIN_ACCOUNT_SECURED',
            'users',
            user.id,
            { full_name, gender, has_phone: Boolean(phone_number) },
            'SECURITY'
        );

        // 4. Terminate active session cookie for security reasons (forces fresh login with new password)
        const response = NextResponse.json({
            success: true,
            message: 'Kata sandi dan profil akun berhasil diperbarui. Sesi diakhiri demi alasan keamanan.',
        });

        response.cookies.delete('training_session');

        return response;

    } catch (error: any) {
        logger.error('FIRST_LOGIN_SETUP', 'Gagal memproses aktivasi akun pertama kali', error, user.id);
        return NextResponse.json(
            { success: false, error: error.message || 'Terjadi kesalahan sistem saat memperbarui profil & kata sandi' },
            { status: 500 }
        );
    }
}

export const POST = withAuth(handlePost, { allowedRoles: ['trainee'] });
