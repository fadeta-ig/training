import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import { withAuth, type AuthenticatedUser } from '@/lib/api-auth';
import { resolveSessionCategoryScope, assertTrainerSessionAccess } from '@/lib/data-scoping';
import path from 'path';

interface SessionData {
    id: string;
    title: string;
    start_time: string;
    end_time: string;
    require_seb: boolean;
    enable_proctoring: boolean;
    module_title: string;
}

interface SnapshotData {
    id: string;
    user_id: string;
    session_id: string;
    image_url: string;
    captured_at: string;
    full_name: string;
    username: string;
}

async function handleGet(request: NextRequest, user: AuthenticatedUser) {
    try {
        const { searchParams } = new URL(request.url);
        const sessionId = searchParams.get('session_id');

        // Scoping jika trainer
        const scope = await resolveSessionCategoryScope(user, 'm');

        // If no sessionId, return list of active/recent sessions that have proctoring
        if (!sessionId) {
            let query = `
                SELECT 
                    s.id, s.title, s.start_time, s.end_time, s.require_seb, s.enable_proctoring,
                    m.title as module_title
                FROM sessions s
                JOIN modules m ON s.module_id = m.id
                WHERE 1=1 ${scope.sqlCondition}
                ORDER BY s.end_time DESC
                LIMIT 50
            `;

            const activeSessions = await executeQuery<SessionData[]>(query, scope.params);
            return NextResponse.json({ success: true, data: activeSessions });
        }

        // Anti-IDOR: Jika sessionId diberikan, validasi apakah trainer berhak mengakses sesi ini
        const hasAccess = await assertTrainerSessionAccess(user, sessionId);
        if (!hasAccess) {
            return NextResponse.json(
                { success: false, error: 'Anda tidak memiliki akses proctoring untuk sesi ini' },
                { status: 403 }
            );
        }

        // If sessionId provided, get the LATEST snapshot for each participant in that session
        const snapshots = await executeQuery<SnapshotData[]>(`
            SELECT 
                ps.id, ps.user_id, ps.session_id, ps.image_url, ps.captured_at,
                u.full_name, u.username
            FROM proctor_snapshots ps
            JOIN users u ON ps.user_id = u.id
            INNER JOIN (
                SELECT user_id, MAX(captured_at) as max_captured_at
                FROM proctor_snapshots
                WHERE session_id = ?
                GROUP BY user_id
            ) latest ON ps.user_id = latest.user_id AND ps.captured_at = latest.max_captured_at
            WHERE ps.session_id = ?
            ORDER BY u.full_name ASC
        `, [sessionId, sessionId]);

        const formattedSnapshots = snapshots.map((snap) => {
            let directUrl = snap.image_url;
            if (snap.image_url?.startsWith('/uploads/proctor/')) {
                directUrl = `/api/proctor/image/${path.basename(snap.image_url)}`;
            }
            return {
                ...snap,
                image_url: directUrl,
            };
        });

        return NextResponse.json({ success: true, data: formattedSnapshots });

    } catch (error) {
        const message = error instanceof Error ? error.message : 'Internal Server Error';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

// Both Admin and Trainer (who is essentially an instructor) can monitor sessions
export const GET = withAuth(handleGet, { allowedRoles: ['admin', 'trainer'] });
