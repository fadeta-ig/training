import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import { withAuth, AuthenticatedUser } from '@/lib/api-auth';
import { verifyEnrollment, validateSessionTiming, ParticipantError } from '@/lib/participant-helpers';

/**
 * GET /api/participant/sessions/[id]
 * Returns session detail with module items (trainings + exams) for the enrolled trainee.
 */
async function handleGet(
    _request: NextRequest,
    user: AuthenticatedUser,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id: sessionId } = await context.params;

        // Shared helpers handle 404s/403s internally by throwing ParticipantError
        await verifyEnrollment(sessionId, user.id);
        const { session, isActive, isEnded } = await validateSessionTiming(sessionId);

        // Fetch module items with progress
        const items = await executeQuery<any[]>(
            `SELECT
                mi.id AS module_item_id,
                mi.item_type,
                mi.item_id,
                mi.sequence_order,
                CASE mi.item_type
                    WHEN 'training' THEN t.title
                    WHEN 'exam' THEN e.title
                END AS item_title,
                CASE mi.item_type
                    WHEN 'exam' THEN e.duration_minutes
                    ELSE NULL
                END AS duration_minutes,
                CASE mi.item_type
                    WHEN 'exam' THEN e.allow_remedial
                    ELSE FALSE
                END AS allow_remedial,
                CASE mi.item_type
                    WHEN 'exam' THEN e.max_attempts
                    ELSE 1
                END AS max_attempts,
                CASE mi.item_type
                    WHEN 'exam' THEN e.passing_grade
                    ELSE NULL
                END AS passing_grade,
                up.status AS raw_progress_status,
                up.score,
                up.attempts_count
            FROM module_items mi
            LEFT JOIN trainings t ON mi.item_type = 'training' AND mi.item_id = t.id
            LEFT JOIN exams e ON mi.item_type = 'exam' AND mi.item_id = e.id
            LEFT JOIN user_progress up ON up.module_item_id = mi.id AND up.user_id = ? AND up.session_id = ?
            WHERE mi.module_id = ?
            ORDER BY mi.sequence_order ASC`,
            [user.id, sessionId, session.module_id]
        );

        // Apply sequential phase unlock based on session timing
        // Rule: items must be completed in sequence_order. Only the FIRST uncompleted item is 'open'.
        let foundFirstIncomplete = false;

        const mappedItems = items.map((item: any) => {
            let progressStatus = item.raw_progress_status;
            let canRetake = false;

            if (progressStatus === 'completed') {
                // Completed items generally remain accessible
                if (item.item_type === 'exam') {
                    const parsedScore = Number(item.score);
                    const parsedPassing = Number(item.passing_grade);
                    const allowRemedial = item.allow_remedial === 1 || item.allow_remedial === true;
                    const maxAttempts = Number(item.max_attempts) || 1;
                    const currentAttempts = Number(item.attempts_count) || 1;

                    if (parsedScore < parsedPassing && allowRemedial && currentAttempts < maxAttempts) {
                        canRetake = true;
                    }
                }
            } else if (!isActive && !isEnded) {
                // Session hasn't started → all locked
                progressStatus = 'locked';
            } else if (isActive) {
                if (!foundFirstIncomplete) {
                    // This is the first non-completed item → it's open (accessible)
                    progressStatus = 'open';
                    foundFirstIncomplete = true;
                } else {
                    // Previous item not yet completed → locked
                    progressStatus = 'locked';
                }
            } else {
                // Session ended, not completed → show as locked (missed)
                progressStatus = progressStatus || 'locked';
            }

            return {
                module_item_id: item.module_item_id,
                item_type: item.item_type,
                item_id: item.item_id,
                sequence_order: item.sequence_order,
                item_title: item.item_title,
                duration_minutes: item.duration_minutes,
                progress_status: progressStatus,
                score: session.show_score ? item.score : null,
                can_retake: canRetake,
                attempts_count: item.attempts_count || 0,
                max_attempts: item.max_attempts || 1
            };
        });

        return NextResponse.json({
            success: true,
            data: {
                ...session,
                show_score: !!session.show_score,
                items: mappedItems,
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
