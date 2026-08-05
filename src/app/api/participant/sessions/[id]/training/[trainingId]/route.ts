import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import { withAuth, AuthenticatedUser } from '@/lib/api-auth';
import {
    assertCurrentItemAccessible,
    getItemProgress,
    getSessionModuleItem,
    verifyEnrollment,
    validateSessionTiming,
    ParticipantError,
} from '@/lib/participant-helpers';
import { sanitizeRichHtml } from '@/lib/sanitize';

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
        const { session, isUpcoming, isEnded } = await validateSessionTiming(sessionId);

        if (isUpcoming) {
            return NextResponse.json({ success: false, error: 'Sesi belum dimulai' }, { status: 400 });
        }

        const moduleItem = await getSessionModuleItem(session.module_id, 'training', trainingId);

        if (isEnded) {
            const progress = await getItemProgress(sessionId, user.id, moduleItem.id);

            // Check if the trainee completed all items/tasks in the session
            const completionStats = await executeQuery<{ total: number; completed: number }[]>(
                `SELECT 
                    (SELECT COUNT(*) FROM module_items WHERE module_id = ?) AS total,
                    (SELECT COUNT(*) FROM user_progress WHERE user_id = ? AND session_id = ? AND status = 'completed') AS completed`,
                [session.module_id, user.id, sessionId]
            );

            const totalItems = Number(completionStats?.[0]?.total || 0);
            const completedItems = Number(completionStats?.[0]?.completed || 0);
            const isSessionFullyCompleted = totalItems > 0 && completedItems >= totalItems;

            // Accessible if the material itself is completed OR if the entire session (exams + tasks) was completed
            if (progress?.status !== 'completed' && !isSessionFullyCompleted) {
                return NextResponse.json({ success: false, error: 'Sesi sudah berakhir' }, { status: 400 });
            }
        }

        await assertCurrentItemAccessible(sessionId, user.id, session, moduleItem, true);

        // Fetch training content
        const training = await executeQuery<any[]>(
            `SELECT id, title, content_html FROM trainings WHERE id = ?`,
            [trainingId]
        );
        if (!training || training.length === 0) {
            return NextResponse.json({ success: false, error: 'Materi tidak ditemukan' }, { status: 404 });
        }

        // Fetch associated media attachments
        const media = await executeQuery<any[]>(
            `SELECT id, media_type, media_url, original_filename, sequence_order FROM training_media WHERE training_id = ? ORDER BY sequence_order ASC`,
            [trainingId]
        );

        // Check if progress is already completed
        const itemProgress = await getItemProgress(sessionId, user.id, moduleItem.id);
        const isCompleted = itemProgress?.status === 'completed';

        return NextResponse.json({
            success: true,
            data: {
                ...training[0],
                content_html: sanitizeRichHtml(training[0].content_html),
                media: media || [],
                is_completed: isCompleted,
            },
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
