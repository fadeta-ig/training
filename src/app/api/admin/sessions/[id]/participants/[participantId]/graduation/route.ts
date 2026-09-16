import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { withAuth, AuthenticatedUser } from '@/lib/api-auth';
import logger from '@/lib/logger';
import { z } from 'zod';
import { ROMAN_MONTHS, formatSklNumber, getLatestSklSequence } from '@/lib/skl';

const graduationSchema = z.object({
    graduation_status: z.enum(['pending', 'passed', 'failed']),
    graduation_notes: z.string().max(1000).optional().nullable(),
    certificate_file_url: z.string().max(500).optional().nullable(),
    certificate_number: z.string().max(100).optional().nullable(),
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

        // Check if participant is enrolled with row lock
        const [participantRows] = await connection.execute<any[]>(
            `SELECT sp.id, sp.graduation_status, sp.skl_number, p.batch, u.full_name
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
        let sklNumberToSet: string | null = current.skl_number || null;

        if (graduation_status === 'passed' && !sklNumberToSet) {
            const now = new Date();
            const year = now.getFullYear();
            const romanMonth = ROMAN_MONTHS[now.getMonth()] || 'I';
            const latestSeq = await getLatestSklSequence(connection, romanMonth, year);
            sklNumberToSet = formatSklNumber(latestSeq + 1, romanMonth, year);
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
