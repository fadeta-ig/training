import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import { withAuth, AuthenticatedUser } from '@/lib/api-auth';
import { sendSessionReminderEmail } from '@/lib/email';
import { logActivity } from '@/lib/audit';

async function handlePost(
    request: NextRequest,
    authUser: AuthenticatedUser,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const resolvedParams = await context.params;
        const sessionId = resolvedParams.id;

        // 1. Dapatkan detail Sesi (Title, Schedule)
        const sessions = await executeQuery<any[]>(
            `SELECT title, start_time, end_time FROM sessions WHERE id = ?`,
            [sessionId]
        );

        if (!sessions || sessions.length === 0) {
            return NextResponse.json({ success: false, error: 'Sesi logistik tidak ditemukan di sistem' }, { status: 404 });
        }
        const sessionDetail = sessions[0];

        // 2. Dapatkan Semua Email dari Participant yang tergabung di daftar peserta Sesi ini
        const participants = await executeQuery<any[]>(
            `SELECT u.username as email 
             FROM session_participants sp
             JOIN users u ON sp.user_id = u.id
             WHERE sp.session_id = ? AND u.role = 'trainee'`,
            [sessionId]
        );

        const emailAddresses = participants.map(p => p.email).filter(e => /\S+@\S+\.\S+/.test(e));

        if (emailAddresses.length === 0) {
            return NextResponse.json({ success: false, error: 'Tidak ada email valid dari peserta pada sesi ini untuk diblast' }, { status: 400 });
        }

        // 3. Eksekusi Blast secara Bulk (BCC Mode via Nodemailer)
        await sendSessionReminderEmail(emailAddresses, {
            title: sessionDetail.title,
            startTime: sessionDetail.start_time,
            endTime: sessionDetail.end_time
        });

        // 4. Catat Log
        await logActivity(authUser.id, 'UPDATE_SESSION', 'sessions', sessionId, {
            detail: 'Blasted email reminder announcement to ' + emailAddresses.length + ' participants via BCC'
        });

        return NextResponse.json({ success: true, message: `Berhasil nge-blast pengingat jadwal ke ${emailAddresses.length} peserta` });
    } catch (error) {
        console.error('Email Blast Error:', error);
        return NextResponse.json({ success: false, error: 'Terjadi kesalahan internal ketika memproses broadcast' }, { status: 500 });
    }
}

export const POST = withAuth(handlePost, { allowedRoles: ['admin', 'trainer'] });
