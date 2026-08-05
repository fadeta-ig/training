import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { RowDataPacket } from 'mysql2';
import pool from '@/lib/db';
import { withAuth, type AuthenticatedUser } from '@/lib/api-auth';
import logger from '@/lib/logger';

const gradeSchema = z.object({
    session_id: z.string().uuid(),
    user_id: z.string().uuid(),
    exam_id: z.string().uuid(),
    question_id: z.string().uuid(),
    attempt_number: z.number().int().positive(),
    is_correct: z.boolean(),
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
    let connection;

    try {
        const parsed = gradeSchema.safeParse(await request.json());
        if (!parsed.success) {
            return NextResponse.json(
                { success: false, error: 'Validasi form gagal', details: parsed.error.flatten().fieldErrors },
                { status: 400 },
            );
        }

        const { session_id, user_id, exam_id, question_id, attempt_number, is_correct } = parsed.data;
        connection = await pool.getConnection();
        await connection.beginTransaction();

        const [answerRows] = await connection.execute<GradingAnswerRow[]>(
            `SELECT ea.id, ea.selected_option, ea.question_snapshot,
                    q.question_type AS current_question_type, q.points AS current_points,
                    mi.id AS module_item_id, up.attempts_count
             FROM exam_answers ea
             INNER JOIN sessions s ON s.id = ea.session_id
             INNER JOIN session_participants sp
                ON sp.session_id = ea.session_id AND sp.user_id = ea.user_id
             INNER JOIN module_items mi
                ON mi.module_id = s.module_id AND mi.item_type = 'exam' AND mi.item_id = ea.exam_id
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
        const points = Number(snapshot?.points ?? answer.current_points ?? 1) || 1;
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

        await connection.execute(
            `UPDATE exam_answers
             SET is_correct = ?, grading_status = 'graded', awarded_points = ?,
                 graded_by = ?, graded_at = UTC_TIMESTAMP()
             WHERE id = ?`,
            [is_correct ? 1 : 0, is_correct ? points : 0, authUser.id, answer.id],
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

        const isLatestAttempt = Number(answer.attempts_count) === attempt_number;
        if (isLatestAttempt) {
            await connection.execute(
                `UPDATE user_progress SET score = ?
                 WHERE user_id = ? AND session_id = ? AND module_item_id = ?`,
                [newScore, user_id, session_id, answer.module_item_id],
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
            is_correct,
            score: newScore,
            progress_updated: isLatestAttempt,
        }, 'ADMIN_GRADING');

        return NextResponse.json({
            success: true,
            message: 'Nilai jawaban berhasil diperbarui',
            data: { newScore, progress_updated: isLatestAttempt },
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

export const POST = withAuth(handlePost, { allowedRoles: ['admin'] });
