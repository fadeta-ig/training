import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import { withAuth, AuthenticatedUser } from '@/lib/api-auth';
import { verifyEnrollment, validateSessionTiming, ParticipantError } from '@/lib/participant-helpers';

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

        await verifyEnrollment(sessionId, user.id);
        const { isUpcoming } = await validateSessionTiming(sessionId);

        if (isUpcoming) {
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
        if (error instanceof ParticipantError) {
            return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
        }
        const message = error instanceof Error ? error.message : 'Internal Server Error';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

export const GET = withAuth(handleGet, { allowedRoles: ['trainee'] });
