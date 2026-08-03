import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import crypto from 'crypto';
import { sendPasswordResetEmail } from '@/lib/email';
import { logActivity } from '@/lib/audit';
import logger from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { validateMutationOrigin } from '@/lib/api-auth';
import { getAppBaseUrl } from '@/lib/app-url';

const RESET_REQUEST_RATE_LIMIT = { windowMs: 60_000, maxRequests: 5 };
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GENERIC_RESET_RESPONSE = {
    success: true,
    message: 'Jika akun ditemukan, link reset telah dikirim ke email tersebut.',
};

function hashResetToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
}

export async function POST(request: NextRequest) {
    const invalidOrigin = validateMutationOrigin(request);
    if (invalidOrigin) return invalidOrigin;

    const blocked = checkRateLimit(request, RESET_REQUEST_RATE_LIMIT);
    if (blocked) return blocked;

    try {
        const body = await request.json();
        const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : '';

        if (!username || username.length > 255) {
            return NextResponse.json({ success: false, error: 'Username atau email wajib diisi' }, { status: 400 });
        }

        if (!EMAIL_REGEX.test(username)) {
            return NextResponse.json(GENERIC_RESET_RESPONSE);
        }

        // Cari user berdasarkan username
        const users = await executeQuery<any[]>(
            `SELECT id, username FROM users WHERE username = ?`,
            [username]
        );

        if (!users || users.length === 0) {
            // Untuk keamanan, jangan beri tahu jika user tidak ada, tetapi cukup return success text.
            return NextResponse.json(GENERIC_RESET_RESPONSE);
        }

        const user = users[0];

        // Generate token
        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetTokenHash = hashResetToken(resetToken);
        
        await executeQuery(
            `UPDATE users SET reset_token = ?, reset_token_expires = DATE_ADD(NOW(), INTERVAL 1 HOUR) WHERE id = ?`,
            [resetTokenHash, user.id]
        );

        // Buat reset link
        const baseUrl = getAppBaseUrl();
        const resetLink = `${baseUrl}/auth/reset-password?token=${resetToken}`;

        // Kirim email
        await sendPasswordResetEmail(user.username, resetLink);

        // Log Aktifitas
        await logActivity(null, 'RESET_PASSWORD', 'users', user.id, { info: 'Reset password requested' });

        return NextResponse.json(GENERIC_RESET_RESPONSE);

    } catch (error) {
        logger.error('AUTH_FORGOT_PASSWORD', 'Terjadi kesalahan saat memproses permintaan reset password', error);
        return NextResponse.json({ success: false, error: 'Terjadi kesalahan pada server saat memproses permintaan Anda.' }, { status: 500 });
    }
}
