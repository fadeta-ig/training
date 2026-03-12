import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import { withAuth, AuthenticatedUser } from '@/lib/api-auth';
import { v4 as uuidv4 } from 'uuid';
import pool from '@/lib/db';

/**
 * POST /api/participant/sessions/[id]/exam/[examId]/submit
 * Submit all exam answers and auto-grade where possible.
 */
async function handlePost(
    request: NextRequest,
    user: AuthenticatedUser,
    context: { params: Promise<{ id: string; examId: string }> }
) {
    let connection;
    try {
        const { id: sessionId, examId } = await context.params;
        const body = await request.json();
        const { answers } = body as { answers: { question_id: string; selected_option: string }[] };

        if (!answers || !Array.isArray(answers)) {
            return NextResponse.json({ success: false, error: 'Jawaban tidak valid' }, { status: 400 });
        }

        // Verify enrollment
        const enrollment = await executeQuery<any[]>(
            `SELECT id FROM session_participants WHERE session_id = ? AND user_id = ?`,
            [sessionId, user.id]
        );
        if (!enrollment || enrollment.length === 0) {
            return NextResponse.json({ success: false, error: 'Tidak terdaftar' }, { status: 403 });
        }

        // Check SEB requirement
        const session = await executeQuery<any[]>(
            `SELECT require_seb FROM sessions WHERE id = ?`,
            [sessionId]
        );
        if (session && session.length > 0 && session[0].require_seb) {
            const userAgent = request.headers.get('user-agent') || '';
            if (!userAgent.includes('SafeExamBrowser')) {
                return NextResponse.json(
                    { success: false, error: 'Pengumpulan ujian mewajibkan penggunaan Safe Exam Browser (SEB).' },
                    { status: 403 }
                );
            }
        }

        // Fetch all questions for grading
        const questions = await executeQuery<any[]>(
            `SELECT id, question_type, options_json, correct_option_index, correct_answer, points
             FROM questions WHERE exam_id = ?`,
            [examId]
        );

        const questionMap = new Map(questions.map((q: any) => [q.id, q]));

        // Fetch exam passing grade
        const exam = await executeQuery<any[]>(
            `SELECT passing_grade FROM exams WHERE id = ?`,
            [examId]
        );
        const passingGrade = exam?.[0]?.passing_grade || 70;

        connection = await pool.getConnection();
        await connection.beginTransaction();

        // Delete existing answers first (allow re-submit)
        await connection.execute(
            `DELETE FROM exam_answers WHERE user_id = ? AND session_id = ?`,
            [user.id, sessionId]
        );

        let totalPoints = 0;
        let earnedPoints = 0;

        for (const answer of answers) {
            const q = questionMap.get(answer.question_id);
            if (!q) continue;

            totalPoints += q.points || 1;

            let isCorrect = false;

            switch (q.question_type) {
                case 'multiple_choice':
                case 'true_false':
                    isCorrect = parseInt(answer.selected_option) === q.correct_option_index;
                    break;
                case 'multiple_select': {
                    const parsed = typeof q.options_json === 'string' ? JSON.parse(q.options_json) : q.options_json;
                    const correctIndices = (parsed?.correct_indices || []).sort().join(',');
                    const selectedIndices = answer.selected_option.split(',').map(Number).sort().join(',');
                    isCorrect = correctIndices === selectedIndices;
                    break;
                }
                case 'short_answer':
                    isCorrect = q.correct_answer &&
                        answer.selected_option.trim().toLowerCase() === q.correct_answer.trim().toLowerCase();
                    break;
                case 'essay':
                    // Essay is manually graded, always mark as false for now
                    isCorrect = false;
                    break;
                case 'matching':
                    // Matching: selected_option is JSON string of pairs
                    try {
                        const parsed = typeof q.options_json === 'string' ? JSON.parse(q.options_json) : q.options_json;
                        const correctPairs = parsed.pairs;
                        const submittedPairs = JSON.parse(answer.selected_option);
                        isCorrect = correctPairs.every((cp: any, idx: number) =>
                            submittedPairs[idx]?.left === cp.left && submittedPairs[idx]?.right === cp.right
                        );
                    } catch {
                        isCorrect = false;
                    }
                    break;
            }

            if (isCorrect) {
                earnedPoints += q.points || 1;
            }

            await connection.execute(
                `INSERT INTO exam_answers (id, user_id, session_id, question_id, selected_option, is_correct)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [uuidv4(), user.id, sessionId, answer.question_id, answer.selected_option, isCorrect]
            );
        }

        const score = totalPoints > 0 ? (earnedPoints / totalPoints) * 100 : 0;
        const passed = score >= passingGrade;

        // Update user_progress for this exam module_item
        const moduleItem = await executeQuery<any[]>(
            `SELECT mi.id FROM module_items mi
             JOIN sessions s ON s.module_id = mi.module_id
             WHERE s.id = ? AND mi.item_type = 'exam' AND mi.item_id = ?`,
            [sessionId, examId]
        );

        if (moduleItem && moduleItem.length > 0) {
            const existing = await executeQuery<any[]>(
                `SELECT id FROM user_progress WHERE user_id = ? AND session_id = ? AND module_item_id = ?`,
                [user.id, sessionId, moduleItem[0].id]
            );

            if (existing && existing.length > 0) {
                await connection.execute(
                    `UPDATE user_progress SET status = 'completed', score = ? WHERE id = ?`,
                    [score, existing[0].id]
                );
            } else {
                await connection.execute(
                    `INSERT INTO user_progress (id, user_id, session_id, module_item_id, status, score)
                     VALUES (?, ?, ?, ?, 'completed', ?)`,
                    [uuidv4(), user.id, sessionId, moduleItem[0].id, score]
                );
            }
        }

        await connection.commit();
        connection.release();

        return NextResponse.json({
            success: true,
            data: {
                score: Math.round(score * 100) / 100,
                passed,
                earnedPoints,
                totalPoints,
                passingGrade,
            },
        });
    } catch (error) {
        if (connection) {
            await connection.rollback();
            connection.release();
        }
        const message = error instanceof Error ? error.message : 'Internal Server Error';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

export const POST = withAuth(handlePost, { allowedRoles: ['trainee'] });
