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
            `SELECT require_seb, seb_config_key FROM sessions WHERE id = ?`,
            [sessionId]
        );
        if (session && session.length > 0 && session[0].require_seb) {
            const userAgent = request.headers.get('user-agent') || '';
            const configKeyHash = request.headers.get('x-safeexambrowser-configkeyhash') || '';

            if (!userAgent.includes('SafeExamBrowser')) {
                return NextResponse.json(
                    { success: false, error: 'Pengumpulan ujian mewajibkan penggunaan Safe Exam Browser (SEB).' },
                    { status: 403 }
                );
            }

            // Verify configuration key hash if it's set in the session
            if (session[0].seb_config_key && configKeyHash !== session[0].seb_config_key) {
                return NextResponse.json(
                    { 
                        success: false, 
                        error: 'Konfigurasi Safe Exam Browser (SEB) tidak cocok saat pengumpulan data.' 
                    },
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

        // Get attempt number
        const progressRes = await executeQuery<any[]>(
            `SELECT up.id, up.attempts_count 
             FROM user_progress up
             JOIN module_items mi ON up.module_item_id = mi.id
             WHERE up.user_id = ? AND up.session_id = ? AND mi.item_type = 'exam' AND mi.item_id = ?`,
            [user.id, sessionId, examId]
        );
        let attemptNumber = 1;
        let progressId = null;

        if (progressRes && progressRes.length > 0) {
            attemptNumber = (progressRes[0].attempts_count || 0) + 1;
            progressId = progressRes[0].id;
        }

        // Delete existing answers only for the current attempt (allows resume-then-submit flow safely)
        await connection.execute(
            `DELETE FROM exam_answers WHERE user_id = ? AND session_id = ? AND attempt_number = ?`,
            [user.id, sessionId, attemptNumber]
        );

        let totalPoints = 0;
        let earnedPoints = 0;

        const answerValues: any[] = [];
        const placeholders: string[] = [];

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

            answerValues.push(
                uuidv4(),
                user.id,
                sessionId,
                answer.question_id,
                answer.selected_option,
                isCorrect,
                attemptNumber
            );
            placeholders.push('(?, ?, ?, ?, ?, ?, ?)');
        }

        if (answerValues.length > 0) {
            await connection.execute(
                `INSERT INTO exam_answers (id, user_id, session_id, question_id, selected_option, is_correct, attempt_number)
                 VALUES ${placeholders.join(', ')}`,
                answerValues
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
            if (progressId) {
                // Determine the best score across attempts (or just use latest, but best is usually preferred for remedial)
                // Actually, typically the latest attempt is the one recorded, but we can store it.
                // Reset last_attempt_start so next attempt generates a newly fresh timer.
                await connection.execute(
                    `UPDATE user_progress SET status = 'completed', score = ?, attempts_count = attempts_count + 1, last_attempt_start = NULL WHERE id = ?`,
                    [score, progressId]
                );
            } else {
                await connection.execute(
                    `INSERT INTO user_progress (id, user_id, session_id, module_item_id, status, score, attempts_count)
                     VALUES (?, ?, ?, ?, 'completed', ?, 1)`,
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
