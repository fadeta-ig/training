import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import { withAuth, type AuthenticatedUser } from '@/lib/api-auth';
import { parseOptionsJson, type ExamQuestionType } from '@/lib/exam-answer-utils';
import logger from '@/lib/logger';

interface ReviewRow {
    id: string;
    exam_id: string;
    exam_title: string;
    question_id: string;
    selected_option: string;
    question_snapshot: string | null;
    is_correct: number | boolean;
    grading_status: 'auto' | 'pending' | 'graded';
    awarded_points: number;
    attempt_number: number;
    answered_at: string;
    graded_at: string | null;
    grader_name: string | null;
    current_question_type: ExamQuestionType | null;
    current_question_text: string | null;
    current_question_image: string | null;
    current_options_json: unknown;
    current_correct_option_index: number | null;
    current_correct_answer: string | null;
    current_points: number | null;
}

interface QuestionSnapshot {
    id?: string;
    exam_id?: string;
    question_type?: ExamQuestionType;
    question_text?: string;
    question_image?: string | null;
    options_json?: unknown;
    correct_option_index?: number | null;
    correct_answer?: string | null;
    points?: number;
}

function parseSnapshot(value: string | null): QuestionSnapshot | null {
    if (!value) return null;
    try {
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === 'object' ? parsed as QuestionSnapshot : null;
    } catch {
        return null;
    }
}

async function handleGet(
    _request: NextRequest,
    user: AuthenticatedUser,
    context: { params: Promise<{ id: string; participantId: string }> },
) {
    try {
        const { id: sessionId, participantId } = await context.params;
        const enrollment = await executeQuery<Array<{
            session_id: string;
            session_title: string;
            participant_id: string;
            username: string;
            full_name: string;
        }>>(
            `SELECT s.id AS session_id, s.title AS session_title,
                    u.id AS participant_id, u.username, u.full_name
             FROM sessions s
             INNER JOIN session_participants sp ON sp.session_id = s.id
             INNER JOIN users u ON u.id = sp.user_id AND u.role = 'trainee'
             WHERE s.id = ? AND u.id = ?
             LIMIT 1`,
            [sessionId, participantId],
        );

        if (!enrollment[0]) {
            return NextResponse.json(
                { success: false, error: 'Peserta tidak terdaftar pada sesi ini' },
                { status: 404 },
            );
        }

        const rows = await executeQuery<ReviewRow[]>(
            `SELECT ea.id, ea.exam_id, COALESCE(e.title, 'Ujian') AS exam_title,
                    ea.question_id, ea.selected_option, ea.question_snapshot,
                    ea.is_correct, ea.grading_status, ea.awarded_points,
                    ea.attempt_number, ea.answered_at, ea.graded_at,
                    grader.full_name AS grader_name,
                    q.question_type AS current_question_type,
                    q.question_text AS current_question_text,
                    q.question_image AS current_question_image,
                    q.options_json AS current_options_json,
                    q.correct_option_index AS current_correct_option_index,
                    q.correct_answer AS current_correct_answer,
                    q.points AS current_points
             FROM exam_answers ea
             LEFT JOIN exams e ON e.id = ea.exam_id
             LEFT JOIN questions q ON q.id = ea.question_id
             LEFT JOIN users grader ON grader.id = ea.graded_by
             WHERE ea.session_id = ? AND ea.user_id = ?
             ORDER BY e.title ASC, ea.exam_id ASC, ea.attempt_number DESC, ea.answered_at ASC, ea.id ASC`,
            [sessionId, participantId],
        );

        const examMap = new Map<string, {
            exam_id: string;
            title: string;
            attempts: Array<{
                attempt_number: number;
                submitted_at: string;
                score: number;
                total_points: number;
                earned_points: number;
                correct_count: number;
                incorrect_count: number;
                unanswered_count: number;
                pending_count: number;
                answers: Array<Record<string, unknown>>;
            }>;
        }>();

        for (const row of rows) {
            const snapshot = parseSnapshot(row.question_snapshot);
            const questionType = snapshot?.question_type || row.current_question_type || 'multiple_choice';
            const points = Number(snapshot?.points ?? row.current_points ?? 1) || 1;
            const selectedOption = row.selected_option || '';
            const unanswered = selectedOption.trim().length === 0;
            const pending = row.grading_status === 'pending';

            let exam = examMap.get(row.exam_id);
            if (!exam) {
                exam = { exam_id: row.exam_id, title: row.exam_title, attempts: [] };
                examMap.set(row.exam_id, exam);
            }

            let attempt = exam.attempts.find((item) => item.attempt_number === Number(row.attempt_number));
            if (!attempt) {
                attempt = {
                    attempt_number: Number(row.attempt_number),
                    submitted_at: row.answered_at,
                    score: 0,
                    total_points: 0,
                    earned_points: 0,
                    correct_count: 0,
                    incorrect_count: 0,
                    unanswered_count: 0,
                    pending_count: 0,
                    answers: [],
                };
                exam.attempts.push(attempt);
            }

            attempt.total_points += points;
            attempt.earned_points += Number(row.awarded_points) || 0;
            if (unanswered) attempt.unanswered_count += 1;
            else if (pending) attempt.pending_count += 1;
            else if (!!row.is_correct) attempt.correct_count += 1;
            else attempt.incorrect_count += 1;

            attempt.answers.push({
                id: row.id,
                question_id: row.question_id,
                question_type: questionType,
                question_text: snapshot?.question_text || row.current_question_text || 'Soal tidak tersedia',
                question_image: snapshot?.question_image ?? row.current_question_image,
                options_json: parseOptionsJson(snapshot?.options_json ?? row.current_options_json),
                correct_option_index: snapshot?.correct_option_index ?? row.current_correct_option_index,
                correct_answer: snapshot?.correct_answer ?? row.current_correct_answer,
                points,
                selected_option: selectedOption,
                is_correct: !!row.is_correct,
                grading_status: row.grading_status,
                awarded_points: Number(row.awarded_points) || 0,
                answered_at: row.answered_at,
                graded_at: row.graded_at,
                grader_name: row.grader_name,
            });
        }

        for (const exam of examMap.values()) {
            for (const attempt of exam.attempts) {
                attempt.score = attempt.total_points > 0
                    ? Math.round((attempt.earned_points / attempt.total_points) * 10_000) / 100
                    : 0;
            }
        }

        const record = enrollment[0];
        return NextResponse.json({
            success: true,
            data: {
                session: { id: record.session_id, title: record.session_title },
                participant: {
                    id: record.participant_id,
                    username: record.username,
                    full_name: record.full_name,
                },
                exams: [...examMap.values()],
            },
        });
    } catch (error) {
        logger.error('ADMIN_ANSWER_REVIEW', 'Gagal memuat detail jawaban peserta', error, user.id);
        return NextResponse.json(
            { success: false, error: 'Gagal memuat detail jawaban peserta' },
            { status: 500 },
        );
    }
}

export const GET = withAuth(handleGet, { allowedRoles: ['admin'] });
