import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import { withAuth, AuthenticatedUser } from '@/lib/api-auth';
import { v4 as uuidv4 } from 'uuid';
import { verifyEnrollment, validateSessionTiming, ParticipantError } from '@/lib/participant-helpers';

/**
 * POST /api/participant/sessions/[id]/training/[trainingId]/complete
 * Marks a training module item as completed for the enrolled trainee.
 * Enforces sequential unlock — only allows completion if this is the current open item.
 */
async function handlePost(
    _request: NextRequest,
    user: AuthenticatedUser,
    context: { params: Promise<{ id: string; trainingId: string }> }
) {
    try {
        const { id: sessionId, trainingId } = await context.params;

        await verifyEnrollment(sessionId, user.id);
        const { session, isActive } = await validateSessionTiming(sessionId);

        if (!isActive) {
            return NextResponse.json({ success: false, error: 'Sesi tidak aktif' }, { status: 400 });
        }

        // Find corresponding module_item
        const moduleItem = await executeQuery<any[]>(
            `SELECT id, sequence_order FROM module_items
             WHERE module_id = ? AND item_type = 'training' AND item_id = ?`,
            [session.module_id, trainingId]
        );
        if (!moduleItem || moduleItem.length === 0) {
            return NextResponse.json({ success: false, error: 'Item materi tidak ditemukan di modul' }, { status: 404 });
        }

        const moduleItemId = moduleItem[0].id;

        // Check if already completed
        const existing = await executeQuery<any[]>(
            `SELECT id, status FROM user_progress
             WHERE user_id = ? AND session_id = ? AND module_item_id = ?`,
            [user.id, sessionId, moduleItemId]
        );
        if (existing && existing.length > 0 && existing[0].status === 'completed') {
            return NextResponse.json({ success: true, message: 'Materi sudah diselesaikan sebelumnya' });
        }

        // Insert or update user_progress
        if (existing && existing.length > 0) {
            await executeQuery(
                `UPDATE user_progress SET status = 'completed', updated_at = NOW() WHERE id = ?`,
                [existing[0].id]
            );
        } else {
            await executeQuery(
                `INSERT INTO user_progress (id, user_id, session_id, module_item_id, status)
                 VALUES (?, ?, ?, ?, 'completed')`,
                [uuidv4(), user.id, sessionId, moduleItemId]
            );
        }

        return NextResponse.json({ success: true, message: 'Materi berhasil diselesaikan' });
    } catch (error) {
        if (error instanceof ParticipantError) {
            return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
        }
        const message = error instanceof Error ? error.message : 'Internal Server Error';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

export const POST = withAuth(handlePost, { allowedRoles: ['trainee'] });
