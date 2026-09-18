import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import { withAuth, AuthenticatedUser } from '@/lib/api-auth';
import { sendSessionReminderEmail } from '@/lib/email';
import { logActivity } from '@/lib/audit';
import logger from '@/lib/logger';
import pool from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

async function handlePost(
    request: NextRequest,
    authUser: AuthenticatedUser,
    context: { params: Promise<{ id: string }> }
) {
    let reminderRunId: string | null = null;
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

        const recentRuns = await executeQuery<Array<{ id: string }>>(
            `SELECT id FROM session_reminder_runs
             WHERE session_id = ? AND created_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 10 MINUTE)
             LIMIT 1`,
            [sessionId],
        );
        if (recentRuns.length > 0) {
            return NextResponse.json(
                { success: false, error: 'Pengingat untuk sesi ini baru saja dikirim atau sedang diproses. Coba kembali setelah 10 menit.' },
                { status: 429 },
            );
        }

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

        reminderRunId = uuidv4();
        const cooldownBucket = Math.floor(Date.now() / 600_000);
        await executeQuery(
            `INSERT INTO session_reminder_runs (id, session_id, triggered_by, cooldown_bucket, status, recipient_count)
             VALUES (?, ?, ?, ?, 'processing', ?)`,
            [reminderRunId, sessionId, authUser.id, cooldownBucket, emailAddresses.length],
        );

        // Bound each BCC envelope so provider recipient limits cannot reject one
        // oversized message. Nodemailer's configured rate limiter paces chunks.
        const chunkSize = 50;
        let sentCount = 0;
        for (let offset = 0; offset < emailAddresses.length; offset += chunkSize) {
            const chunk = emailAddresses.slice(offset, offset + chunkSize);
            await sendSessionReminderEmail(chunk, {
                title: sessionDetail.title,
                startTime: sessionDetail.start_time,
                endTime: sessionDetail.end_time
            });
            sentCount += chunk.length;
            await pool.execute(
                'UPDATE session_reminder_runs SET sent_count = ? WHERE id = ?',
                [sentCount, reminderRunId],
            );
        }
        await pool.execute(
            `UPDATE session_reminder_runs SET status = 'completed', completed_at = UTC_TIMESTAMP() WHERE id = ?`,
            [reminderRunId],
        );

        // 4. Catat Log
        await logActivity(authUser.id, 'UPDATE_SESSION', 'sessions', sessionId, {
            detail: 'Blasted email reminder announcement to ' + emailAddresses.length + ' participants via BCC'
        });

        return NextResponse.json({ success: true, message: `Berhasil nge-blast pengingat jadwal ke ${emailAddresses.length} peserta` });
    } catch (error) {
        const dbError = error as { code?: string };
        if (dbError?.code === 'ER_DUP_ENTRY') {
            return NextResponse.json(
                { success: false, error: 'Pengingat untuk sesi ini sedang diproses. Coba kembali setelah 10 menit.' },
                { status: 429 },
            );
        }
        if (reminderRunId) {
            await pool.execute(
                `UPDATE session_reminder_runs
                 SET status = 'failed', error_message = ?, completed_at = UTC_TIMESTAMP()
                 WHERE id = ?`,
                [error instanceof Error ? error.message.slice(0, 500) : 'Unknown reminder error', reminderRunId],
            ).catch(() => undefined);
        }
        logger.error('SESSION_REMIND', 'Gagal mengirimkan email blast pengingat jadwal sesi', error);
        return NextResponse.json({ success: false, error: 'Terjadi kesalahan saat mengirimkan pengingat email ke peserta.' }, { status: 500 });
    }
}

export const POST = withAuth(handlePost, { allowedRoles: ['admin', 'trainer'] });
