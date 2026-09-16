import { NextRequest, NextResponse } from 'next/server';
import type { RowDataPacket } from 'mysql2';
import { v4 as uuidv4 } from 'uuid';
import pool, { executeQuery } from '@/lib/db';
import { executeWithRetry } from '@/lib/db-retry';
import { withAuth, type AuthenticatedUser } from '@/lib/api-auth';
import {
    getSessionModuleItem,
    ParticipantError,
    validateSessionTiming,
    verifyEnrollment,
} from '@/lib/participant-helpers';
import {
    toParticipantQuestionShape,
    validateParticipantAnswer,
    type ExamQuestionType,
} from '@/lib/exam-answer-utils';

const MAX_DRAFT_ANSWERS = 1000;
const MAX_ANSWER_LENGTH = 20_000;

interface DraftAnswerInput {
    question_id: string;
    selected_option: string;
    client_version?: number;
}

interface QuestionRow {
    id: string;
    question_type: ExamQuestionType;
    options_json: unknown;
}

interface ProgressRow extends RowDataPacket {
    status: string;
    attempts_count: number;
    attempt_version: number;
    last_attempt_start: Date | null;
}

async function handlePut(
    request: NextRequest,
    user: AuthenticatedUser,
    context: { params: Promise<{ id: string; examId: string }> },
) {
    try {
        const { id: sessionId, examId } = await context.params;
        const body = await request.json() as { attempt_number?: unknown; attempt_version?: unknown; answers?: unknown };
        const attemptNumber = Number(body.attempt_number);
        const requestAttemptVersion = typeof body.attempt_version === 'number' ? body.attempt_version : null;
        const answers = body.answers as DraftAnswerInput[];

        if (!Number.isInteger(attemptNumber) || attemptNumber < 1) {
            return NextResponse.json({ success: false, error: 'Nomor attempt tidak valid' }, { status: 400 });
        }
        if (!Array.isArray(answers) || answers.length > MAX_DRAFT_ANSWERS) {
            return NextResponse.json({ success: false, error: 'Daftar draft jawaban tidak valid' }, { status: 400 });
        }
        const uniqueQuestionIds = new Set<string>();
        for (const answer of answers) {
            if (!answer || typeof answer.question_id !== 'string' || typeof answer.selected_option !== 'string') {
                return NextResponse.json({ success: false, error: 'Format draft jawaban tidak valid' }, { status: 400 });
            }
            if (answer.question_id.length > 100 || answer.selected_option.length > MAX_ANSWER_LENGTH) {
                return NextResponse.json({ success: false, error: 'Ukuran draft jawaban melebihi batas' }, { status: 400 });
            }
            if (uniqueQuestionIds.has(answer.question_id)) {
                return NextResponse.json({ success: false, error: 'Draft jawaban duplikat' }, { status: 400 });
            }
            uniqueQuestionIds.add(answer.question_id);
        }

        await verifyEnrollment(sessionId, user.id);
        const { session, isUpcoming, isEnded } = await validateSessionTiming(sessionId, user.id);
        if (isUpcoming || isEnded) {
            return NextResponse.json({ success: false, error: 'Sesi tidak aktif' }, { status: 400 });
        }

        const moduleItem = await getSessionModuleItem(session.module_id, 'exam', examId);
        if (answers.length > 0) {
            const examRows = await executeQuery<{ allow_remedial: boolean | number; remedial_exam_id: string | null }[]>(
                `SELECT allow_remedial, remedial_exam_id FROM exams WHERE id = ? LIMIT 1`,
                [examId],
            );
            const examRules = examRows?.[0];
            const remedialExamId = (examRules?.allow_remedial && examRules?.remedial_exam_id) ? examRules.remedial_exam_id : null;

            const questionIds = [...uniqueQuestionIds];
            const placeholders = questionIds.map(() => '?').join(', ');
            const questions = await executeQuery<QuestionRow[]>(
                `SELECT id, question_type, options_json
                 FROM questions
                 WHERE (exam_id = ? OR exam_id = ?) AND id IN (${placeholders})`,
                [examId, remedialExamId || examId, ...questionIds],
            );

            if (questions.length !== questionIds.length) {
                return NextResponse.json({ success: false, error: 'Draft mengandung soal yang tidak valid' }, { status: 400 });
            }

            const questionMap = new Map(questions.map((question) => [question.id, question]));
            for (const answer of answers) {
                const question = questionMap.get(answer.question_id)!;
                const validationError = validateParticipantAnswer(toParticipantQuestionShape(question), answer.selected_option);
                if (validationError) {
                    return NextResponse.json({ success: false, error: validationError }, { status: 400 });
                }
            }
        }

        // Sort answers deterministically by question_id ASC to prevent InnoDB gap lock deadlocks
        const sortedAnswers = [...answers].sort((a, b) => a.question_id.localeCompare(b.question_id));

        // Execute transactional bulk upsert with bounded retry on transient deadlocks
        await executeWithRetry(async () => {
            let connection;
            try {
                connection = await pool.getConnection();
                await connection.beginTransaction();

                // Serialize autosave with submit so a late draft cannot be written
                // after the same attempt has already been completed or overridden.
                const [progress] = await connection.execute<ProgressRow[]>(
                    `SELECT status, attempts_count, attempt_version, last_attempt_start
                     FROM user_progress
                     WHERE user_id = ? AND session_id = ? AND module_item_id = ?
                     LIMIT 1
                     FOR UPDATE`,
                    [user.id, sessionId, moduleItem.id],
                );

                const progressRow = progress[0];
                const expectedAttempt = Number(progressRow?.attempts_count || 0) + 1;
                const isVersionStale = requestAttemptVersion !== null && Number(progressRow?.attempt_version || 1) !== requestAttemptVersion;

                if (!progressRow || progressRow.status === 'completed' || !progressRow.last_attempt_start || attemptNumber !== expectedAttempt || isVersionStale) {
                    await connection.rollback();
                    throw new ParticipantError('Attempt ujian telah diperbarui atau tidak aktif. Silakan muat ulang.', 409);
                }

                if (sortedAnswers.length > 0) {
                    const values: (string | number)[] = [];
                    const placeholders: string[] = [];

                    for (const answer of sortedAnswers) {
                        const ver = typeof answer.client_version === 'number' && Number.isInteger(answer.client_version) && answer.client_version >= 1
                            ? answer.client_version
                            : 1;

                        placeholders.push('(?, ?, ?, ?, ?, ?, ?, ?)');
                        values.push(
                            uuidv4(),
                            user.id,
                            sessionId,
                            examId,
                            answer.question_id,
                            attemptNumber,
                            answer.selected_option,
                            ver
                        );
                    }

                    try {
                        await connection.execute(
                            `INSERT INTO exam_answer_drafts
                                (id, user_id, session_id, exam_id, question_id, attempt_number, selected_option, client_version)
                             VALUES ${placeholders.join(', ')} AS new_draft
                             ON DUPLICATE KEY UPDATE 
                                selected_option = IF(new_draft.client_version >= exam_answer_drafts.client_version, new_draft.selected_option, exam_answer_drafts.selected_option),
                                client_version = GREATEST(new_draft.client_version, exam_answer_drafts.client_version),
                                updated_at = CURRENT_TIMESTAMP`,
                            values,
                        );
                    } catch (sqlErr: any) {
                        // Fallback for older engines that do not yet support row aliases (pre-MySQL 8.0.19 / legacy MariaDB)
                        if (sqlErr?.code === 'ER_PARSE_ERROR' || sqlErr?.errno === 1064) {
                            await connection.execute(
                                `INSERT INTO exam_answer_drafts
                                    (id, user_id, session_id, exam_id, question_id, attempt_number, selected_option, client_version)
                                 VALUES ${placeholders.join(', ')}
                                 ON DUPLICATE KEY UPDATE 
                                    selected_option = IF(VALUES(client_version) >= client_version, VALUES(selected_option), selected_option),
                                    client_version = GREATEST(VALUES(client_version), client_version),
                                    updated_at = CURRENT_TIMESTAMP`,
                                values,
                            );
                        } else {
                            throw sqlErr;
                        }
                    }
                }

                await connection.commit();
            } catch (err) {
                if (connection) {
                    await connection.rollback().catch(() => undefined);
                }
                throw err;
            } finally {
                if (connection) {
                    connection.release();
                }
            }
        }, { maxRetries: 3, initialBackoffMs: 50, maxBackoffMs: 400 });

        return NextResponse.json({ success: true, saved: sortedAnswers.length });
    } catch (error) {
        if (error instanceof ParticipantError) {
            return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
        }
        const message = error instanceof Error ? error.message : 'Internal Server Error';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

export const PUT = withAuth(handlePut, { allowedRoles: ['trainee'] });

