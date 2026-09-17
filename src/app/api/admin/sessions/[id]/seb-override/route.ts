import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { executeQuery } from '@/lib/db';
import { withAuth, type AuthenticatedUser } from '@/lib/api-auth';
import logger from '@/lib/logger';

interface OverrideBody {
    user_id?: unknown;
    reason?: unknown;
    duration_minutes?: unknown;
}

async function handlePost(
    request: NextRequest,
    user: AuthenticatedUser,
    context: { params: Promise<{ id: string }> },
) {
    const { id: sessionId } = await context.params;
    const body = await request.json() as OverrideBody;
    const participantUserId = typeof body.user_id === 'string' ? body.user_id.trim() : '';
    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
    const durationMinutes = Number(body.duration_minutes ?? 15);

    if (!participantUserId || !reason || reason.length < 5 || reason.length > 500) {
        return NextResponse.json({ success: false, error: 'Peserta dan alasan override minimal 5 karakter wajib diisi.' }, { status: 400 });
    }
    if (!Number.isInteger(durationMinutes) || durationMinutes < 5 || durationMinutes > 60) {
        return NextResponse.json({ success: false, error: 'Durasi override harus antara 5 sampai 60 menit.' }, { status: 400 });
    }

    const enrollment = await executeQuery<{ id: string }[]>(
        `SELECT id FROM session_participants WHERE session_id = ? AND user_id = ? LIMIT 1`,
        [sessionId, participantUserId],
    );
    if (!enrollment[0]) {
        return NextResponse.json({ success: false, error: 'Peserta tidak terdaftar pada sesi ini.' }, { status: 404 });
    }

    const id = uuidv4();
    await executeQuery(
        `INSERT INTO seb_access_overrides
            (id, session_id, user_id, granted_by, reason, expires_at)
         VALUES (?, ?, ?, ?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? MINUTE))`,
        [id, sessionId, participantUserId, user.id, reason, durationMinutes],
    );

    await logger.audit(user.id, 'SEB_ACCESS_OVERRIDE', 'session_participants', enrollment[0].id, {
        session_id: sessionId,
        participant_user_id: participantUserId,
        reason,
        duration_minutes: durationMinutes,
        override_id: id,
    }, 'SEB_OVERRIDE');

    return NextResponse.json({
        success: true,
        message: `Override SEB aktif selama ${durationMinutes} menit. Minta peserta menekan Coba Lagi.`,
        expiresInMinutes: durationMinutes,
    }, { status: 201 });
}

export const POST = withAuth(handlePost, { allowedRoles: ['admin'] });

