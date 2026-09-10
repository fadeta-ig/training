import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import { withAuth, AuthenticatedUser } from '@/lib/api-auth';
import { sendCredentialEmail } from '@/lib/email';
import { logActivity } from '@/lib/audit';
import logger from '@/lib/logger';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { checkRateLimit } from '@/lib/rate-limit';
import { ensureInitialPasswordColumn, generateSecurePassword } from '@/lib/participant-helpers';

const RATE_LIMIT_CONFIG = { windowMs: 60_000, maxRequests: 20 };

const resendSchema = z.object({
    participant_ids: z.array(z.string().min(1, 'ID peserta tidak valid')).min(1, 'Pilih minimal satu peserta'),
});

interface TargetParticipant {
    id: string;
    username: string;
    full_name: string;
    profile_id: string | null;
}

interface ProcessResult {
    id: string;
    name: string;
    email: string;
    newPassword?: string;
    emailSent: boolean;
    error?: string;
}

async function handlePost(request: NextRequest, authUser: AuthenticatedUser) {
    const blocked = checkRateLimit(request, { ...RATE_LIMIT_CONFIG, identifier: authUser.id });
    if (blocked) return blocked;

    try {
        const body = await request.json();
        const parsed = resendSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { success: false, error: 'Data permintaan tidak valid', details: parsed.error.flatten().fieldErrors },
                { status: 400 }
            );
        }

        const { participant_ids } = parsed.data;

        // Ensure database column exists
        await ensureInitialPasswordColumn();

        // Fetch participants in scope
        const placeholders = participant_ids.map(() => '?').join(',');
        const query = `
            SELECT u.id, u.username, u.full_name, pp.id AS profile_id
            FROM users u
            LEFT JOIN participant_profiles pp ON u.id = pp.user_id
            WHERE u.id IN (${placeholders}) AND u.role = 'trainee'
        `;

        const participants = await executeQuery<TargetParticipant[]>(query, participant_ids);

        if (!participants || participants.length === 0) {
            return NextResponse.json(
                { success: false, error: 'Tidak ada data peserta yang ditemukan untuk diproses' },
                { status: 404 }
            );
        }

        const results: ProcessResult[] = [];
        let successCount = 0;
        let failureCount = 0;

        // Process in controlled batches to avoid overwhelming SMTP server
        const BATCH_SIZE = 5;
        for (let i = 0; i < participants.length; i += BATCH_SIZE) {
            const batch = participants.slice(i, i + BATCH_SIZE);

            await Promise.all(
                batch.map(async (participant) => {
                    const newPassword = generateSecurePassword(12);
                    try {
                        const passwordHash = await bcrypt.hash(newPassword, 10);

                        // 1. Update password hash in users table
                        await executeQuery(
                            `UPDATE users SET password_hash = ? WHERE id = ?`,
                            [passwordHash, participant.id]
                        );

                        // 2. Update initial_password in participant_profiles table
                        await executeQuery(
                            `UPDATE participant_profiles SET initial_password = ? WHERE user_id = ?`,
                            [newPassword, participant.id]
                        );

                        // 3. Send email to participant
                        let emailSent = false;
                        let emailError: string | undefined;

                        try {
                            await sendCredentialEmail(participant.username, participant.full_name, newPassword);
                            emailSent = true;
                            successCount++;
                        } catch (mailErr: any) {
                            emailError = mailErr?.message || 'Gagal mengirim email kredensial';
                            logger.warn('RESEND_EMAIL_FAIL', `Gagal mengirim email ke ${participant.username}`, {
                                error: emailError,
                            });
                        }

                        // 4. Audit trail
                        await logActivity(authUser.id, 'RESEND_CREDENTIALS', 'users', participant.id, {
                            email: participant.username,
                            emailSent,
                            emailError,
                        });

                        results.push({
                            id: participant.id,
                            name: participant.full_name,
                            email: participant.username,
                            newPassword,
                            emailSent,
                            error: emailError,
                        });
                    } catch (itemErr: any) {
                        failureCount++;
                        logger.error('RESEND_CREDENTIAL_ERROR', `Gagal mereset kredensial peserta ${participant.id}`, itemErr);
                        results.push({
                            id: participant.id,
                            name: participant.full_name,
                            email: participant.username,
                            emailSent: false,
                            error: itemErr?.message || 'Gagal memproses kredensial',
                        });
                    }
                })
            );

            // Pacing delay between batches to protect SMTP server from rate limits
            if (i + BATCH_SIZE < participants.length) {
                await new Promise((resolve) => setTimeout(resolve, 1000));
            }
        }

        const message = participants.length === 1
            ? (results[0].emailSent
                ? `Kredensial baru berhasil dibuat dan dikirim ke email ${results[0].email}`
                : `Password baru berhasil diperbarui, namun pengiriman email ke ${results[0].email} gagal. Silakan salin password secara manual.`)
            : `Pemrosesan massal selesai: ${successCount} berhasil terkirim dari total ${participants.length} peserta.`;

        return NextResponse.json({
            success: true,
            message,
            total: participants.length,
            successCount,
            failureCount,
            results,
        });

    } catch (error: any) {
        logger.error('RESEND_CREDENTIALS', 'Kesalahan fatal pada endpoint kirim ulang kredensial', error);
        return NextResponse.json(
            { success: false, error: 'Terjadi kesalahan sistem saat memproses kredensial' },
            { status: 500 }
        );
    }
}

export const POST = withAuth(handlePost, { allowedRoles: ['admin'] });
