import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import { withAuth } from '@/lib/api-auth';
import { z } from 'zod';

const gradeSchema = z.object({
    session_id: z.string().uuid(),
    user_id: z.string().uuid(),
    question_id: z.string().uuid(),
    is_correct: z.boolean(),
});

interface QuestionData {
    points: number;
    question_type: string;
}

interface ExamScoreResult {
    total_score: number;
    module_item_id: string;
}

/**
 * Endpoint for Trainer/Admin to manually grade an essay question.
 * 1. Updates `exam_answers.is_correct` (from 0 to 1, or 1 to 0).
 * 2. Recalculates the user's total score for that specific exam session.
 * 3. Updates `user_progress.score`.
 */
async function handlePost(request: NextRequest) {
    try {
        const body = await request.json();
        const parsed = gradeSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { success: false, error: 'Validasi form gagal', details: parsed.error.flatten().fieldErrors },
                { status: 400 }
            );
        }

        const { session_id, user_id, question_id, is_correct } = parsed.data;

        // 1. Verify question exists and is actually an essay
        const questions = await executeQuery<QuestionData[]>(
            `SELECT points, question_type FROM questions WHERE id = ?`,
            [question_id]
        );

        if (!questions || questions.length === 0) {
            return NextResponse.json({ success: false, error: 'Soal tidak ditemukan' }, { status: 404 });
        }

        if (questions[0].question_type !== 'essay') {
            return NextResponse.json({ success: false, error: 'Hanya soal essay yang bisa dinilai manual' }, { status: 400 });
        }

        // 2. Update the answer's correctness
        const updateResult = await executeQuery<{ affectedRows: number }>(
            `UPDATE exam_answers 
             SET is_correct = ? 
             WHERE session_id = ? AND user_id = ? AND question_id = ?`,
            [is_correct ? 1 : 0, session_id, user_id, question_id]
        );

        if (!updateResult || updateResult.affectedRows === 0) {
            return NextResponse.json({ success: false, error: 'Jawaban peserta tidak ditemukan' }, { status: 404 });
        }

        // 3. Recalculate the entire exam score for this session run
        // Score = (Sum of points for correct answers / Total points for the whole exam) * 100
        const scoreCalculation = await executeQuery<ExamScoreResult[]>(`
            SELECT 
                (SUM(CASE WHEN ea.is_correct = 1 THEN q.points ELSE 0 END) / 
                 (SELECT SUM(points) FROM questions WHERE exam_id = (SELECT item_id FROM module_items WHERE id = mi.id)) * 100
                ) as total_score,
                mi.id as module_item_id
            FROM exam_answers ea
            JOIN questions q ON ea.question_id = q.id
            JOIN sessions s ON ea.session_id = s.id
            JOIN module_items mi ON mi.module_id = s.module_id AND mi.item_type = 'exam'
            WHERE ea.session_id = ? AND ea.user_id = ?
            GROUP BY mi.id
        `, [session_id, user_id]);

        if (scoreCalculation && scoreCalculation.length > 0) {
            const newScore = Math.round((Number(scoreCalculation[0].total_score) || 0) * 100) / 100;

            // 4. Update the user_progress record with the new score
            await executeQuery(
                `UPDATE user_progress 
                 SET score = ? 
                 WHERE user_id = ? AND session_id = ? AND module_item_id = ?`,
                [newScore, user_id, session_id, scoreCalculation[0].module_item_id]
            );

            return NextResponse.json({ 
                success: true, 
                message: 'Nilai berhasil diperbarui',
                data: { newScore }
            });
        }

        return NextResponse.json({ success: true, message: 'Status jawaban diperbarui, tapi gagal kalkulasi ulang skor total' });

    } catch (error) {
        console.error('Grading Error:', error);
        return NextResponse.json({ success: false, error: 'Terjadi kesalahan pada server' }, { status: 500 });
    }
}

// Both Admin and Trainer can manually grade
export const POST = withAuth(handlePost, { allowedRoles: ['admin', 'trainer'] });
