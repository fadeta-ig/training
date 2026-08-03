import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import { withAuth, AuthenticatedUser } from '@/lib/api-auth';
import { sendCredentialEmail } from '@/lib/email';
import { logActivity } from '@/lib/audit';
import logger from '@/lib/logger';
import bcrypt from 'bcryptjs';
import { checkRateLimit } from '@/lib/rate-limit';

const SEND_CREDENTIALS_RATE_LIMIT = { windowMs: 60_000, maxRequests: 10 };
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function handlePost(request: NextRequest, authUser: AuthenticatedUser) {
    const blocked = checkRateLimit(request, { ...SEND_CREDENTIALS_RATE_LIMIT, identifier: authUser.id });
    if (blocked) return blocked;

    try {
        const body = await request.json();
        const { username, password } = body;

        if (!username || !password) {
            return NextResponse.json({ success: false, error: 'Username dan password wajib disediakan' }, { status: 400 });
        }

        if (!EMAIL_REGEX.test(username)) {
            return NextResponse.json({ success: false, error: 'Format username harus berupa alamat email untuk menerima kredensial.' }, { status: 400 });
        }

        const users = await executeQuery<any[]>(
            `SELECT id, full_name, password_hash FROM users WHERE username = ?`,
            [username]
        );

        if (!users || users.length === 0) {
            return NextResponse.json({ success: false, error: 'Akun tidak ditemukan' }, { status: 404 });
        }

        const user = users[0];
        const fullName = user.full_name || 'Peserta';

        const passwordMatches = await bcrypt.compare(String(password), user.password_hash);
        if (!passwordMatches) {
            return NextResponse.json({ success: false, error: 'Password tidak cocok dengan kredensial akun.' }, { status: 403 });
        }

        await sendCredentialEmail(username, fullName, password);

        await logActivity(authUser.id, 'SEND_CREDENTIALS', 'users', user.id, {
            info: 'New participant credentials sent proactively to user email.'
        });

        return NextResponse.json({ success: true, message: 'Kredensial berhasil dikirimkan dari sistem ke email tujuan!' });

    } catch (error) {
        logger.error('SEND_CREDENTIALS', 'Gagal mengirimkan email kredensial pengguna', error);
        return NextResponse.json({ success: false, error: 'Terjadi kesalahan sistem saat mengirim email kredensial.' }, { status: 500 });
    }
}

export const POST = withAuth(handlePost, { allowedRoles: ['admin'] });
