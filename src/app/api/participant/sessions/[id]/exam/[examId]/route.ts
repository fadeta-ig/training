import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import { withAuth, AuthenticatedUser } from '@/lib/api-auth';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import {
    assertCurrentItemAccessible,
    getItemProgress,
    getSessionModuleItem,
    verifyEnrollment,
    validateSessionTiming,
    validateSebAccess,
    ParticipantError,
} from '@/lib/participant-helpers';

function shuffleValues<T>(values: T[]): T[] {
    const result = [...values];
    for (let i = result.length - 1; i > 0; i--) {
        const j = crypto.randomInt(i + 1);
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}

/**
 * GET /api/participant/sessions/[id]/exam/[examId]
 * Returns exam questions for the trainee to answer.
 * Only returns questions if the session is currently active.
 */
async function handleGet(
    _request: NextRequest,
    user: AuthenticatedUser,
    context: { params: Promise<{ id: string; examId: string }> }
) {
    try {
        const { id: sessionId, examId } = await context.params;

        await verifyEnrollment(sessionId, user.id);
        const { session, isUpcoming, isEnded } = await validateSessionTiming(sessionId);
        const now = new Date();

        if (isUpcoming) {
            return NextResponse.json({ success: false, error: 'Sesi belum dimulai' }, { status: 400 });
        }
        if (isEnded) {
            return NextResponse.json({ success: false, error: 'Sesi sudah berakhir' }, { status: 400 });
        }

        validateSebAccess(_request, session);
        const moduleItem = await getSessionModuleItem(session.module_id, 'exam', examId);

        // Fetch exam info
        const exam = await executeQuery<any[]>(
            `SELECT id, title, duration_minutes, passing_grade, max_attempts, allow_remedial FROM exams WHERE id = ?`,
            [examId]
        );
        if (!exam || exam.length === 0) {
            return NextResponse.json({ success: false, error: 'Ujian tidak ditemukan' }, { status: 404 });
        }

        const rules = exam[0];
        const currentProgress = await getItemProgress(sessionId, user.id, moduleItem.id);
        const canRetake = currentProgress?.status === 'completed'
            && !!rules.allow_remedial
            && Number(currentProgress.score ?? 0) < Number(rules.passing_grade)
            && Number(currentProgress.attempts_count || 0) < Number(rules.max_attempts || 1);

        if (currentProgress?.status === 'completed' && !canRetake) {
            return NextResponse.json({ success: false, error: 'Ujian sudah diselesaikan' }, { status: 403 });
        }

        await assertCurrentItemAccessible(sessionId, user.id, session, moduleItem, canRetake);

        const nowStr = now.toISOString().slice(0, 19).replace('T', ' ');
        await executeQuery(
            `INSERT INTO user_progress (id, user_id, session_id, module_item_id, status, last_attempt_start)
             VALUES (?, ?, ?, ?, 'open', ?)
             ON DUPLICATE KEY UPDATE id = id`,
            [uuidv4(), user.id, sessionId, moduleItem.id, nowStr]
        );

        // Get or initialize last_attempt_start
        const progress = await executeQuery<any[]>(
            `SELECT up.id, up.last_attempt_start, up.attempts_count 
             FROM user_progress up
             WHERE up.user_id = ? AND up.session_id = ? AND up.module_item_id = ?`,
            [user.id, sessionId, moduleItem.id]
        );

        let attemptStart = now;
        let attemptNumber = 1;
        if (progress && progress.length > 0) {
            const up = progress[0];
            attemptNumber = (up.attempts_count || 0) + 1;

            if (!up.last_attempt_start) {
                // Initialize start time for this attempt — convert Date to MySQL-compatible string
                await executeQuery(
                    `UPDATE user_progress SET last_attempt_start = ? WHERE id = ? AND last_attempt_start IS NULL`,
                    [nowStr, up.id]
                );
                const refreshed = await executeQuery<Array<{ last_attempt_start: string }>>(
                    `SELECT last_attempt_start FROM user_progress WHERE id = ? LIMIT 1`,
                    [up.id]
                );
                attemptStart = new Date(refreshed[0]?.last_attempt_start || nowStr);
            } else {
                attemptStart = new Date(up.last_attempt_start);
            }
        } else {
            await executeQuery(
                `INSERT INTO user_progress (id, user_id, session_id, module_item_id, status, last_attempt_start)
                 VALUES (?, ?, ?, ?, 'open', ?)`,
                [uuidv4(), user.id, sessionId, moduleItem.id, nowStr]
            );
        }

        // Fetch questions (without correct answers for security)
        const questions = await executeQuery<any[]>(
            `SELECT id, question_type, question_text, question_image, options_json, points
             FROM questions WHERE exam_id = ?`,
            [examId]
        );

        // Sanitize options for matching type (don't reveal pairs)
        const sanitized = questions.map((q: any) => {
            const parsed = q.options_json ? (typeof q.options_json === 'string' ? JSON.parse(q.options_json) : q.options_json) : null;

            if (q.question_type === 'matching' && parsed?.pairs) {
                // Shuffle the right column for matching
                const rights = shuffleValues(parsed.pairs.map((p: any) => p.right));
                return {
                    ...q,
                    options_json: {
                        lefts: parsed.pairs.map((p: any) => p.left),
                        rights,
                    },
                };
            }
            return q;
        });

        // Fetch any existing answers (in case of resume)
        // We now filter by attempt_number to only load answers for the CURRENT attempt
        const existingAnswers = await executeQuery<any[]>(
            `SELECT ea.question_id, ea.selected_option
             FROM exam_answers ea
             INNER JOIN questions q ON q.id = ea.question_id
             WHERE ea.user_id = ?
               AND ea.session_id = ?
               AND ea.attempt_number = ?
               AND q.exam_id = ?`,
            [user.id, sessionId, attemptNumber, examId]
        );

        return NextResponse.json({
            success: true,
            data: {
                exam: exam[0],
                questions: sanitized,
                existingAnswers,
                serverTime: now.toISOString(),
                sessionEnd: session.end_time,
                attemptStart: attemptStart.toISOString(),
                attemptNumber: attemptNumber,
            },
        });
    } catch (error) {
        if (error instanceof ParticipantError) {
            return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
        }
        const message = error instanceof Error ? error.message : 'Internal Server Error';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

export const GET = withAuth(handleGet, { allowedRoles: ['trainee'] });
