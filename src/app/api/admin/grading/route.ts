import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { RowDataPacket } from 'mysql2';
import pool from '@/lib/db';
import { withAuth, type AuthenticatedUser } from '@/lib/api-auth';
import logger from '@/lib/logger';
import { getSessionExamMappings, getSessionResultContext } from '@/lib/exam-results';
import { assertTrainerSessionAccess } from '@/lib/data-scoping';

const gradeSchema = z.object({
    session_id: z.string().uuid(),
    user_id: z.string().uuid(),
    exam_id: z.string().uuid(),
    question_id: z.string().uuid(),
    attempt_number: z.number().int().positive(),
    is_correct: z.boolean().optional(),
    awarded_points: z.number().min(0).max(1000).optional(),
}).refine(data => data.is_correct !== undefined || data.awarded_points !== undefined, {
    message: 'Harus menyertakan is_correct atau awarded_points',
});

interface Snapshot {
    question_type?: string;
    points?: number;
}

interface GradingAnswerRow extends RowDataPacket {
    id: string;
    selected_option: string;
    question_snapshot: string | null;
    current_question_type: string | null;
    current_points: number | null;
    module_item_id: string;
    attempts_count: number | null;
    score_adjustment: number | null;
    passing_grade: number | null;
    show_score: number | boolean;
}

interface ScoreRow extends RowDataPacket {
    awarded_points: number;
    question_snapshot: string | null;
    current_points: number | null;
}

function parseSnapshot(value: string | null): Snapshot | null {
    if (!value) return null;
    try {
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === 'object' ? parsed as Snapshot : null;
    } catch {
        return null;
    }
}

