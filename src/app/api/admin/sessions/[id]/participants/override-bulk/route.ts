import { NextRequest, NextResponse } from 'next/server';
import type { RowDataPacket } from 'mysql2';
import { v4 as uuidv4 } from 'uuid';
import pool from '@/lib/db';
import { withAuth, type AuthenticatedUser } from '@/lib/api-auth';
import { ParticipantError } from '@/lib/participant-helpers';
import { logActivity } from '@/lib/audit';

interface BulkOverrideRequestBody {
    participant_ids?: unknown;
    extra_minutes?: unknown;
    reason?: unknown;
    exam_id?: unknown;
}

interface ProgressRow extends RowDataPacket {
    id: string;
    user_id: string;
    module_item_id: string;
    attempts_count: number;
    attempt_version: number;
}

interface ModuleItemRow extends RowDataPacket {
    id: string;
    item_id: string;
    title: string;
}

async function handlePost(
    request: NextRequest,
    user: AuthenticatedUser,
    context: { params: Promise<{ id: string }> }
) {
    let connection;

    try {
        const { id: sessionId } = await context.params;
        const body = (await request.json()) as BulkOverrideRequestBody;

        const participantIds = Array.isArray(body.participant_ids)
            ? body.participant_ids.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
            : [];
        const extraMinutes = typeof body.extra_minutes === 'number' && Number.isFinite(body.extra_minutes)
            ? Math.max(1, Math.floor(body.extra_minutes))
            : 15;
        const reason = typeof body.reason === 'string' && body.reason.trim()
            ? body.reason.trim()
            : 'Perpanjangan Waktu Massal oleh Admin';
        const specificExamId = typeof body.exam_id === 'string' ? body.exam_id.trim() : null;

        if (participantIds.length === 0) {
            return NextResponse.json(
                { success: false, error: 'Pilih minimal satu peserta untuk perpanjangan waktu' },
                { status: 400 }
            );
        }

        // Get session and its exam module items
        const [sessionRows] = await pool.query<RowDataPacket[]>(
            `SELECT id, title, module_id FROM sessions WHERE id = ?`,
            [sessionId]
        );
        if (!sessionRows[0]) {
            return NextResponse.json({ success: false, error: 'Sesi tidak ditemukan' }, { status: 404 });
        }

        const moduleId = sessionRows[0].module_id;
        const [examItems] = await pool.query<ModuleItemRow[]>(
            `SELECT id, item_id, title FROM module_items WHERE module_id = ? AND item_type = 'exam' ${
                specificExamId ? 'AND item_id = ?' : ''
            }`,
            specificExamId ? [moduleId, specificExamId] : [moduleId]
        );

        if (examItems.length === 0) {
            return NextResponse.json(
                { success: false, error: 'Tidak ada modul ujian pada sesi ini' },
                { status: 400 }
            );
        }

        connection = await pool.getConnection();
        await connection.beginTransaction();

        let updatedCount = 0;

        for (const participantId of participantIds) {
            for (const item of examItems) {
                const [progressRows] = await connection.execute<ProgressRow[]>(
                    `SELECT id, user_id, module_item_id, attempts_count, attempt_version
                     FROM user_progress
                     WHERE user_id = ? AND session_id = ? AND module_item_id = ?
                     LIMIT 1
                     FOR UPDATE`,
                    [participantId, sessionId, item.id]
                );

                const progress = progressRows[0];
                const newAttemptVersion = (Number(progress?.attempt_version) || 1) + 1;
                const currentAttemptNumber = Math.max(1, Number(progress?.attempts_count || 1));

                if (!progress) {
                    const newProgressId = uuidv4();
                    await connection.execute(
                        `INSERT INTO user_progress
                            (id, user_id, session_id, module_item_id, status, attempts_count, attempt_version, last_attempt_start, individual_extension_until)
                         VALUES (?, ?, ?, ?, 'open', 0, ?, UTC_TIMESTAMP(), DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? MINUTE))`,
                        [newProgressId, participantId, sessionId, item.id, newAttemptVersion, extraMinutes]
                    );
                } else {
                    await connection.execute(
                        `UPDATE user_progress
                         SET status = 'open',
                             attempt_version = ?,
                             last_attempt_start = IF(last_attempt_start IS NULL, UTC_TIMESTAMP(), last_attempt_start),
                             individual_extension_until = DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? MINUTE)
                         WHERE user_id = ? AND session_id = ? AND module_item_id = ?`,
                        [newAttemptVersion, extraMinutes, participantId, sessionId, item.id]
                    );

                    // Revert graded submission to open draft state
                    await connection.execute(
                        `DELETE FROM exam_answers
                         WHERE user_id = ? AND session_id = ? AND exam_id = ? AND attempt_number = ?`,
                        [participantId, sessionId, item.item_id, currentAttemptNumber]
                    );
                }

                updatedCount++;
            }
        }

        await connection.commit();
        connection.release();
        connection = undefined;

        await logActivity(
            user.id,
            'EXAM_OVERRIDE_BULK_EXTENSION',
            'sessions',
            sessionId,
            {
                admin_id: user.id,
                session_id: sessionId,
                participant_count: participantIds.length,
                participant_ids: participantIds,
                extra_minutes: extraMinutes,
                reason,
            }
        );

        return NextResponse.json({
            success: true,
            message: `Berhasil menambahkan waktu ${extraMinutes} menit untuk ${participantIds.length} peserta.`,
            data: {
                participant_count: participantIds.length,
                extra_minutes: extraMinutes,
                updated_records: updatedCount,
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
