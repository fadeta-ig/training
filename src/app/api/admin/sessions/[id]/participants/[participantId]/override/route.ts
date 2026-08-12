import { NextRequest, NextResponse } from 'next/server';
import type { RowDataPacket } from 'mysql2';
import { v4 as uuidv4 } from 'uuid';
import pool from '@/lib/db';
import { withAuth, type AuthenticatedUser } from '@/lib/api-auth';
import {
    getSessionModuleItem,
    verifyEnrollment,
    ParticipantError,
} from '@/lib/participant-helpers';
import { logActivity } from '@/lib/audit';

interface OverrideRequestBody {
    exam_id?: unknown;
    action?: unknown;
    extra_minutes?: unknown;
    reason?: unknown;
}

interface ProgressRow extends RowDataPacket {
    id: string;
    status: string;
    score: number | null;
    attempts_count: number;
    attempt_version: number;
    last_attempt_start: Date | null;
    individual_extension_until: Date | null;
}

async function handlePost(
    request: NextRequest,
    user: AuthenticatedUser,
    context: { params: Promise<{ id: string; participantId: string }> }
) {
    let connection;

    try {
        const { id: sessionId, participantId } = await context.params;
        const body = (await request.json()) as OverrideRequestBody;

        const examId = typeof body.exam_id === 'string' ? body.exam_id.trim() : '';
        const action = typeof body.action === 'string' ? body.action.trim().toLowerCase() : '';
        const extraMinutes = typeof body.extra_minutes === 'number' && Number.isFinite(body.extra_minutes)
            ? Math.max(0, Math.floor(body.extra_minutes))
            : 0;
        const reason = typeof body.reason === 'string' ? body.reason.trim() : 'Admin override';

        if (!examId) {
            return NextResponse.json({ success: false, error: 'ID Ujian wajib diisi' }, { status: 400 });
        }

        if (action !== 'resume' && action !== 'reset') {
            return NextResponse.json(
                { success: false, error: 'Aksi tidak valid. Pilih "resume" atau "reset"' },
                { status: 400 }
            );
        }

        await verifyEnrollment(sessionId, participantId);
        const moduleItem = await getSessionModuleItem('', 'exam', examId).catch(async () => {
            // Fallback: lookup module_item directly by session's module_id
            const sessionRows = await pool.query<RowDataPacket[]>(
                `SELECT module_id FROM sessions WHERE id = ?`,
                [sessionId]
            );
            if (!sessionRows[0]?.[0]?.module_id) {
                throw new ParticipantError('Sesi tidak ditemukan', 404);
            }
            return getSessionModuleItem(sessionRows[0][0].module_id, 'exam', examId);
        });

        connection = await pool.getConnection();
        await connection.beginTransaction();

        const [progressRows] = await connection.execute<ProgressRow[]>(
            `SELECT id, status, score, attempts_count, attempt_version, last_attempt_start, individual_extension_until
             FROM user_progress
             WHERE user_id = ? AND session_id = ? AND module_item_id = ?
             LIMIT 1
             FOR UPDATE`,
            [participantId, sessionId, moduleItem.id]
        );

        const progress = progressRows[0];
        let progressId = progress?.id;
        const currentAttemptNumber = Math.max(1, Number(progress?.attempts_count || 1));
        const newAttemptVersion = (Number(progress?.attempt_version) || 1) + 1;

        if (!progress) {
            progressId = uuidv4();
            await connection.execute(
                `INSERT INTO user_progress
                    (id, user_id, session_id, module_item_id, status, attempts_count, attempt_version, last_attempt_start)
                 VALUES (?, ?, ?, ?, 'open', 0, ?, UTC_TIMESTAMP())`,
                [progressId, participantId, sessionId, moduleItem.id, newAttemptVersion]
            );
        }

        if (action === 'resume') {
            // Action Resume: Re-open progress, increment attempt_version, adjust time / extension
            await connection.execute(
                `UPDATE user_progress
                 SET status = 'open',
                     attempt_version = ?,
                     last_attempt_start = IF(last_attempt_start IS NULL, UTC_TIMESTAMP(), last_attempt_start),
                     individual_extension_until = IF(? > 0, DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? MINUTE), individual_extension_until)
                 WHERE user_id = ? AND session_id = ? AND module_item_id = ?`,
                [newAttemptVersion, extraMinutes, extraMinutes, participantId, sessionId, moduleItem.id]
            );

            // Remove any graded answers for this attempt so status reverts to draft pengerjaan
            await connection.execute(
                `DELETE FROM exam_answers
                 WHERE user_id = ? AND session_id = ? AND exam_id = ? AND attempt_number = ?`,
                [participantId, sessionId, examId, currentAttemptNumber]
            );
        } else {
            // Action Reset: Clean drafts & answers, reset last_attempt_start, score = NULL, status = 'open'
            await connection.execute(
                `UPDATE user_progress
                 SET status = 'open',
                     score = NULL,
                     attempt_version = ?,
                     last_attempt_start = UTC_TIMESTAMP(),
                     individual_extension_until = IF(? > 0, DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? MINUTE), NULL)
                 WHERE user_id = ? AND session_id = ? AND module_item_id = ?`,
                [newAttemptVersion, extraMinutes, extraMinutes, participantId, sessionId, moduleItem.id]
            );

            await connection.execute(
                `DELETE FROM exam_answer_drafts
                 WHERE user_id = ? AND session_id = ? AND exam_id = ? AND attempt_number = ?`,
                [participantId, sessionId, examId, currentAttemptNumber]
            );

            await connection.execute(
                `DELETE FROM exam_answers
                 WHERE user_id = ? AND session_id = ? AND exam_id = ? AND attempt_number = ?`,
                [participantId, sessionId, examId, currentAttemptNumber]
            );
        }

        await connection.commit();
        connection.release();
        connection = undefined;

        await logActivity(
            user.id,
            action === 'resume' ? 'EXAM_OVERRIDE_RESUME' : 'EXAM_OVERRIDE_RESET',
            'user_progress',
            progressId || null,
            {
                admin_id: user.id,
                participant_id: participantId,
                session_id: sessionId,
                exam_id: examId,
                action,
                extra_minutes: extraMinutes,
                reason,
                new_attempt_version: newAttemptVersion,
            }
        );

        return NextResponse.json({
            success: true,
            message: action === 'resume'
                ? 'Berhasil melanjutkan pengerjaan ujian peserta.'
                : 'Berhasil mengulang ujian peserta dari awal.',
            data: {
                participant_id: participantId,
                action,
                attempt_version: newAttemptVersion,
                extra_minutes: extraMinutes,
            },
        });
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

export const POST = withAuth(handlePost, { allowedRoles: ['admin', 'trainer'] });