async function handlePost(request: NextRequest, authUser: AuthenticatedUser) {
    if (authUser.role !== 'admin' && authUser.role !== 'trainer') {
        return NextResponse.json(
            { success: false, error: 'Penilaian manual soal esai hanya dapat dilakukan oleh Pengajar atau Administrator.' },
            { status: 403 },
        );
    }

    let connection;

    try {
        const parsed = gradeSchema.safeParse(await request.json());
        if (!parsed.success) {
            return NextResponse.json(
                { success: false, error: 'Validasi form gagal', details: parsed.error.flatten().fieldErrors },
                { status: 400 },
            );
        }

        const { session_id, user_id, exam_id, question_id, attempt_number, is_correct, awarded_points } = parsed.data;

        // Validasi scoping jika trainer
        if (authUser.role === 'trainer') {
            const hasAccess = await assertTrainerSessionAccess(authUser, session_id);
            if (!hasAccess) {
                return NextResponse.json(
                    { success: false, error: 'Anda tidak memiliki hak akses penilaian untuk sesi dalam kategori ini' },
                    { status: 403 },
                );
            }
        }

        connection = await pool.getConnection();
        await connection.beginTransaction();

        // Serialize grading with publish/reopen so an official snapshot cannot
        // be created while the underlying attempt is being recalculated.
        const resultContext = await getSessionResultContext(connection, session_id, true);
        if (!resultContext) {
            await connection.rollback();
            connection.release();
            connection = undefined;
            return NextResponse.json({ success: false, error: 'Konteks hasil sesi tidak ditemukan' }, { status: 404 });
        }
        if (resultContext.result_state === 'published') {
            await connection.rollback();
            connection.release();
            connection = undefined;
            return NextResponse.json(
                { success: false, error: 'Hasil sudah dipublikasikan. Buka revisi hasil sesi sebelum mengubah penilaian esai.' },
                { status: 409 },
            );
        }

        const [answerRows] = await connection.execute<GradingAnswerRow[]>(
            `SELECT ea.id, ea.selected_option, ea.question_snapshot,
                    q.question_type AS current_question_type, q.points AS current_points,
                    mi.id AS module_item_id, up.attempts_count, up.score_adjustment,
                    module_exam.passing_grade, s.show_score
             FROM exam_answers ea
             INNER JOIN sessions s ON s.id = ea.session_id
             INNER JOIN session_participants sp
                ON sp.session_id = ea.session_id AND sp.user_id = ea.user_id
             INNER JOIN module_items mi
                ON mi.module_id = s.module_id AND mi.item_type = 'exam'
             INNER JOIN exams module_exam
                ON module_exam.id = mi.item_id
               AND (module_exam.id = ea.exam_id OR module_exam.remedial_exam_id = ea.exam_id)
             LEFT JOIN questions q ON q.id = ea.question_id
             LEFT JOIN user_progress up
                ON up.user_id = ea.user_id AND up.session_id = ea.session_id AND up.module_item_id = mi.id
             WHERE ea.session_id = ? AND ea.user_id = ? AND ea.exam_id = ?
               AND ea.question_id = ? AND ea.attempt_number = ?
             LIMIT 1
             FOR UPDATE`,
            [session_id, user_id, exam_id, question_id, attempt_number],
        );

        const answer = answerRows[0];
        if (!answer) {
            await connection.rollback();
            connection.release();
            connection = undefined;
            return NextResponse.json({ success: false, error: 'Jawaban peserta tidak ditemukan' }, { status: 404 });
        }

        const snapshot = parseSnapshot(answer.question_snapshot);
        const questionType = snapshot?.question_type || answer.current_question_type;
        const maxPoints = Number(snapshot?.points ?? answer.current_points ?? 1) || 1;
        if (questionType !== 'essay') {
            await connection.rollback();
            connection.release();
            connection = undefined;
            return NextResponse.json({ success: false, error: 'Hanya jawaban esai yang dapat dinilai manual' }, { status: 400 });
        }
        if (!answer.selected_option.trim()) {
            await connection.rollback();
            connection.release();
            connection = undefined;
            return NextResponse.json({ success: false, error: 'Jawaban kosong tidak dapat diberi nilai' }, { status: 400 });
        }

        const finalAwardedPoints = awarded_points !== undefined
            ? Math.min(Math.max(0, Number(awarded_points)), maxPoints)
            : (is_correct ? maxPoints : 0);
        const finalIsCorrect = finalAwardedPoints > 0;

        await connection.execute(
            `UPDATE exam_answers
             SET is_correct = ?, grading_status = 'graded', awarded_points = ?,
                 graded_by = ?, graded_at = UTC_TIMESTAMP()
             WHERE id = ?`,
            [finalIsCorrect ? 1 : 0, finalAwardedPoints, authUser.id, answer.id],
        );

        const [scoreRows] = await connection.execute<ScoreRow[]>(
            `SELECT ea.awarded_points, ea.question_snapshot, q.points AS current_points
             FROM exam_answers ea
             LEFT JOIN questions q ON q.id = ea.question_id
             WHERE ea.session_id = ? AND ea.user_id = ? AND ea.exam_id = ? AND ea.attempt_number = ?`,
            [session_id, user_id, exam_id, attempt_number],
        );

        let earnedPoints = 0;
        let totalPoints = 0;
        for (const row of scoreRows) {
            earnedPoints += Number(row.awarded_points) || 0;
            totalPoints += Number(parseSnapshot(row.question_snapshot)?.points ?? row.current_points ?? 1) || 1;
        }
        const newScore = totalPoints > 0
            ? Math.round((earnedPoints / totalPoints) * 10_000) / 100
            : 0;

        const [pendingRows] = await connection.execute<Array<{ total: number | string }> & any[]>(
            `SELECT COUNT(*) AS total
             FROM exam_answers
             WHERE session_id = ? AND user_id = ? AND exam_id = ? AND attempt_number = ?
               AND grading_status = 'pending'`,
            [session_id, user_id, exam_id, attempt_number],
        );
        const pendingCount = Number(pendingRows[0]?.total || 0);

        const isLatestAttempt = Number(answer.attempts_count) === attempt_number;
        if (isLatestAttempt) {
            const finalScore = Math.round(
                Math.min(100, Math.max(0, newScore + Number(answer.score_adjustment || 0))) * 100,
            ) / 100;
            const passed = finalScore >= Number(answer.passing_grade || 0);
            const submissionResult = pendingCount > 0
                ? JSON.stringify({ grading_pending: true, pendingEssayCount: pendingCount, show_score: false })
                : Boolean(answer.show_score)
                    ? JSON.stringify({
                        score: finalScore,
                        passed,
                        earnedPoints,
                        totalPoints,
                        passingGrade: Number(answer.passing_grade || 0),
                        show_score: true,
                    })
                    : JSON.stringify({ passed, show_score: false });
            const mappings = await getSessionExamMappings(connection, resultContext);
            const mapping = mappings.find((entry) => entry.module_item_id === answer.module_item_id);
            if (!mapping) {
                await connection.rollback();
                connection.release();
                connection = undefined;
                return NextResponse.json({ success: false, error: 'Pemetaan exam ke sesi induk tidak ditemukan' }, { status: 409 });
            }

            await connection.execute(
                `INSERT INTO exam_attempt_results
                    (id, root_session_id, session_id, user_id, module_item_id, exam_id,
                     source_exam_id, attempt_number, original_score, score_adjustment,
                     final_score, grading_pending, completed_at)
                 VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE
                     original_score = VALUES(original_score),
                     final_score = VALUES(final_score),
                     grading_pending = VALUES(grading_pending),
                     completed_at = VALUES(completed_at)`,
                [
                    resultContext.root_session_id, session_id, user_id, answer.module_item_id,
                    exam_id, mapping.source_exam_id, attempt_number,
                    pendingCount === 0 ? newScore : null,
                    Number(answer.score_adjustment || 0),
                    pendingCount === 0 ? finalScore : null,
                    pendingCount > 0 ? 1 : 0,
                    pendingCount === 0 ? new Date() : null,
                ],
            );

            const [bestRows] = await connection.execute<Array<RowDataPacket & { best_score: number | string | null }>>(
                `SELECT MAX(final_score) AS best_score
                 FROM exam_attempt_results
                 WHERE session_id = ? AND user_id = ? AND module_item_id = ?
                   AND grading_pending = FALSE AND final_score IS NOT NULL`,
                [session_id, user_id, answer.module_item_id],
            );
            const bestSessionScore = bestRows[0]?.best_score === null || bestRows[0]?.best_score === undefined
                ? null
                : Number(bestRows[0].best_score);

            await connection.execute(
                `UPDATE user_progress 
                 SET original_score = ?, 
                     score = ?,
                     grading_pending = ?,
                     status = CASE WHEN ? = 0 THEN 'completed' ELSE 'grading_pending' END,
                     last_submission_result = ?
                 WHERE user_id = ? AND session_id = ? AND module_item_id = ?`,
                [
                    pendingCount === 0 ? newScore : null,
                    bestSessionScore,
                    pendingCount > 0 ? 1 : 0,
                    pendingCount,
                    submissionResult,
                    user_id,
                    session_id,
                    answer.module_item_id,
                ],
            );
        }

        await connection.commit();
        connection.release();
        connection = undefined;

        await logger.audit(authUser.id, 'MANUAL_GRADE_EXAM', 'exam_answers', answer.id, {
            session_id,
            user_id,
            exam_id,
            question_id,
            attempt_number,
            is_correct: finalIsCorrect,
            awarded_points: finalAwardedPoints,
            score: newScore,
            progress_updated: isLatestAttempt,
        }, 'ADMIN_GRADING');

        return NextResponse.json({
            success: true,
            message: 'Nilai jawaban berhasil diperbarui',
            data: {
                newScore: pendingCount === 0 ? newScore : null,
                awarded_points: finalAwardedPoints,
                is_correct: finalIsCorrect,
                progress_updated: isLatestAttempt,
                grading_pending: pendingCount > 0,
                pending_count: pendingCount,
            },
        });
    } catch (error) {
        if (connection) {
            await connection.rollback();
            connection.release();
        }
        logger.error('ADMIN_GRADING', 'Gagal memproses penilaian manual', error, authUser.id);
        return NextResponse.json(
            { success: false, error: 'Terjadi kesalahan pada server saat memproses penilaian' },
            { status: 500 },
        );
    }
}

export const POST = withAuth(handlePost, { allowedRoles: ['admin', 'trainer'] });
