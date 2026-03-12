import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import { withAuth } from '@/lib/api-auth';

/**
 * GET /api/participant/leaderboard
 * Calculate ranking points based on training completions and exam high scores
 */
async function handleGet(request: NextRequest) {
    try {
        const query = `
            SELECT 
                u.id as user_id, 
                u.full_name, 
                u.username,
                COALESCE(p.institution, 'Peserta Umum') as institution,
                -- 50 Points for each completed training material
                (SELECT COUNT(*) * 50 
                 FROM user_progress up 
                 WHERE up.user_id = u.id AND up.status = 'completed' AND up.material_id IS NOT NULL) as training_points,
                -- Sum of Highest Scores per Exam
                COALESCE((
                    SELECT SUM(max_score) FROM (
                        SELECT exam_id, MAX(score) as max_score 
                        FROM exam_answers ea 
                        WHERE ea.user_id = u.id 
                        GROUP BY exam_id
                    ) as highest_exam_scores
                ), 0) as exam_points
            FROM users u
            LEFT JOIN participant_profiles p ON u.id = p.user_id
            WHERE u.role = 'trainee'
            ORDER BY (training_points + exam_points) DESC, u.full_name ASC
            LIMIT 100
        `;

        const ranks = await executeQuery<any[]>(query);

        // Compute total_points and assign rank number
        const formattedData = ranks.map((r, index) => {
            const training_points = Number(r.training_points) || 0;
            const exam_points = Number(r.exam_points) || 0;

            return {
                rank: index + 1,
                user_id: r.user_id,
                full_name: r.full_name,
                username: r.username,
                institution: r.institution,
                training_points,
                exam_points,
                total_points: training_points + exam_points
            };
        });

        return NextResponse.json({ success: true, data: formattedData });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Kesalahan server komputasi leaderboard';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

export const GET = withAuth(handleGet);
