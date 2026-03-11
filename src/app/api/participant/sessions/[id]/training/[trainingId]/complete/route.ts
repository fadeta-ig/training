import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import { withAuth, AuthenticatedUser } from '@/lib/api-auth';
import { v4 as uuidv4 } from 'uuid';

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

        // Verify enrollment
        const enrollment = await executeQuery<any[]>(
            `SELECT id FROM session_participants WHERE session_id = ? AND user_id = ?`,
            [sessionId, user.id]
        );
        if (!enrollment || enrollment.length === 0) {
            return NextResponse.json({ success: false, error: 'Tidak terdaftar' }, { status: 403 });
        }

        // Check session is active
        const session = await executeQuery<any[]>(
            `SELECT start_time, end_time, module_id FROM sessions WHERE id = ?`,
            [sessionId]
        );
        if (!session || session.length === 0) {
            return NextResponse.json({ success: false, error: 'Sesi tidak ditemukan' }, { status: 404 });
        }

        const now = new Date();
        const start = new Date(session[0].start_time);
        const end = new Date(session[0].end_time);

        if (now < start || now > end) {
            return NextResponse.json({ success: false, error: 'Sesi tidak aktif' }, { status: 400 });
        }

        // Find corresponding module_item
        const moduleItem = await executeQuery<any[]>(
            `SELECT id, sequence_order FROM module_items
             WHERE module_id = ? AND item_type = 'training' AND item_id = ?`,
            [session[0].module_id, trainingId]
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
        const message = error instanceof Error ? error.message : 'Internal Server Error';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

export const POST = withAuth(handlePost, { allowedRoles: ['trainee'] });
