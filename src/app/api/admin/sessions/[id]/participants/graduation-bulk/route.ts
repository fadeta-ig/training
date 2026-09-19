import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { withAuth, AuthenticatedUser } from '@/lib/api-auth';
import logger from '@/lib/logger';
import { z } from 'zod';

const bulkGraduationSchema = z.object({
    participant_ids: z.array(z.string().min(1)).min(1, 'Pilih minimal satu peserta'),
    graduation_status: z.enum(['pending', 'passed', 'failed']),
    graduation_notes: z.string().max(1000).optional().nullable(),
});

import { formatSklNumber, getSklPeriod, reserveNextSklSequence } from '@/lib/skl';

async function handlePost(
    request: NextRequest,
    user: AuthenticatedUser,
    context: { params: Promise<{ id: string }> }
) {
    let connection;
    try {
        const { id: sessionId } = await context.params;
        const body = await request.json();
        const parsed = bulkGraduationSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { success: false, error: 'Validasi data gagal', details: parsed.error.flatten().fieldErrors },
                { status: 400 }
            );
        }

        const { participant_ids, graduation_status, graduation_notes } = parsed.data;

        connection = await pool.getConnection();
        await connection.beginTransaction();

        const [sessionIdentityRows] = await connection.execute<any[]>(
            `SELECT session_type FROM sessions WHERE id = ? LIMIT 1`,
            [sessionId],
        );
        if (!sessionIdentityRows.length) {
            await connection.rollback();
            connection.release();
            connection = undefined;
            return NextResponse.json({ success: false, error: 'Sesi tidak ditemukan' }, { status: 404 });
        }
        if (sessionIdentityRows[0].session_type === 'remedial') {
            await connection.rollback();
            connection.release();
            connection = undefined;
            return NextResponse.json(
                { success: false, error: 'Keputusan kelulusan dan SKL hanya dikelola dari Session Manager sesi reguler induk' },
                { status: 409 },
            );
        }

        // Fetch enrolled participants with row lock
        const placeholders = participant_ids.map(() => '?').join(',');
        const [participants] = await connection.execute<any[]>(
            `SELECT sp.id, sp.user_id, sp.graduation_status, sp.skl_number, p.batch, u.full_name
             FROM session_participants sp
             JOIN users u ON sp.user_id = u.id
             LEFT JOIN participant_profiles p ON sp.user_id = p.user_id
             WHERE sp.session_id = ? AND sp.user_id IN (${placeholders})
             FOR UPDATE`,
            [sessionId, ...participant_ids]
        );

        if (!participants || participants.length === 0) {
            await connection.rollback();
            connection.release();
            return NextResponse.json(
                { success: false, error: 'Tidak ada peserta valid yang ditemukan pada sesi ini' },
                { status: 404 }
            );
        }

        if (graduation_status !== 'pending') {
            const [pendingRows] = await connection.execute<Array<{ user_id: string }> & any[]>(
                `SELECT DISTINCT user_id FROM user_progress
                 WHERE session_id = ? AND user_id IN (${placeholders})
                   AND (status = 'grading_pending' OR COALESCE(grading_pending, 0) = 1)`,
                [sessionId, ...participant_ids],
            );
            if (pendingRows.length > 0) {
                await connection.rollback();
                connection.release();
                connection = undefined;
                return NextResponse.json(
                    {
                        success: false,
                        error: 'Sebagian peserta masih memiliki penilaian esai yang belum selesai',
                        participant_ids: pendingRows.map((row) => row.user_id),
                    },
                    { status: 409 },
                );
            }

            const [outcomeRows] = await connection.execute<any[]>(
                `SELECT pi.user_id, pi.outcome
                 FROM session_result_publications publication
                 JOIN session_result_publication_items pi ON pi.publication_id = publication.id
                 WHERE publication.root_session_id = ? AND publication.status = 'active'
                   AND pi.user_id IN (${placeholders})`,
                [sessionId, ...participant_ids],
            );
            const outcomesByUser = new Map<string, string[]>();
            for (const row of outcomeRows) {
                const outcomes = outcomesByUser.get(row.user_id) || [];
                outcomes.push(row.outcome);
                outcomesByUser.set(row.user_id, outcomes);
            }
            const unpublishedIds = participants
                .map((participant) => participant.user_id)
                .filter((participantId) => !outcomesByUser.has(participantId));
            const activeRemedialIds = participants
                .map((participant) => participant.user_id)
                .filter((participantId) => outcomesByUser.get(participantId)?.includes('remedial_required'));
            const ineligiblePassedIds = graduation_status === 'passed'
                ? participants
                    .map((participant) => participant.user_id)
                    .filter((participantId) => !(outcomesByUser.get(participantId) || []).every((outcome) => outcome === 'passed'))
                : [];
            if (unpublishedIds.length > 0 || activeRemedialIds.length > 0 || ineligiblePassedIds.length > 0) {
                await connection.rollback();
                connection.release();
                connection = undefined;
                return NextResponse.json({
                    success: false,
                    error: unpublishedIds.length > 0
                        ? 'Sebagian peserta belum memiliki hasil sesi yang dipublikasikan'
                        : activeRemedialIds.length > 0
                            ? 'Sebagian peserta masih wajib mengikuti remedial'
                            : 'Sebagian peserta belum mencapai passing grade seluruh exam',
                    participant_ids: unpublishedIds.length > 0 ? unpublishedIds : activeRemedialIds.length > 0 ? activeRemedialIds : ineligiblePassedIds,
                }, { status: 409 });
            }
        }

        const { year, romanMonth } = getSklPeriod();
        let updatedCount = 0;

        for (const p of participants) {
            let sklNumberToSet = p.skl_number || null;
            if (graduation_status === 'passed' && !sklNumberToSet) {
                const nextSequence = await reserveNextSklSequence(connection, romanMonth, year);
                sklNumberToSet = formatSklNumber(nextSequence, romanMonth, year);
            }

            await connection.execute(
                `UPDATE session_participants
                 SET graduation_status = ?,
                     graduation_decided_at = CURRENT_TIMESTAMP,
                     graduation_decided_by = ?,
                     graduation_notes = ?,
                     skl_number = ?,
                     skl_generated_at = CASE 
                         WHEN ? IS NOT NULL AND skl_generated_at IS NULL THEN CURRENT_TIMESTAMP 
                         ELSE skl_generated_at 
                     END
                 WHERE session_id = ? AND user_id = ?`,
                [
                    graduation_status,
                    user.id,
                    graduation_notes ?? null,
                    sklNumberToSet,
                    sklNumberToSet,
                    sessionId,
                    p.user_id,
                ]
            );
            updatedCount++;
        }

        await connection.commit();
        connection.release();
        connection = undefined;

        await logger.audit(
            user.id,
            'BULK_GRADUATION_VERDICT',
            'session_participants',
            sessionId,
            {
                session_id: sessionId,
                participant_count: updatedCount,
                participant_ids,
                graduation_status,
            },
            'ADMIN_GRADUATION'
        );

        return NextResponse.json({
            success: true,
            message: `Berhasil menetapkan status ${graduation_status.toUpperCase()} untuk ${updatedCount} peserta.`,
            data: {
                updated_count: updatedCount,
                graduation_status,
            },
        });
    } catch (error) {
        if (connection) {
            await connection.rollback();
            connection.release();
        }
        const message = error instanceof Error ? error.message : 'Internal Server Error';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

export const POST = withAuth(handlePost, { allowedRoles: ['admin'] });
