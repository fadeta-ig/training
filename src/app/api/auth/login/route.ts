import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { signToken } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limit';
import logger from '@/lib/logger';
import { validateMutationOrigin } from '@/lib/api-auth';

/** Max 10 login attempts per minute per IP */
const LOGIN_RATE_LIMIT = { windowMs: 60_000, maxRequests: 10, message: 'Terlalu banyak percobaan login. Coba lagi dalam 1 menit.' };

export async function POST(request: NextRequest) {
    const invalidOrigin = validateMutationOrigin(request);
    if (invalidOrigin) return invalidOrigin;

    const blocked = checkRateLimit(request, LOGIN_RATE_LIMIT);
    if (blocked) return blocked;

    try {
        const body = await request.json();
        const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : '';
        const password = typeof body.password === 'string' ? body.password : '';

        if (!username || username.length > 255 || !password || password.length > 128) {
            return NextResponse.json(
                { success: false, error: 'Username/NIP dan password wajib diisi' },
                { status: 400 }
            );
        }

        // Cari user di DB berdasarkan username (email) atau NIP resmi
        const users = await executeQuery<any[]>(
            `SELECT u.id, u.username, u.password_hash, u.role, u.full_name, u.approval_status, u.rejection_reason 
             FROM users u 
             LEFT JOIN participant_profiles pp ON u.id = pp.user_id 
             WHERE LOWER(u.username) = ? OR LOWER(COALESCE(pp.nip, '')) = ?
             LIMIT 1`,
            [username, username]
        );

        if (!Array.isArray(users) || users.length === 0) {
            logger.warn('AUTH_LOGIN', `Percobaan login gagal: User/NIP "${username}" tidak ditemukan`);
            return NextResponse.json(
                { success: false, error: 'Kredensial tidak valid' },
                { status: 401 }
            );
        }

        const user = users[0];

        // Verifikasi password
        const passwordMatch = await bcrypt.compare(password, user.password_hash);
        if (!passwordMatch) {
            logger.warn('AUTH_LOGIN', `Percobaan login gagal: Password salah untuk user "${username}"`, undefined, user.id);
            await logger.audit(user.id, 'LOGIN_FAILED', 'users', user.id, { username }, 'AUTH_LOGIN');
            return NextResponse.json(
                { success: false, error: 'Kredensial tidak valid' },
                { status: 401 }
            );
        }

        // Cek status persetujuan akun (jika ada kolom approval_status)
        if (user.approval_status === 'pending') {
            logger.warn('AUTH_LOGIN', `Percobaan login ditolak: Akun "${username}" masih berstatus pending approval`, undefined, user.id);
            return NextResponse.json(
                { 
                    success: false, 
                    error: 'Pendaftaran akun Anda sedang menunggu verifikasi & persetujuan dari Administrator. Nomor Induk Peserta (NIP) dan Batch akan ditetapkan setelah disetujui.' 
                },
                { status: 403 }
            );
        }

        if (user.approval_status === 'rejected') {
            logger.warn('AUTH_LOGIN', `Percobaan login ditolak: Akun "${username}" telah ditolak oleh Admin`, undefined, user.id);
            const reasonSuffix = user.rejection_reason ? ` Catatan: ${user.rejection_reason}` : '';
            return NextResponse.json(
                { 
                    success: false, 
                    error: `Pendaftaran akun Anda tidak disetujui oleh Administrator.${reasonSuffix}` 
                },
                { status: 403 }
            );
        }


        // Generate JWT token
        const token = await signToken({
            sub: user.id,
            username: user.username,
            role: user.role,
        });

        // Audit Log Login Sukses
        await logger.audit(user.id, 'USER_LOGIN', 'users', user.id, { username: user.username, role: user.role }, 'AUTH_LOGIN');

        // Set token in HTTP-only cookie
        const response = NextResponse.json({
            success: true,
            user: {
                id: user.id,
                username: user.username,
                full_name: user.full_name,
                role: user.role,
            }
        });

        response.cookies.set('training_session', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60 * 24, // 1 day in seconds
            path: '/',
        });

        return response;

    } catch (error) {
        logger.error('AUTH_LOGIN', 'Terjadi kesalahan sistem saat proses login', error);
        return NextResponse.json(
            { success: false, error: 'Terjadi kesalahan sistem saat proses login' },
            { status: 500 }
        );
    }
}
