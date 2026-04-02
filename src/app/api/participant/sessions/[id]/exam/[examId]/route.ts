import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import { withAuth, AuthenticatedUser } from '@/lib/api-auth';
import { v4 as uuidv4 } from 'uuid';
import { verifyEnrollment, validateSessionTiming, validateSebAccess, ParticipantError } from '@/lib/participant-helpers';

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

        // Fetch exam info
        const exam = await executeQuery<any[]>(
            `SELECT id, title, duration_minutes, passing_grade FROM exams WHERE id = ?`,
            [examId]
        );
        if (!exam || exam.length === 0) {
            return NextResponse.json({ success: false, error: 'Ujian tidak ditemukan' }, { status: 404 });
        }

        // Get or initialize last_attempt_start
        const progress = await executeQuery<any[]>(
            `SELECT up.id, up.last_attempt_start, up.attempts_count 
             FROM user_progress up
             JOIN module_items mi ON up.module_item_id = mi.id
             WHERE up.user_id = ? AND up.session_id = ? AND mi.item_type = 'exam' AND mi.item_id = ?`,
            [user.id, sessionId, examId]
        );

        let attemptStart = now;
        let attemptNumber = 1;

        if (progress && progress.length > 0) {
            const up = progress[0];
            attemptNumber = (up.attempts_count || 0) + 1;

            if (!up.last_attempt_start) {
                // Initialize start time for this attempt — convert Date to MySQL-compatible string
                const nowStr = now.toISOString().slice(0, 19).replace('T', ' ');
                await executeQuery(
                    `UPDATE user_progress SET last_attempt_start = ? WHERE id = ?`,
                    [nowStr, up.id]
                );
            } else {
                attemptStart = new Date(up.last_attempt_start);
            }
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
                const rights = parsed.pairs.map((p: any) => p.right).sort(() => Math.random() - 0.5);
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
            `SELECT question_id, selected_option FROM exam_answers
             WHERE user_id = ? AND session_id = ? AND attempt_number = ?`,
            [user.id, sessionId, attemptNumber]
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
