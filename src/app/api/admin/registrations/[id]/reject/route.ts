import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import { withAuth, AuthenticatedUser, validateMutationOrigin } from '@/lib/api-auth';
import { logActivity } from '@/lib/audit';
import { z } from 'zod';

const rejectSchema = z.object({
    rejection_reason: z.string().trim().max(255).optional().nullable(),
});

async function handlePost(
    request: NextRequest,
    user: AuthenticatedUser,
    context: { params: Promise<{ id: string }> }
) {
    const invalidOrigin = validateMutationOrigin(request);
    if (invalidOrigin) return invalidOrigin;

    try {
        const { id: targetUserId } = await context.params;
        const body = await request.json().catch(() => ({}));
        const parseResult = rejectSchema.safeParse(body);

        if (!parseResult.success) {
            const firstError = parseResult.error.issues[0]?.message || 'Data penolakan tidak valid';
            return NextResponse.json({ success: false, error: firstError }, { status: 400 });
        }

        const reason = parseResult.data.rejection_reason || 'Persyaratan pendaftaran belum memenuhi kriteria.';

        const rows = await executeQuery<any[]>(
            `SELECT id, full_name, username FROM users WHERE id = ? AND role = 'trainee' LIMIT 1`,
            [targetUserId]
        );

        if (!Array.isArray(rows) || rows.length === 0) {
            return NextResponse.json({ success: false, error: 'Data pendaftar tidak ditemukan' }, { status: 404 });
        }

        const targetUser = rows[0];

        await executeQuery(
            `UPDATE users 
             SET approval_status = 'rejected', rejection_reason = ? 
             WHERE id = ?`,
            [reason, targetUserId]
        );

        await logActivity(user.id, 'REGISTRATION_REJECTED', 'users', targetUserId, {
            rejected_by: user.username,
            target_user: targetUser.username,
            full_name: targetUser.full_name,
            reason: reason,
        });

        return NextResponse.json({
            success: true,
            message: 'Pendaftaran peserta telah ditolak',
            data: {
                id: targetUserId,
                approval_status: 'rejected',
                rejection_reason: reason,
            },
        });
    } catch (error) {
        console.error('[ADMIN_REGISTRATION_REJECT_ERROR]', error);
        return NextResponse.json(
            { success: false, error: 'Terjadi kesalahan sistem saat menolak pendaftaran' },
            { status: 500 }
        );
    }
}

export const POST = withAuth(handlePost, { allowedRoles: ['admin'] });
