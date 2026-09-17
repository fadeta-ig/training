import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import { withAuth, AuthenticatedUser } from '@/lib/api-auth';
import { v4 as uuidv4 } from 'uuid';
import pool from '@/lib/db';
import {
    getSessionModuleItem,
    verifyEnrollment,
    validateSessionTiming,
    validateSebAccess,
    ParticipantError,
} from '@/lib/participant-helpers';
import { checkRateLimit } from '@/lib/rate-limit';
import logger from '@/lib/logger';
import {
    createQuestionSnapshot,
    gradeQuestionAnswer,
    toParticipantQuestionShape,
    validateParticipantAnswer,
    type ExamQuestionType,
} from '@/lib/exam-answer-utils';

/** Max 5 submissions per minute per IP to prevent abuse */
const SUBMIT_RATE_LIMIT = { windowMs: 60_000, maxRequests: 5 };

/** Grace period: allow submission up to 5 minutes after session ends */
const LATE_GRACE_MS = 5 * 60 * 1000;
/** Network-only grace: the UI still auto-submits at the exact deadline. */
const EXAM_DURATION_GRACE_MS = 5 * 60 * 1000;
const PROCTOR_SNAPSHOT_MAX_AGE_SECONDS = 10 * 60;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface QuestionRow {
    id: string;
    exam_id: string;
    question_type: ExamQuestionType;
    question_text: string;
    question_image: string | null;
    options_json: unknown;
    correct_option_index: number | null;
    correct_answer: string | null;
    points: number;
}

/**
 * POST /api/participant/sessions/[id]/exam/[examId]/submit
 * Submit all exam answers and auto-grade where possible.
 */
