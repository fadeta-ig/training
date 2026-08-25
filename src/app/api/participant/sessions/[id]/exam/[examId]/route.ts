import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import { withAuth, AuthenticatedUser } from '@/lib/api-auth';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { JWT_SECRET } from '@/lib/auth';
import {
    normalizeOptions,
    parseOptionsJson,
    type ExamQuestionType,
} from '@/lib/exam-answer-utils';
import {
    assertCurrentItemAccessible,
    getItemProgress,
    getSessionModuleItem,
    verifyEnrollment,
    validateSessionTiming,
    validateSebAccess,
    ParticipantError,
} from '@/lib/participant-helpers';

function shuffleValues<T>(values: T[], seed: string): T[] {
    const result = [...values];
    for (let i = result.length - 1; i > 0; i--) {
        const digest = crypto
            .createHmac('sha256', JWT_SECRET as string)
            .update(`${seed}:${i}`)
            .digest();
        const j = digest.readUInt32BE(0) % (i + 1);
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

        // Phase 1: Parallel enrollment + session timing validation
        const [, { session, isUpcoming, isEnded }] = await Promise.all([
            verifyEnrollment(sessionId, user.id),
            validateSessionTiming(sessionId, user.id),
        ]);

        if (isUpcoming) {
            return NextResponse.json({ success: false, error: 'Sesi belum dimulai' }, { status: 400 });
        }
        if (isEnded) {
            return NextResponse.json({ success: false, error: 'Sesi sudah berakhir' }, { status: 400 });
        }

        validateSebAccess(_request, session);
        const moduleItem = await getSessionModuleItem(session.module_id, 'exam', examId);

        // Phase 2: Parallel exam rules + current progress
        const [exam, currentProgress] = await Promise.all([
            executeQuery<any[]>(
                `SELECT e.id, e.title, e.duration_minutes, e.passing_grade, e.max_attempts, e.allow_remedial, e.remedial_exam_id,
                        re.title AS remedial_exam_title, re.duration_minutes AS remedial_duration_minutes
                 FROM exams e
                 LEFT JOIN exams re ON e.remedial_exam_id = re.id
                 WHERE e.id = ?`,
                [examId]
            ),
            getItemProgress(sessionId, user.id, moduleItem.id),
        ]);

        if (!exam || exam.length === 0) {
            return NextResponse.json({ success: false, error: 'Ujian tidak ditemukan' }, { status: 404 });
        }

        const rules = exam[0];
        const canRetake = currentProgress?.status === 'completed'
            && !!rules.allow_remedial
            && Number(currentProgress.score ?? 0) < Number(rules.passing_grade)
            && Number(currentProgress.attempts_count || 0) < Number(rules.max_attempts || 1);

        if (currentProgress?.status === 'completed' && !canRetake) {
            return NextResponse.json({ success: false, error: 'Ujian sudah diselesaikan' }, { status: 403 });
        }

        await assertCurrentItemAccessible(sessionId, user.id, session, moduleItem, canRetake);

        await executeQuery(
            `INSERT INTO user_progress (id, user_id, session_id, module_item_id, status, last_attempt_start)
             VALUES (?, ?, ?, ?, 'open', UTC_TIMESTAMP())
             ON DUPLICATE KEY UPDATE id = id`,
            [uuidv4(), user.id, sessionId, moduleItem.id]
        );

        // Initialize an attempt once. Mark remedial progress as open so draft
        // persistence and submission share the same active-attempt state.
        await executeQuery(
            `UPDATE user_progress
             SET status = 'open', last_attempt_start = UTC_TIMESTAMP()
             WHERE user_id = ?
               AND session_id = ?
               AND module_item_id = ?
               AND last_attempt_start IS NULL`,
            [user.id, sessionId, moduleItem.id]
        );

        // Determine if current attempt is remedial and requires a distinct exam package
        const currentAttemptsCount = Number(currentProgress?.attempts_count || 0);
        const isRemedialAttempt = currentAttemptsCount >= 1 && !!rules.allow_remedial && !!rules.remedial_exam_id;
        const activeExamId = isRemedialAttempt ? rules.remedial_exam_id : examId;

        // Phase 3: Parallel fetch progress + questions from the active exam package
        const [progress, questions] = await Promise.all([
            executeQuery<Array<{
                attempts_count: number;
                attempt_version: number;
                attempt_start_utc: string;
                server_time_utc: string;
            }>>(
                `SELECT up.attempts_count,
                        up.attempt_version,
                        DATE_FORMAT(up.last_attempt_start, '%Y-%m-%dT%H:%i:%sZ') AS attempt_start_utc,
                        DATE_FORMAT(UTC_TIMESTAMP(), '%Y-%m-%dT%H:%i:%sZ') AS server_time_utc
                 FROM user_progress up
                 WHERE up.user_id = ? AND up.session_id = ? AND up.module_item_id = ?
                 LIMIT 1`,
                [user.id, sessionId, moduleItem.id]
            ),
            executeQuery<Array<{
                id: string;
                question_type: ExamQuestionType;
                question_text: string;
                question_image: string | null;
                options_json: unknown;
                points: number;
            }>>(
                `SELECT id, question_type, question_text, question_image, options_json, points
                 FROM questions WHERE exam_id = ? ORDER BY sequence_order ASC, id ASC`,
                [activeExamId]
            ),
        ]);

        if (!progress[0]?.attempt_start_utc || !progress[0]?.server_time_utc) {
            throw new Error('Waktu mulai attempt ujian gagal diinisialisasi');
        }

        const attemptNumber = Number(progress[0].attempts_count || 0) + 1;

        // Return only participant-safe fields. Answer keys must never leave the server.
        const sanitized = questions.map((question) => {
            const parsed = parseOptionsJson(question.options_json);

            if (question.question_type === 'multiple_choice' || question.question_type === 'true_false') {
                return { ...question, options_json: normalizeOptions(parsed) };
            }

            if (question.question_type === 'multiple_select') {
                const options = parsed && typeof parsed === 'object'
                    ? normalizeOptions((parsed as { options?: unknown }).options)
                    : [];
                return { ...question, options_json: { options } };
            }

            if (question.question_type === 'matching') {
                const rawPairs = parsed && typeof parsed === 'object' && Array.isArray((parsed as { pairs?: unknown }).pairs)
                    ? (parsed as { pairs: unknown[] }).pairs
                    : [];
                const pairs = rawPairs.filter((pair): pair is { left: string; right: string } => {
                    if (!pair || typeof pair !== 'object') return false;
                    const candidate = pair as { left?: unknown; right?: unknown };
                    return typeof candidate.left === 'string' && typeof candidate.right === 'string';
                });
                const rights = shuffleValues(
                    pairs.map((pair) => pair.right),
                    `${user.id}:${sessionId}:${attemptNumber}:${question.id}`,
                );
                return {
                    ...question,
                    options_json: {
                        lefts: pairs.map((pair) => pair.left),
                        rights,
                    },
                };
            }

            return { ...question, options_json: null };
        });

        const existingAnswers = await executeQuery<Array<{ question_id: string; selected_option: string }>>(
            `SELECT question_id, selected_option
             FROM exam_answer_drafts
             WHERE user_id = ?
               AND session_id = ?
               AND exam_id = ?
               AND attempt_number = ?`,
            [user.id, sessionId, examId, attemptNumber]
        );

        const effectiveDuration = isRemedialAttempt && rules.remedial_duration_minutes
            ? rules.remedial_duration_minutes
            : rules.duration_minutes;

        const effectiveTitle = isRemedialAttempt && rules.remedial_exam_title
            ? `${rules.title} (Remedial: ${rules.remedial_exam_title})`
            : rules.title;

        return NextResponse.json({
            success: true,
            data: {
                exam: {
                    ...rules,
                    duration_minutes: effectiveDuration,
                    title: effectiveTitle,
                    is_remedial_attempt: isRemedialAttempt,
                    remedial_exam_title: rules.remedial_exam_title || null,
                },
                questions: sanitized,
                existingAnswers,
                serverTime: progress[0].server_time_utc,
                sessionEnd: session.end_time,
                enableProctoring: !!session.enable_proctoring,
                attemptStart: progress[0].attempt_start_utc,
                attemptNumber: attemptNumber,
                attemptVersion: progress[0].attempt_version || 1,
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
