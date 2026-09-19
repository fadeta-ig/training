import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import { withAuth, AuthenticatedUser } from '@/lib/api-auth';
import { normalizeDbDateToIso } from '@/lib/timezone';

/**
 * GET /api/participant/sessions
 * Returns all sessions the authenticated trainee is enrolled in,
 * along with module info and session status.
 */
async function handleGet(_request: NextRequest, user: AuthenticatedUser) {
    try {
        const sessions = await executeQuery<any[]>(
            `SELECT
                s.id,
                s.title,
                s.start_time,
                s.end_time,
                s.session_type,
                s.parent_session_id,
                s.remedial_cycle,
                s.require_seb,
                s.show_score,
                s.enable_proctoring,
                sp.graduation_status,
                sp.graduation_decided_at,
                sp.graduation_notes,
                sp.skl_number,
                sp.certificate_file_url,
                sp.certificate_number,
                m.title AS module_title,
                m.id AS module_id,
                (SELECT COUNT(*)
                 FROM module_items mi
                 WHERE mi.module_id = m.id
                   AND (
                       s.session_type <> 'remedial'
                       OR mi.item_type = 'training'
                       OR EXISTS (
                           SELECT 1 FROM session_participant_exam_assignments assignment
                           WHERE assignment.session_id = s.id
                             AND assignment.user_id = sp.user_id
                             AND assignment.module_item_id = mi.id
                       )
                   )) AS total_items,
                (SELECT COUNT(*) FROM user_progress up
                    WHERE up.user_id = ? AND up.session_id = s.id AND up.status = 'completed') AS completed_items
            FROM session_participants sp
            JOIN sessions s ON sp.session_id = s.id
            LEFT JOIN modules m ON s.module_id = m.id
            WHERE sp.user_id = ?
            ORDER BY s.start_time ASC`,
            [user.id, user.id]
        );

        const normalized = (sessions || []).map((s) => ({
            ...s,
            start_time: normalizeDbDateToIso(s.start_time),
            end_time: normalizeDbDateToIso(s.end_time),
            require_seb: Boolean(s.require_seb),
            show_score: s.show_score === 1 || s.show_score === true || s.show_score === '1',
            enable_proctoring: s.enable_proctoring === 1 || s.enable_proctoring === true || s.enable_proctoring === '1',
        }));

        return NextResponse.json({ success: true, data: normalized });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Internal Server Error';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

export const GET = withAuth(handleGet, { allowedRoles: ['trainee'] });
