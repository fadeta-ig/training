import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import { withAuth, AuthenticatedUser } from '@/lib/api-auth';

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
                s.require_seb,
                m.title AS module_title,
                m.id AS module_id,
                (SELECT COUNT(*) FROM module_items mi WHERE mi.module_id = m.id) AS total_items,
                (SELECT COUNT(*) FROM user_progress up
                    WHERE up.user_id = ? AND up.session_id = s.id AND up.status = 'completed') AS completed_items
            FROM session_participants sp
            JOIN sessions s ON sp.session_id = s.id
            LEFT JOIN modules m ON s.module_id = m.id
            WHERE sp.user_id = ?
            ORDER BY s.start_time ASC`,
            [user.id, user.id]
        );

        return NextResponse.json({ success: true, data: sessions });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Internal Server Error';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

export const GET = withAuth(handleGet, { allowedRoles: ['trainee'] });
