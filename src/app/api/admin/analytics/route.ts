import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import { withAuth } from '@/lib/api-auth';
import logger from '@/lib/logger';

// ----------------------------------------------------------------------
// GET: Laman Utama Analytics Dashboard Admin
// ----------------------------------------------------------------------
async function handleGet(_request: NextRequest) {
    try {
        // Parallelize independent metric and report queries
        const [
            totalUsers,
            totalSessions,
            totalTrainings,
            avgScore,
            upcomingSessions,
            recentPerformance
        ] = await Promise.all([
            executeQuery<{ count: number }[]>(`SELECT COUNT(*) as count FROM users WHERE role = 'trainee'`),
            executeQuery<{ count: number }[]>(`SELECT COUNT(*) as count FROM sessions`),
            executeQuery<{ count: number }[]>(`SELECT COUNT(*) as count FROM trainings`),
            executeQuery<{ avg_score: string | null }[]>(`
                SELECT AVG(score) as avg_score 
                FROM user_progress 
                WHERE status = 'completed' AND score IS NOT NULL
            `),
            executeQuery<any[]>(`
                SELECT s.id, s.title, s.start_time, s.end_time, COUNT(sp.user_id) as participants_count
                FROM sessions s
                LEFT JOIN session_participants sp ON s.id = sp.session_id
                WHERE start_time > NOW()
                GROUP BY s.id, s.title, s.start_time, s.end_time
                ORDER BY start_time ASC
                LIMIT 4
            `),
            executeQuery<any[]>(`
                SELECT up.id, u.full_name as participant_name, s.title as session_name, up.score, up.updated_at
                FROM user_progress up
                JOIN users u ON up.user_id = u.id
                JOIN sessions s ON up.session_id = s.id
                WHERE up.status = 'completed' AND up.score IS NOT NULL
                ORDER BY up.updated_at DESC
                LIMIT 5
            `),
        ]);

        const responseData = {
            overview: {
                totalTrainees: totalUsers[0]?.count || 0,
                totalSessions: totalSessions[0]?.count || 0,
                totalTrainings: totalTrainings[0]?.count || 0,
                averageScore: avgScore[0]?.avg_score ? parseFloat(avgScore[0].avg_score).toFixed(1) : '0.0',
            },
            upcomingSessions,
            recentPerformance
        };

        return NextResponse.json({ success: true, data: responseData });

    } catch (error) {
        logger.error('ADMIN_ANALYTICS', 'Gagal memuat data analytics dashboard', error);
        return NextResponse.json({ success: false, error: 'Gagal memuat data analytics. Silakan coba beberapa saat lagi.' }, { status: 500 });
    }
}

// Hanya dapat diakses administrator
export const GET = withAuth(handleGet, { allowedRoles: ['admin'] });