async function handlePost(
    request: NextRequest,
    user: AuthenticatedUser,
    context: { params: Promise<{ id: string; examId: string }> }
) {
    const blocked = checkRateLimit(request, { ...SUBMIT_RATE_LIMIT, identifier: user.id });
    if (blocked) return blocked;

    let connection;
    try {
        const { id: sessionId, examId } = await context.params;
        const body = await request.json();
        const { answers, submission_id: submissionId, attempt_number: requestAttemptNumber, attempt_version: requestAttemptVersion } = body as {
            answers: { question_id: string; selected_option: string }[];
            submission_id?: string;
            attempt_number?: number;
            attempt_version?: number;
        };


        if (!answers || !Array.isArray(answers)) {
            return NextResponse.json({ success: false, error: 'Jawaban tidak valid' }, { status: 400 });
        }
        if (answers.length > 1000) {
            return NextResponse.json({ success: false, error: 'Jumlah jawaban melebihi batas' }, { status: 400 });
        }
        if (!submissionId || !UUID_RE.test(submissionId)) {
            return NextResponse.json({ success: false, error: 'ID pengiriman jawaban tidak valid' }, { status: 400 });
        }
        if (!Number.isInteger(requestAttemptNumber) || !Number.isInteger(requestAttemptVersion)) {
            return NextResponse.json({ success: false, error: 'Identitas attempt ujian tidak valid' }, { status: 400 });
        }

        await verifyEnrollment(sessionId, user.id);
        const { session, isUpcoming, isEnded, effectiveEndTime } = await validateSessionTiming(sessionId, user.id);

        // Enforce session timing — block if session hasn't started
        if (isUpcoming) {
            return NextResponse.json(
                { success: false, error: 'Sesi belum dimulai. Tidak dapat mengirim jawaban.' },
                { status: 400 }
            );
        }

        // Allow a grace period after session ends for late submission
        if (isEnded) {
            const endTime = (effectiveEndTime || new Date(session.end_time)).getTime();
            const now = Date.now();
            if (now - endTime > LATE_GRACE_MS) {
                return NextResponse.json(
                    { success: false, error: 'Sesi sudah berakhir. Waktu pengumpulan telah lewat.' },
                    { status: 400 }
                );
            }
        }

        // Enforce SEB if required
        await validateSebAccess(request, session, { userId: user.id, userRole: user.role });
        const sessionModuleItem = await getSessionModuleItem(session.module_id, 'exam', examId);

        interface ExamRuleRow {
            passing_grade: number | string;
            max_attempts: number;
            allow_remedial: boolean | number;
            duration_minutes: number;
            remedial_exam_id: string | null;
        }

        interface UserProgressLockRow {
            id: string;
            attempts_count: number;
            last_attempt_start: string | Date | null;
            status: 'locked' | 'open' | 'completed';
            score: number | string | null;
            individual_extension_until: string | Date | null;
            attempt_elapsed_seconds: number | null;
            extension_remaining_seconds: number | null;
            attempt_version: number;
            last_submission_id: string | null;
            last_submission_result: string | null;
        }

        // Fetch exam rules (passing grade, max attempts, remedial permission, remedial package)
        const exam = await executeQuery<ExamRuleRow[]>(
            `SELECT passing_grade, max_attempts, allow_remedial, duration_minutes, remedial_exam_id FROM exams WHERE id = ?`,
            [examId]
        );
        const passingGrade = Number(exam?.[0]?.passing_grade ?? 70);
        const maxAttempts = exam?.[0]?.max_attempts || 1;
        const allowRemedial = !!exam?.[0]?.allow_remedial;
        const remedialExamId = exam?.[0]?.remedial_exam_id || null;

        connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            // Get attempt number and apply Row-Level Lock to prevent race condition (Lost Update)
            const [progressRes] = await connection.execute<UserProgressLockRow[] & any[]>(
                `SELECT id,
                        attempts_count,
                        last_attempt_start,
                        status,
                        score,
                        individual_extension_until,
                        attempt_version,
                        last_submission_id,
                        last_submission_result,
                        TIMESTAMPDIFF(SECOND, last_attempt_start, UTC_TIMESTAMP()) AS attempt_elapsed_seconds,
                        IF(individual_extension_until IS NOT NULL, TIMESTAMPDIFF(SECOND, UTC_TIMESTAMP(), individual_extension_until), NULL) AS extension_remaining_seconds
                 FROM user_progress
                 WHERE user_id = ? AND session_id = ? AND module_item_id = ?
                  FOR UPDATE`,
                [user.id, sessionId, sessionModuleItem.id]
            );
            let attemptNumber = 1;
            let progressId: string | null = null;

            if (!progressRes || progressRes.length === 0) {
                await connection.rollback();
                return NextResponse.json(
                    { success: false, error: 'Attempt ujian belum dimulai dari halaman ujian.' },
                    { status: 403 }
                );
            }

            const progressRow = progressRes[0];
            attemptNumber = (progressRow.attempts_count || 0) + 1;
            progressId = progressRow.id;

            if (progressRow.last_submission_id === submissionId && progressRow.last_submission_result) {
                let savedResult: unknown = null;
                try {
                    savedResult = JSON.parse(progressRow.last_submission_result);
                } catch {}
                if (savedResult) {
                    await connection.rollback();
                    return NextResponse.json({ success: true, data: savedResult, idempotent: true });
                }
            }

            if (!progressRow.last_attempt_start) {
                await connection.rollback();
                return NextResponse.json(
                    { success: false, error: 'Attempt ujian belum dimulai dari halaman ujian.' },
                    { status: 403 }
                );
            }

            if (Number(requestAttemptNumber) !== attemptNumber || Number(requestAttemptVersion) !== Number(progressRow.attempt_version || 1)) {
                await connection.rollback();
                return NextResponse.json(
                    { success: false, error: 'Attempt ujian sudah berubah. Muat ulang halaman sebelum mengirim jawaban.' },
                    { status: 409 }
                );
            }

            const previousScore = Number(progressRow.score ?? 0);
            const canRetake = progressRow.status === 'completed'
                && allowRemedial
                && previousScore < Number(passingGrade)
                && Number(progressRow.attempts_count || 0) < Number(maxAttempts);

            if (progressRow.status === 'completed' && !canRetake) {
                await connection.rollback();
                return NextResponse.json(
                    { success: false, error: 'Ujian sudah diselesaikan.' },
                    { status: 403 }
                );
            }

            if (attemptNumber > maxAttempts) {
                await connection.rollback();
                return NextResponse.json(
                    {
                        success: false,
                        error: `Batas pengulangan ujian (${maxAttempts}x) telah tercapai.`
                    },
                    { status: 403 }
                );
            }

            if (session.enable_proctoring) {
                const [snapshotRows] = await connection.execute<Array<{ age_seconds: number }> & any[]>(
                    `SELECT TIMESTAMPDIFF(SECOND, captured_at, CURRENT_TIMESTAMP()) AS age_seconds
                     FROM proctor_snapshots
                     WHERE user_id = ? AND session_id = ?
                     ORDER BY captured_at DESC
                     LIMIT 1`,
                    [user.id, sessionId]
                );
                const snapshotAge = snapshotRows?.[0]?.age_seconds;
                if (snapshotAge === undefined || snapshotAge === null || Number(snapshotAge) > PROCTOR_SNAPSHOT_MAX_AGE_SECONDS) {
                    await connection.rollback();
                    return NextResponse.json(
                        { success: false, error: 'Snapshot proctoring belum tersimpan atau sudah kedaluwarsa. Aktifkan kamera dan coba kirim kembali.' },
                        { status: 428 }
                    );
                }
            }

            const durationMs = Number(exam?.[0]?.duration_minutes || 0) * 60 * 1000;
            const elapsedMs = Math.max(0, Number(progressRow.attempt_elapsed_seconds || 0)) * 1000;
            const isWithinStandardDuration = durationMs > 0 ? (elapsedMs <= durationMs + EXAM_DURATION_GRACE_MS) : true;
            const isWithinIndividualExtension = progressRow.extension_remaining_seconds !== null && progressRow.extension_remaining_seconds !== undefined
                ? (Number(progressRow.extension_remaining_seconds) >= -(EXAM_DURATION_GRACE_MS / 1000))
                : false;

            if (!isWithinStandardDuration && !isWithinIndividualExtension) {
                await connection.rollback();
                return NextResponse.json(
                    { success: false, error: 'Durasi ujian telah habis.' },
                    { status: 400 }
                );
            }

            // Determine active exam package (remedial vs standard)
            const isRemedialAttempt = attemptNumber > 1 && allowRemedial && !!remedialExamId;
            const activeExamId = isRemedialAttempt ? remedialExamId : examId;

            // Fetch questions from the active exam package
            const [questionsRes] = await connection.execute<QuestionRow[] & any[]>(
                `SELECT id, exam_id, question_type, question_text, question_image,
                        options_json, correct_option_index, correct_answer, points
                 FROM questions WHERE exam_id = ? ORDER BY sequence_order ASC, id ASC`,
                [activeExamId]
            );
            const questions = (questionsRes || []) as QuestionRow[];

            const questionMap = new Map(questions.map((question) => [question.id, question]));
            const submittedQuestionIds = new Set<string>();

            if (answers.length > questions.length) {
                await connection.rollback();
                return NextResponse.json({ success: false, error: 'Jumlah jawaban tidak valid' }, { status: 400 });
            }

            for (const answer of answers) {
                if (!answer || typeof answer.question_id !== 'string' || typeof answer.selected_option !== 'string') {
                    await connection.rollback();
                    return NextResponse.json({ success: false, error: 'Format jawaban tidak valid' }, { status: 400 });
                }
                if (answer.question_id.length > 100 || answer.selected_option.length > 20_000) {
                    await connection.rollback();
                    return NextResponse.json({ success: false, error: 'Ukuran jawaban melebihi batas' }, { status: 400 });
                }
                if (!questionMap.has(answer.question_id)) {
                    await connection.rollback();
                    return NextResponse.json({ success: false, error: 'Jawaban mengandung soal yang tidak valid untuk paket ujian ini' }, { status: 400 });
                }
                if (submittedQuestionIds.has(answer.question_id)) {
                    await connection.rollback();
                    return NextResponse.json({ success: false, error: 'Jawaban duplikat terdeteksi' }, { status: 400 });
                }
                const validationError = validateParticipantAnswer(
                    toParticipantQuestionShape(questionMap.get(answer.question_id)!),
                    answer.selected_option,
                );
                if (validationError) {
                    await connection.rollback();
                    return NextResponse.json({ success: false, error: validationError }, { status: 400 });
                }
                submittedQuestionIds.add(answer.question_id);
            }

            // Delete existing answers only for the current attempt (allows resume-then-submit flow safely)
            await connection.execute(
                `DELETE FROM exam_answers
                 WHERE user_id = ?
                   AND session_id = ?
                   AND attempt_number = ?
                   AND (exam_id = ? OR exam_id = ?)`,
                [user.id, sessionId, attemptNumber, examId, activeExamId]
            );

            const totalPoints = questions.reduce((sum, question) => sum + (Number(question.points) || 1), 0);
            let earnedPoints = 0;

            const answerValues: any[] = [];
            const placeholders: string[] = [];
            const submittedAnswers = new Map(answers.map((answer) => [answer.question_id, answer.selected_option]));

            for (const question of questions) {
                const selectedOption = submittedAnswers.get(question.id) ?? '';
                const isCorrect = gradeQuestionAnswer(question, selectedOption);
                const isPendingEssay = question.question_type === 'essay' && selectedOption.trim().length > 0;
                const awardedPoints = isCorrect ? Number(question.points) || 1 : 0;
                const gradingStatus = isPendingEssay ? 'pending' : 'auto';

                earnedPoints += awardedPoints;

                answerValues.push(
                    uuidv4(),
                    user.id,
                    sessionId,
                    question.id,
                    activeExamId,
                    selectedOption,
                    createQuestionSnapshot(question),
                    isCorrect,
                    gradingStatus,
                    awardedPoints,
                    attemptNumber
                );
                placeholders.push('(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
            }

            if (answerValues.length > 0) {
                await connection.execute(
                    `INSERT INTO exam_answers
                        (id, user_id, session_id, question_id, exam_id, selected_option,
                         question_snapshot, is_correct, grading_status, awarded_points, attempt_number)
                     VALUES ${placeholders.join(', ')}`,
                    answerValues
                );
            }

            await connection.execute(
                `DELETE FROM exam_answer_drafts
                 WHERE user_id = ? AND session_id = ? AND (exam_id = ? OR exam_id = ?) AND attempt_number = ?`,
                [user.id, sessionId, examId, activeExamId, attemptNumber]
            );

            const score = totalPoints > 0 ? (earnedPoints / totalPoints) * 100 : 0;
            const passed = score >= passingGrade;
            const isScoreVisible = !!session.show_score;
            const responseData = isScoreVisible
                ? {
                      score: Math.round(score * 100) / 100,
                      passed,
                      earnedPoints,
                      totalPoints,
                      passingGrade,
                      show_score: true,
                  }
                : {
                      passed,
                      show_score: false,
                  };

            await connection.execute(
                `UPDATE user_progress
                 SET status = 'completed', score = ?, original_score = ?, score_adjustment = 0.00,
                     attempts_count = attempts_count + 1, last_attempt_start = NULL,
                     last_submission_id = ?, last_submission_result = ?
                 WHERE id = ?`,
                [score, score, submissionId, JSON.stringify(responseData), progressId]
            );

            await connection.commit();

            // Audit trail: log exam submission
            await logger.audit(user.id, 'SUBMIT_EXAM', 'exams', examId, {
                sessionId,
                attemptNumber,
                score: Math.round(score * 100) / 100,
                passed,
                earnedPoints,
                totalPoints,
            }, 'EXAM_SUBMIT');

            return NextResponse.json({
                success: true,
                data: responseData,
            });
        } catch (txError) {
            await connection.rollback();
            throw txError;
        } finally {
            connection.release();
        }
    } catch (error) {
        if (error instanceof ParticipantError) {
            logger.warn('EXAM_SUBMIT', `Participant error: ${error.message}`, undefined, user.id);
            return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
        }
        logger.error('EXAM_SUBMIT', 'Gagal memproses pengiriman jawaban ujian', error, user.id);
        return NextResponse.json({ success: false, error: 'Terjadi kesalahan sistem saat mengirim jawaban ujian. Silakan coba lagi.' }, { status: 500 });
    }
}

export const POST = withAuth(handlePost, { allowedRoles: ['trainee'] });

