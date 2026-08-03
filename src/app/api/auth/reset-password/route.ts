import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { logActivity } from '@/lib/audit';
import logger from '@/lib/logger';
import crypto from 'crypto';
import { checkRateLimit } from '@/lib/rate-limit';
import { validateMutationOrigin } from '@/lib/api-auth';

const RESET_PASSWORD_RATE_LIMIT = { windowMs: 60_000, maxRequests: 5 };

function hashResetToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
}

export async function POST(request: NextRequest) {
    const invalidOrigin = validateMutationOrigin(request);
    if (invalidOrigin) return invalidOrigin;

    const blocked = checkRateLimit(request, RESET_PASSWORD_RATE_LIMIT);
    if (blocked) return blocked;

    try {
        const body = await request.json();
        const { token, newPassword } = body;

        if (!token || !newPassword) {
            return NextResponse.json({ success: false, error: 'Token dan password baru wajib diisi' }, { status: 400 });
        }

        if (typeof token !== 'string' || !/^[a-f0-9]{64}$/i.test(token)) {
            return NextResponse.json({ success: false, error: 'Token reset password tidak valid atau telah kedaluwarsa. Silakan minta ulang.' }, { status: 400 });
        }

        if (typeof newPassword !== 'string' || newPassword.length < 8 || newPassword.length > 128) {
            return NextResponse.json({ success: false, error: 'Password harus 8-128 karakter' }, { status: 400 });
        }

        // Validate Token & Expiration natively via MySQL
        const resetTokenHash = hashResetToken(token);
        const users = await executeQuery<any[]>(
            `SELECT id, username 
             FROM users 
             WHERE reset_token = ? AND reset_token_expires > NOW()`,
            [resetTokenHash]
        );

        if (!users || users.length === 0) {
            return NextResponse.json({ success: false, error: 'Token reset password tidak valid atau telah kedaluwarsa. Silakan minta ulang.' }, { status: 400 });
        }

        const user = users[0];

        // Hash new password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        // Update password and invalidate token
        await executeQuery(
            `UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?`,
            [hashedPassword, user.id]
        );

        // Audit Trail
        await logActivity(null, 'RESET_PASSWORD', 'users', user.id, { info: 'Password successfully reset via token' });

        return NextResponse.json({ success: true, message: 'Password berhasil direset. Silakan login dengan password baru Anda.' });

    } catch (error) {
        logger.error('AUTH_RESET_PASSWORD', 'Terjadi kesalahan saat mereset password', error);
        return NextResponse.json({ success: false, error: 'Terjadi kesalahan pada server saat mereset password.' }, { status: 500 });
    }
}
