import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import { withAuth } from '@/lib/api-auth';
import { sendCredentialEmail } from '@/lib/email';
import { logActivity } from '@/lib/audit';

async function handlePost(request: NextRequest) {
    try {
        const body = await request.json();
        const { username, password } = body;

        if (!username || !password) {
            return NextResponse.json({ success: false, error: 'Username dan password wajib disediakan' }, { status: 400 });
        }

        // Optional: you can fetch user's full name to personalize it
        const users = await executeQuery<any[]>(
            `SELECT id, full_name FROM users WHERE username = ?`,
            [username]
        );

        if (!users || users.length === 0) {
            return NextResponse.json({ success: false, error: 'Akun tidak ditemukan' }, { status: 404 });
        }

        const user = users[0];
        const fullName = user.full_name || 'Peserta';

        // Check valid email format before dispatching
        const isEmailFormat = /\S+@\S+\.\S+/.test(username);
        if (!isEmailFormat) {
            return NextResponse.json({ success: false, error: 'Format username harus berupa alamat email untuk menerima kredensial.' }, { status: 400 });
        }

        // Memicu email dispatch
        await sendCredentialEmail(username, fullName, password);

        // Audit Trail Action
        await logActivity('admin', 'SEND_CREDENTIALS', 'users', user.id, {
            info: 'New participant credentials sent proactively to user email.'
        });

        return NextResponse.json({ success: true, message: 'Kredensial berhasil dikirimkan dari sistem ke email tujuan!' });

    } catch (error) {
        console.error('Send Credentials Error:', error);
        return NextResponse.json({ success: false, error: 'Terjadi kesalahan sistem saat mengirim email kredensial.' }, { status: 500 });
    }
}

// Ensure the endpoint is secured behind token authorization
export const POST = withAuth(handlePost, { allowedRoles: ['admin', 'trainer'] });
