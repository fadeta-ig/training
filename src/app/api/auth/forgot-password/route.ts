import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import crypto from 'crypto';
import { sendPasswordResetEmail } from '@/lib/email';
import { logActivity } from '@/lib/audit';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { username } = body;

        if (!username) {
            return NextResponse.json({ success: false, error: 'Username atau email wajib diisi' }, { status: 400 });
        }

        // Cari user berdasarkan username
        const users = await executeQuery<any[]>(
            `SELECT id, username FROM users WHERE username = ?`,
            [username]
        );

        if (!users || users.length === 0) {
            // Untuk keamanan, jangan beri tahu jika user tidak ada, tetapi cukup return success text.
            return NextResponse.json({ success: true, message: 'Jika akun ditemukan, link reset telah dikirim ke email tersebut.' });
        }

        const user = users[0];

        // Sebagai simulasi/praktek, kita anggap username adalah email, 
        // Jika username bukan format email, aplikasi enterprise umumnya punya kolom `email` terpisah.
        // Pada LMS ini username dipakai sebagai identifier utama (Email).
        const isEmailFormat = /\S+@\S+\.\S+/.test(user.username);
        if (!isEmailFormat) {
            return NextResponse.json({ success: false, error: 'Username tidak dalam format email yang valid untuk dikirimi link.' }, { status: 400 });
        }

        // Generate token
        const resetToken = crypto.randomBytes(32).toString('hex');
        
        // Expiration: 1 Hour from now
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 1);
        const expiresAtStr = expiresAt.toISOString().slice(0, 19).replace('T', ' ');

        await executeQuery(
            `UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?`,
            [resetToken, expiresAtStr, user.id]
        );

        // Buat reset link
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        const resetLink = `${baseUrl}/auth/reset-password?token=${resetToken}`;

        // Kirim email
        await sendPasswordResetEmail(user.username, resetLink);

        // Log Aktifitas
        await logActivity('system', 'RESET_PASSWORD', 'users', user.id, { info: 'Reset password requested' });

        return NextResponse.json({ success: true, message: 'Instruksi reset password telah dikirim ke email Anda.' });

    } catch (error) {
        console.error('Forgot password error:', error);
        return NextResponse.json({ success: false, error: 'Terjadi kesalahan pada server' }, { status: 500 });
    }
}
