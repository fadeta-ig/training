import { NextRequest, NextResponse } from 'next/server';
import type { RowDataPacket } from 'mysql2';
import { v4 as uuidv4 } from 'uuid';
import pool, { executeQuery } from '@/lib/db';
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
}

interface QuestionRow {
    id: string;
    question_type: ExamQuestionType;
    options_json: unknown;
}

interface ProgressRow extends RowDataPacket {
    status: string;
    attempts_count: number;
    last_attempt_start: Date | null;
}

async function handlePut(
    request: NextRequest,
    user: AuthenticatedUser,
    context: { params: Promise<{ id: string; examId: string }> },
) {
    let connection;

    try {
        const { id: sessionId, examId } = await context.params;
        const body = await request.json() as { attempt_number?: unknown; answers?: unknown };
        const attemptNumber = Number(body.attempt_number);
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
        const { session, isUpcoming, isEnded } = await validateSessionTiming(sessionId);
        if (isUpcoming || isEnded) {
            return NextResponse.json({ success: false, error: 'Sesi tidak aktif' }, { status: 400 });
        }

        const moduleItem = await getSessionModuleItem(session.module_id, 'exam', examId);
        if (answers.length > 0) {
            const questionIds = [...uniqueQuestionIds];
            const placeholders = questionIds.map(() => '?').join(', ');
            const questions = await executeQuery<QuestionRow[]>(
                `SELECT id, question_type, options_json
                 FROM questions
                 WHERE exam_id = ? AND id IN (${placeholders})`,
                [examId, ...questionIds],
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

        connection = await pool.getConnection();
        await connection.beginTransaction();

        // Serialize autosave with submit so a late draft cannot be written
        // after the same attempt has already been completed.
        const [progress] = await connection.execute<ProgressRow[]>(
            `SELECT status, attempts_count, last_attempt_start
             FROM user_progress
             WHERE user_id = ? AND session_id = ? AND module_item_id = ?
             LIMIT 1
             FOR UPDATE`,
            [user.id, sessionId, moduleItem.id],
        );

        const progressRow = progress[0];
        const expectedAttempt = Number(progressRow?.attempts_count || 0) + 1;
        if (!progressRow || progressRow.status === 'completed' || !progressRow.last_attempt_start || attemptNumber !== expectedAttempt) {
            await connection.rollback();
            connection.release();
            connection = undefined;
            return NextResponse.json({ success: false, error: 'Attempt ujian tidak aktif' }, { status: 409 });
        }

        for (const answer of answers) {
            await connection.execute(
                `INSERT INTO exam_answer_drafts
                    (id, user_id, session_id, exam_id, question_id, attempt_number, selected_option)
                 VALUES (?, ?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE selected_option = VALUES(selected_option), updated_at = CURRENT_TIMESTAMP`,
                [uuidv4(), user.id, sessionId, examId, answer.question_id, attemptNumber, answer.selected_option],
            );
        }

        await connection.commit();
        connection.release();
        connection = undefined;

        return NextResponse.json({ success: true, saved: answers.length });
    } catch (error) {
        if (connection) {
            await connection.rollback();
            connection.release();
        }
        if (error instanceof ParticipantError) {
            return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
        }
        const message = error instanceof Error ? error.message : 'Internal Server Error';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

export const PUT = withAuth(handlePut, { allowedRoles: ['trainee'] });
