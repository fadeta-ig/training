import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import { withAuth } from '@/lib/api-auth';

// GET Detail Participant Progress in Session
async function handleGet(
    request: NextRequest,
    _user: any,
    context: { params: Promise<{ id: string; participantId: string }> }
) {
    try {
        const { id: sessionId, participantId } = await context.params;

        // Verify session and fetch module_id
        const sessionResult = await executeQuery<any[]>(
            `SELECT id, title, module_id, start_time, end_time FROM sessions WHERE id = ?`,
            [sessionId]
        );

        if (!sessionResult || sessionResult.length === 0) {
            return NextResponse.json({ success: false, error: 'Session not found' }, { status: 404 });
        }

        const session = sessionResult[0];

        // Verify participant is enrolled
        const participantResult = await executeQuery<any[]>(
            `SELECT sp.user_id, u.username, u.full_name 
             FROM session_participants sp
             JOIN users u ON sp.user_id = u.id
             WHERE sp.session_id = ? AND sp.user_id = ?`,
            [sessionId, participantId]
        );

        if (!participantResult || participantResult.length === 0) {
            return NextResponse.json({ success: false, error: 'Participant not enrolled in this session' }, { status: 404 });
        }

        const participant = participantResult[0];

        // Fetch all items from module and cross-join with user_progress
        const progressResult = await executeQuery<any[]>(
            `SELECT 
                mi.id AS module_item_id, 
                mi.item_type, 
                mi.item_id, 
                mi.sequence_order,
                CASE mi.item_type
                    WHEN 'training' THEN t.title
                    WHEN 'exam' THEN e.title
                END AS item_title,
                up.status AS progress_status,
                up.score,
                up.updated_at
             FROM module_items mi
             LEFT JOIN trainings t ON mi.item_type = 'training' AND mi.item_id = t.id
             LEFT JOIN exams e ON mi.item_type = 'exam' AND mi.item_id = e.id
             LEFT JOIN user_progress up ON up.module_item_id = mi.id 
                  AND up.user_id = ? 
                  AND up.session_id = ?
             WHERE mi.module_id = ?
             ORDER BY mi.sequence_order ASC`,
            [participantId, sessionId, session.module_id]
        );

        const totalItems = progressResult.length;
        const completedItems = progressResult.filter((item: any) => item.progress_status === 'completed').length;
        const progressPercentage = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

        return NextResponse.json({
            success: true,
            data: {
                session: {
                    id: session.id,
                    title: session.title,
                },
                participant: {
                    id: participant.user_id,
                    username: participant.username,
                    full_name: participant.full_name,
                },
                progress: {
                    total_items: totalItems,
                    completed_items: completedItems,
                    percentage: progressPercentage,
                    items: progressResult.map((item: any) => ({
                        module_item_id: item.module_item_id,
                        item_type: item.item_type,
                        item_title: item.item_title,
                        sequence_order: item.sequence_order,
                        status: item.progress_status || 'locked',
                        score: item.score,
                        updated_at: item.updated_at,
                    }))
                }
            }
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Internal Server Error';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

export const GET = withAuth(handleGet, { allowedRoles: ['admin'] });
