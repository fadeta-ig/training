import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import pool from '@/lib/db';
import { withAuth, AuthenticatedUser } from '@/lib/api-auth';
import logger from '@/lib/logger';
import { z } from 'zod';

const bulkGraduationSchema = z.object({
    participant_ids: z.array(z.string().min(1)).min(1, 'Pilih minimal satu peserta'),
    graduation_status: z.enum(['pending', 'passed', 'failed']),
    graduation_notes: z.string().max(1000).optional().nullable(),
});

const ROMAN_MONTHS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

function generateSklNumber(batch: string = '1'): string {
    const now = new Date();
    const year = now.getFullYear();
    const romanMonth = ROMAN_MONTHS[now.getMonth()] || 'I';
    const randomSuffix = Math.floor(100 + Math.random() * 900);
    return `${randomSuffix}/E/SK/${romanMonth}/${year}`;
}

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

        // Fetch enrolled participants
        const placeholders = participant_ids.map(() => '?').join(',');
        const participants = await executeQuery<any[]>(
            `SELECT sp.id, sp.user_id, sp.graduation_status, sp.skl_number, p.batch, u.full_name
             FROM session_participants sp
             JOIN users u ON sp.user_id = u.id
             LEFT JOIN participant_profiles p ON sp.user_id = p.user_id
             WHERE sp.session_id = ? AND sp.user_id IN (${placeholders})`,
            [sessionId, ...participant_ids]
        );

        if (!participants || participants.length === 0) {
            return NextResponse.json(
                { success: false, error: 'Tidak ada peserta valid yang ditemukan pada sesi ini' },
                { status: 404 }
            );
        }

        connection = await pool.getConnection();
        await connection.beginTransaction();

        let updatedCount = 0;

        for (const p of participants) {
            let sklNumberToSet = p.skl_number || null;
            if (graduation_status === 'passed' && !sklNumberToSet) {
                sklNumberToSet = generateSklNumber(p.batch || '1');
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
