import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { logActivity } from '@/lib/audit';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { token, newPassword } = body;

        if (!token || !newPassword) {
            return NextResponse.json({ success: false, error: 'Token dan password baru wajib diisi' }, { status: 400 });
        }

        if (newPassword.length < 6) {
            return NextResponse.json({ success: false, error: 'Password minimal 6 karakter' }, { status: 400 });
        }

        // Validate Token & Expiration natively via MySQL
        const users = await executeQuery<any[]>(
            `SELECT id, username 
             FROM users 
             WHERE reset_token = ? AND reset_token_expires > NOW()`,
            [token]
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
        await logActivity('system', 'RESET_PASSWORD', 'users', user.id, { info: 'Password successfully reset via token' });

        return NextResponse.json({ success: true, message: 'Password berhasil direset. Silakan login dengan password baru Anda.' });

    } catch (error) {
        console.error('Reset password error:', error);
        return NextResponse.json({ success: false, error: 'Terjadi kesalahan pada server' }, { status: 500 });
    }
}
