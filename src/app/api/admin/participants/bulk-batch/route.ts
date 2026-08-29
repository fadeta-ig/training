import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth, AuthenticatedUser } from '@/lib/api-auth';
import { logActivity } from '@/lib/audit';
import pool from '@/lib/db';
import { extractInstitutionCode, formatNip, formatYearMonth, generateBulkNips } from '@/lib/nip';

const bulkBatchSchema = z.object({
    participant_ids: z.array(z.string().uuid()).min(1, 'Pilih minimal satu peserta'),
    batch: z.string().trim().min(1, 'Kode batch wajib diisi').max(50, 'Kode batch maksimal 50 karakter'),
    preserve_sequence: z.boolean().default(true),
});

async function handlePost(request: NextRequest, authUser: AuthenticatedUser) {
    try {
        const body = await request.json();
        const parsed = bulkBatchSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { success: false, error: 'Validasi gagal', details: parsed.error.flatten().fieldErrors },
                { status: 400 }
            );
        }

        const { participant_ids, batch, preserve_sequence } = parsed.data;
        const safeBatch = batch.trim().toUpperCase();

        const connection = await pool.getConnection();
        const updatedList: Array<{ id: string; name: string; oldNip: string | null; newNip: string; batch: string }> = [];

        try {
            await connection.beginTransaction();

            // 1. Fetch current participant profiles
            const placeholders = participant_ids.map(() => '?').join(',');
            const [rows] = await connection.execute<any[]>(
                `SELECT u.id as user_id, u.full_name, pp.nip, pp.institution, pp.institution_code, pp.batch, pp.registration_date
                 FROM users u
                 JOIN participant_profiles pp ON u.id = pp.user_id
                 WHERE u.id IN (${placeholders}) AND u.role = 'trainee'`,
                participant_ids
            );

            if (!Array.isArray(rows) || rows.length === 0) {
                await connection.rollback();
                return NextResponse.json({ success: false, error: 'Tidak ada data peserta yang valid ditemukan' }, { status: 404 });
            }

            // 2. Generate new NIPs
            if (preserve_sequence) {
                // Preserve the 3-digit sequence suffix from existing NIP if available
                for (const p of rows) {
                    const instName = (p.institution || '').trim();
                    const instCode = p.institution_code || extractInstitutionCode(instName);
                    const yearMonth = formatYearMonth(p.registration_date);
                    
                    let seq = 1;
                    if (p.nip && typeof p.nip === 'string') {
                        const parts = p.nip.split('-');
                        const lastNum = parseInt(parts[parts.length - 1], 10);
                        if (!isNaN(lastNum) && lastNum > 0) {
                            seq = lastNum;
                        }
                    }

                    const newNip = formatNip(instCode, safeBatch, yearMonth, seq);

                    await connection.execute(
                        `UPDATE participant_profiles 
                         SET batch = ?, nip = ?, institution_code = ?
                         WHERE user_id = ?`,
                        [safeBatch, newNip, instCode, p.user_id]
                    );

                    updatedList.push({
                        id: p.user_id,
                        name: p.full_name,
                        oldNip: p.nip,
                        newNip,
                        batch: safeBatch,
                    });
                }
            } else {
                // Re-sequence using bulk NIP generator
                const nipGenItems = rows.map((p) => ({
                    institution: p.institution,
                    batch: safeBatch,
                    registration_date: p.registration_date,
                }));

                const { nips, institutionCodes } = await generateBulkNips(connection, nipGenItems);

                for (let i = 0; i < rows.length; i++) {
                    const p = rows[i];
                    const newNip = nips[i];
                    const instCode = institutionCodes[i];

                    await connection.execute(
                        `UPDATE participant_profiles 
                         SET batch = ?, nip = ?, institution_code = ?
                         WHERE user_id = ?`,
                        [safeBatch, newNip, instCode, p.user_id]
                    );

                    updatedList.push({
                        id: p.user_id,
                        name: p.full_name,
                        oldNip: p.nip,
                        newNip,
                        batch: safeBatch,
                    });
                }
            }

            await connection.commit();
        } catch (dbError) {
            await connection.rollback();
            throw dbError;
        } finally {
            connection.release();
        }

        // Audit log
        await logActivity(authUser.id, 'BULK_UPDATE_BATCH', 'participant_profiles', 'bulk', {
            affected_count: updatedList.length,
            new_batch: safeBatch,
            preserve_sequence,
        });

        return NextResponse.json({
            success: true,
            message: `Berhasil memperbarui batch dan NIP untuk ${updatedList.length} peserta.`,
            updatedCount: updatedList.length,
            data: updatedList,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Internal Server Error';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

export const POST = withAuth(handlePost, { allowedRoles: ['admin'] });
