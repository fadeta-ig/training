import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import { withAuth, AuthenticatedUser } from '@/lib/api-auth';

/**
 * GET /api/participant/sessions/[id]/training/[trainingId]
 * Returns training content for the enrolled trainee.
 */
async function handleGet(
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

        // Check session timing
        const session = await executeQuery<any[]>(
            `SELECT start_time, end_time FROM sessions WHERE id = ?`,
            [sessionId]
        );
        if (!session || session.length === 0) {
            return NextResponse.json({ success: false, error: 'Sesi tidak ditemukan' }, { status: 404 });
        }

        const now = new Date();
        const start = new Date(session[0].start_time);
        const end = new Date(session[0].end_time);

        if (now < start) {
            return NextResponse.json({ success: false, error: 'Sesi belum dimulai' }, { status: 400 });
        }

        // Fetch training content
        const training = await executeQuery<any[]>(
            `SELECT id, title, content_html, video_url FROM trainings WHERE id = ?`,
            [trainingId]
        );
        if (!training || training.length === 0) {
            return NextResponse.json({ success: false, error: 'Materi tidak ditemukan' }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            data: training[0],
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Internal Server Error';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

export const GET = withAuth(handleGet, { allowedRoles: ['trainee'] });
