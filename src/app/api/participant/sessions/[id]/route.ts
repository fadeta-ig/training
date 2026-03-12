import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import { withAuth, AuthenticatedUser } from '@/lib/api-auth';

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

        // Verify enrollment
        const enrollment = await executeQuery<any[]>(
            `SELECT id FROM session_participants WHERE session_id = ? AND user_id = ?`,
            [sessionId, user.id]
        );

        if (!enrollment || enrollment.length === 0) {
            return NextResponse.json(
                { success: false, error: 'Anda tidak terdaftar di sesi ini' },
                { status: 403 }
            );
        }

        // Fetch session
        const sessionResult = await executeQuery<any[]>(
            `SELECT s.id, s.title, s.start_time, s.end_time, s.require_seb,
                    m.title AS module_title, m.id AS module_id
             FROM sessions s
             LEFT JOIN modules m ON s.module_id = m.id
             WHERE s.id = ?`,
            [sessionId]
        );

        if (!sessionResult || sessionResult.length === 0) {
            return NextResponse.json({ success: false, error: 'Sesi tidak ditemukan' }, { status: 404 });
        }

        const session = sessionResult[0];

        // Determine session status server-side
        const now = new Date();
        const start = new Date(session.start_time);
        const end = new Date(session.end_time);
        const isActive = now >= start && now <= end;
        const isEnded = now > end;

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
                score: item.score,
                can_retake: canRetake,
                attempts_count: item.attempts_count || 0,
                max_attempts: item.max_attempts || 1
            };
        });

        return NextResponse.json({
            success: true,
            data: {
                ...session,
                items: mappedItems,
            },
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Internal Server Error';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

export const GET = withAuth(handleGet, { allowedRoles: ['trainee'] });
