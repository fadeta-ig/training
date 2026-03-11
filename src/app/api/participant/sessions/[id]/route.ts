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
                up.status AS raw_progress_status,
                up.score
            FROM module_items mi
            LEFT JOIN trainings t ON mi.item_type = 'training' AND mi.item_id = t.id
            LEFT JOIN exams e ON mi.item_type = 'exam' AND mi.item_id = e.id
            LEFT JOIN user_progress up ON up.module_item_id = mi.id AND up.user_id = ? AND up.session_id = ?
            WHERE mi.module_id = ?
            ORDER BY mi.sequence_order ASC`,
            [user.id, sessionId, session.module_id]
        );

        // Apply smart defaults based on session timing
        const mappedItems = items.map((item: any) => {
            let progressStatus = item.raw_progress_status;

            if (!progressStatus) {
                // No user_progress record exists yet
                if (isActive) {
                    progressStatus = 'open'; // Session active → items are accessible
                } else if (isEnded) {
                    progressStatus = 'completed'; // Session ended → show as done context
                } else {
                    progressStatus = 'locked'; // Session hasn't started → locked
                }
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
