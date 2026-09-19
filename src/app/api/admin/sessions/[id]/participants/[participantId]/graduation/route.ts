import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { withAuth, AuthenticatedUser } from '@/lib/api-auth';
import logger from '@/lib/logger';
import { z } from 'zod';
import { formatSklNumber, getSklPeriod, reserveNextSklSequence } from '@/lib/skl';
import { isSafePublicUrl } from '@/lib/sanitize';
import { cleanupUnusedUploads } from '@/lib/upload-cleanup';

const graduationSchema = z.object({
    graduation_status: z.enum(['pending', 'passed', 'failed']),
    graduation_notes: z.string().max(1000).optional().nullable(),
    certificate_file_url: z.string().max(500)
        .refine((value) => isSafePublicUrl(value), 'URL sertifikat tidak aman atau tidak valid')
        .optional().nullable(),
    certificate_number: z.string().trim().max(100).optional().nullable(),
});

async function handlePost(
    request: NextRequest,
    user: AuthenticatedUser,
    context: { params: Promise<{ id: string; participantId: string }> }
) {
    let connection;
    try {
        const { id: sessionId, participantId } = await context.params;
        const body = await request.json();
        const parsed = graduationSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { success: false, error: 'Validasi data gagal', details: parsed.error.flatten().fieldErrors },
                { status: 400 }
            );
        }

        const { graduation_status, graduation_notes, certificate_file_url, certificate_number } = parsed.data;

        connection = await pool.getConnection();
        await connection.beginTransaction();

        const [sessionIdentityRows] = await connection.execute<any[]>(
            `SELECT session_type, parent_session_id FROM sessions WHERE id = ? LIMIT 1`,
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

        // Check if participant is enrolled with row lock
        const [participantRows] = await connection.execute<any[]>(
            `SELECT sp.id, sp.graduation_status, sp.skl_number, sp.certificate_file_url, p.batch, u.full_name
             FROM session_participants sp
             JOIN users u ON sp.user_id = u.id
             LEFT JOIN participant_profiles p ON sp.user_id = p.user_id
             WHERE sp.session_id = ? AND sp.user_id = ?
             LIMIT 1
             FOR UPDATE`,
            [sessionId, participantId]
        );

        if (!participantRows || participantRows.length === 0) {
            await connection.rollback();
            connection.release();
            return NextResponse.json(
                { success: false, error: 'Peserta tidak terdaftar pada sesi ini' },
                { status: 404 }
            );
        }

        const current = participantRows[0];
        if (graduation_status !== 'pending') {
            const [pendingRows] = await connection.execute<Array<{ total: number | string }> & any[]>(
                `SELECT COUNT(*) AS total FROM user_progress
                 WHERE session_id = ? AND user_id = ?
                   AND (status = 'grading_pending' OR COALESCE(grading_pending, 0) = 1)`,
                [sessionId, participantId],
            );
            if (Number(pendingRows[0]?.total || 0) > 0) {
                await connection.rollback();
                connection.release();
                connection = undefined;
                return NextResponse.json(
                    { success: false, error: 'Status kelulusan belum dapat ditetapkan karena penilaian esai masih berlangsung' },
                    { status: 409 },
                );
            }

            const [resultRows] = await connection.execute<any[]>(
                `SELECT pi.outcome
                 FROM session_result_publications publication
                 JOIN session_result_publication_items pi ON pi.publication_id = publication.id
                 WHERE publication.root_session_id = ? AND publication.status = 'active'
                   AND pi.user_id = ?`,
                [sessionId, participantId],
            );
            if (resultRows.length === 0) {
                await connection.rollback();
                connection.release();
                connection = undefined;
                return NextResponse.json(
                    { success: false, error: 'Keputusan kelulusan belum dapat ditetapkan karena hasil sesi belum dipublikasikan' },
                    { status: 409 },
                );
            }
            if (resultRows.some((row) => row.outcome === 'remedial_required')) {
                await connection.rollback();
                connection.release();
                connection = undefined;
                return NextResponse.json(
                    { success: false, error: 'Keputusan kelulusan belum dapat ditetapkan karena peserta masih wajib mengikuti remedial' },
                    { status: 409 },
                );
            }
            if (graduation_status === 'passed' && resultRows.some((row) => row.outcome !== 'passed')) {
                await connection.rollback();
                connection.release();
                connection = undefined;
                return NextResponse.json(
                    { success: false, error: 'Peserta tidak dapat diluluskan karena belum seluruh exam mencapai passing grade' },
                    { status: 409 },
                );
            }
        }
        let sklNumberToSet: string | null = current.skl_number || null;

        if (graduation_status === 'passed' && !sklNumberToSet) {
            const { year, romanMonth } = getSklPeriod();
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
                 END,
                 certificate_file_url = COALESCE(?, certificate_file_url),
                 certificate_number = COALESCE(?, certificate_number),
                 certificate_uploaded_at = CASE 
                     WHEN ? IS NOT NULL THEN CURRENT_TIMESTAMP 
                     ELSE certificate_uploaded_at 
                 END
             WHERE session_id = ? AND user_id = ?`,
            [
                graduation_status,
                user.id,
                graduation_notes ?? null,
                sklNumberToSet,
                sklNumberToSet,
                certificate_file_url ?? null,
                certificate_number ?? null,
                certificate_file_url ?? null,
                sessionId,
                participantId,
            ]
        );

        await connection.commit();
        connection.release();
        connection = undefined;

        if (certificate_file_url && current.certificate_file_url && certificate_file_url !== current.certificate_file_url) {
            await cleanupUnusedUploads([current.certificate_file_url]);
        }

        await logger.audit(
            user.id,
            'GRADUATION_VERDICT_UPDATED',
            'session_participants',
            current.id,
            {
                participant_id: participantId,
                participant_name: current.full_name,
                session_id: sessionId,
                graduation_status,
                skl_number: sklNumberToSet,
                has_certificate: !!certificate_file_url,
            },
            'ADMIN_GRADUATION'
        );

        return NextResponse.json({
            success: true,
            message: `Status kelulusan untuk ${current.full_name || 'peserta'} berhasil diperbarui menjadi ${graduation_status.toUpperCase()}`,
            data: {
                graduation_status,
                graduation_notes,
                skl_number: sklNumberToSet,
                certificate_file_url,
                certificate_number,
            },
        });
    } catch (error) {
        if (connection) {
            await connection.rollback().catch(() => {});
            connection.release();
        }
        const message = error instanceof Error ? error.message : 'Internal Server Error';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

export const POST = withAuth(handlePost, { allowedRoles: ['admin'] });
