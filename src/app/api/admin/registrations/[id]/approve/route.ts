import { NextRequest, NextResponse } from 'next/server';
import pool, { executeQuery } from '@/lib/db';
import { withAuth, AuthenticatedUser, validateMutationOrigin } from '@/lib/api-auth';
import { logActivity } from '@/lib/audit';
import { generateSingleNip } from '@/lib/nip';
import { z } from 'zod';

const approveSchema = z.object({
    batch: z.coerce.number().int().min(1, 'Batch minimal 1').default(1),
});

async function handlePost(
    request: NextRequest,
    user: AuthenticatedUser,
    context: { params: Promise<{ id: string }> }
) {
    const invalidOrigin = validateMutationOrigin(request);
    if (invalidOrigin) return invalidOrigin;

    try {
        const { id: targetUserId } = await context.params;
        const body = await request.json().catch(() => ({}));
        const parseResult = approveSchema.safeParse(body);

        if (!parseResult.success) {
            const firstError = parseResult.error.issues[0]?.message || 'Data approval tidak valid';
            return NextResponse.json({ success: false, error: firstError }, { status: 400 });
        }

        const batchNumber = parseResult.data.batch;

        // Fetch current registration details
        const users = await executeQuery<any[]>(
            `SELECT u.id, u.full_name, u.username, u.approval_status, pp.institution, pp.registration_date, pp.nip
             FROM users u
             LEFT JOIN participant_profiles pp ON pp.user_id = u.id
             WHERE u.id = ? AND u.role = 'trainee'
             LIMIT 1`,
            [targetUserId]
        );

        if (!Array.isArray(users) || users.length === 0) {
            return NextResponse.json({ success: false, error: 'Data pendaftar tidak ditemukan' }, { status: 404 });
        }

        const targetUser = users[0];

        // Execute atomic transaction for NIP generation & approval
        const connection = await pool.getConnection();
        let generatedNip = targetUser.nip;
        let institutionCode = '';

        try {
            await connection.beginTransaction();

            // Generate NIP if not already assigned
            if (!generatedNip) {
                const nipResult = await generateSingleNip(connection, {
                    institution: targetUser.institution,
                    batch: batchNumber,
                    registrationDate: targetUser.registration_date || new Date(),
                });
                generatedNip = nipResult.nip;
                institutionCode = nipResult.institutionCode;
            }

            // Update user status
            await connection.execute(
                `UPDATE users 
                 SET approval_status = 'approved', approved_at = NOW(), rejection_reason = NULL 
                 WHERE id = ?`,
                [targetUserId]
            );

            // Update profile with NIP and Batch
            await connection.execute(
                `UPDATE participant_profiles 
                 SET nip = ?, batch = ?, institution_code = COALESCE(NULLIF(institution_code, ''), ?)
                 WHERE user_id = ?`,
                [generatedNip, batchNumber, institutionCode || 'GEN', targetUserId]
            );

            await connection.commit();
        } catch (dbError) {
            await connection.rollback();
            throw dbError;
        } finally {
            connection.release();
        }

        // Log audit trail
        await logActivity(user.id, 'REGISTRATION_APPROVED', 'users', targetUserId, {
            approved_by: user.username,
            target_user: targetUser.username,
            full_name: targetUser.full_name,
            batch: batchNumber,
            generated_nip: generatedNip,
        });

        return NextResponse.json({
            success: true,
            message: `Pendaftaran berhasil disetujui. NIP resmi telah diterbitkan: ${generatedNip}`,
            data: {
                id: targetUserId,
                nip: generatedNip,
                batch: batchNumber,
                approval_status: 'approved',
            },
        });
    } catch (error) {
        console.error('[ADMIN_REGISTRATION_APPROVE_ERROR]', error);
        return NextResponse.json(
            { success: false, error: 'Terjadi kesalahan saat menyetujui pendaftaran' },
            { status: 500 }
        );
    }
}

export const POST = withAuth(handlePost, { allowedRoles: ['admin'] });
