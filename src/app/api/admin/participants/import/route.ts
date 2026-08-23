import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import { executeQuery } from '@/lib/db';
import { withAuth, AuthenticatedUser } from '@/lib/api-auth';
import { logActivity } from '@/lib/audit';
import { sendCredentialEmail } from '@/lib/email';
import pool from '@/lib/db';
import logger from '@/lib/logger';
import crypto from 'crypto';
import { generateBulkNips } from '@/lib/nip';

interface ImportItem {
    name: string;
    email: string;
    phone_number?: string | null;
    institution?: string | null;
    batch?: number | string | null;
    registration_date?: string | null;
    date_of_birth?: string | null;
    gender?: 'L' | 'P' | null;
    address?: string | null;
}

function generateRandomPassword(length = 14) {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < length; i++) {
        password += chars.charAt(crypto.randomInt(chars.length));
    }
    return password;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function handlePost(request: NextRequest, authUser: AuthenticatedUser) {
    try {
        const body = await request.json();
        const { participants, sendEmail } = body as { participants: ImportItem[]; sendEmail?: boolean };

        if (!Array.isArray(participants) || participants.length === 0) {
            return NextResponse.json(
                { success: false, error: 'Data peserta tidak boleh kosong' },
                { status: 400 }
            );
        }

        if (participants.length > 500) {
            return NextResponse.json(
                { success: false, error: 'Maksimal 500 peserta dalam sekali import' },
                { status: 400 }
            );
        }

        // 1. Structural & Format Validation (Pre-flight)
        const failed: { name: string; email: string; reason: string }[] = [];
        const validQueue: ImportItem[] = [];
        const seenEmails = new Set<string>();

        const todayStr = new Date().toISOString().slice(0, 10);

        for (let i = 0; i < participants.length; i++) {
            const item = participants[i];
            const cleanName = (item.name || '').trim();
            const cleanEmail = (item.email || '').trim().toLowerCase();

            if (!cleanName || cleanName.length < 3) {
                failed.push({ name: item.name || `Baris ${i + 1}`, email: cleanEmail || '-', reason: 'Nama lengkap minimal 3 karakter' });
                continue;
            }

            if (!cleanEmail || !EMAIL_REGEX.test(cleanEmail)) {
                failed.push({ name: cleanName, email: cleanEmail || '-', reason: 'Format email tidak valid' });
                continue;
            }

            if (seenEmails.has(cleanEmail)) {
                failed.push({ name: cleanName, email: cleanEmail, reason: 'Duplikasi email di dalam file import' });
                continue;
            }

            seenEmails.add(cleanEmail);

            let parsedBatch = 1;
            if (item.batch !== undefined && item.batch !== null && String(item.batch).trim() !== '') {
                const parsed = parseInt(String(item.batch), 10);
                if (!isNaN(parsed) && parsed > 0) {
                    parsedBatch = parsed;
                }
            }

            let regDate = todayStr;
            if (item.registration_date && /^\d{4}-\d{2}-\d{2}$/.test(String(item.registration_date).trim())) {
                regDate = String(item.registration_date).trim();
            }

            validQueue.push({
                ...item,
                name: cleanName,
                email: cleanEmail,
                phone_number: item.phone_number ? String(item.phone_number).trim() : null,
                institution: item.institution ? String(item.institution).trim() : null,
                batch: parsedBatch,
                registration_date: regDate,
                date_of_birth: item.date_of_birth ? String(item.date_of_birth).trim() : null,
                gender: item.gender === 'L' || item.gender === 'P' ? item.gender : null,
                address: item.address ? String(item.address).trim() : null,
            });
        }

        if (validQueue.length === 0) {
            return NextResponse.json({
                success: false,
                error: 'Tidak ada data peserta yang valid untuk diimport',
                importedCount: 0,
                failedCount: failed.length,
                failed,
            }, { status: 400 });
        }

        // 2. DB Check for existing emails
        const emailsToCheck = validQueue.map(q => q.email);
        const placeholders = emailsToCheck.map(() => '?').join(',');
        const existingUsers = await executeQuery<{ username: string }[]>(
            `SELECT username FROM users WHERE username IN (${placeholders})`,
            emailsToCheck
        );

        const existingSet = new Set((existingUsers || []).map(u => u.username.toLowerCase()));

        const readyToInsert: Array<ImportItem & { batch: number }> = [];
        for (const item of validQueue) {
            if (existingSet.has(item.email)) {
                failed.push({ name: item.name, email: item.email, reason: 'Email sudah terdaftar di sistem' });
            } else {
                readyToInsert.push({
                    ...item,
                    batch: Number(item.batch) || 1,
                });
            }
        }

        if (readyToInsert.length === 0) {
            return NextResponse.json({
                success: false,
                error: 'Semua email peserta sudah terdaftar di database',
                importedCount: 0,
                failedCount: failed.length,
                failed,
            }, { status: 400 });
        }

        // 3. Batch DB Transaction Execution with Auto-NIP Generation
        const connection = await pool.getConnection();
        const credentials: {
            name: string;
            email: string;
            password: string;
            nip: string;
            institution: string | null;
            batch: number;
            registrationDate: string;
        }[] = [];

        try {
            await connection.beginTransaction();

            // Auto-generate all NIPs atomically per (institution, batch, yearMonth)
            const { nips, institutionCodes } = await generateBulkNips(connection, readyToInsert);

            for (let idx = 0; idx < readyToInsert.length; idx++) {
                const participant = readyToInsert[idx];
                const rawPassword = generateRandomPassword();
                const passwordHash = await bcrypt.hash(rawPassword, 10);
                const userId = uuidv4();
                const profileId = uuidv4();
                const nip = nips[idx];
                const institutionCode = institutionCodes[idx];
                const batchNum = Number(participant.batch) || 1;
                const regDate = participant.registration_date || todayStr;

                await connection.execute(
                    `INSERT INTO users (id, username, password_hash, full_name, role) VALUES (?, ?, ?, ?, ?)`,
                    [userId, participant.email, passwordHash, participant.name, 'trainee']
                );

                await connection.execute(
                    `INSERT INTO participant_profiles (id, user_id, nip, phone_number, address, date_of_birth, gender, institution, institution_code, batch, registration_date) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        profileId,
                        userId,
                        nip,
                        participant.phone_number || null,
                        participant.address || null,
                        participant.date_of_birth || null,
                        participant.gender || null,
                        participant.institution || null,
                        institutionCode || null,
                        batchNum,
                        regDate,
                    ]
                );

                credentials.push({
                    name: participant.name,
                    email: participant.email,
                    password: rawPassword,
                    nip: nip,
                    institution: participant.institution || null,
                    batch: batchNum,
                    registrationDate: regDate,
                });
            }

            await connection.commit();
        } catch (dbError) {
            await connection.rollback();
            logger.error('BULK_IMPORT_PARTICIPANTS', 'Transaksi import massal peserta gagal', dbError, authUser.id);
            throw dbError;
        } finally {
            connection.release();
        }

        // 4. Audit Log
        await logActivity(authUser.id, 'BULK_IMPORT_PARTICIPANTS', 'users', 'batch', {
            importedCount: credentials.length,
            failedCount: failed.length,
        });

        // 5. Send Emails if requested
        if (sendEmail) {
            // Trigger emails asynchronously without blocking response
            Promise.allSettled(
                credentials.map(c => sendCredentialEmail(c.email, c.name, c.password))
            ).catch(err => logger.error('BULK_IMPORT_PARTICIPANTS', 'Gagal mengirim email kredensial peserta secara asinkron', err, authUser.id));
        }

        return NextResponse.json({
            success: true,
            message: `Berhasil mengimport ${credentials.length} peserta`,
            importedCount: credentials.length,
            failedCount: failed.length,
            credentials,
            failed,
        }, { status: 201 });

    } catch (error: any) {
        logger.error('BULK_IMPORT_PARTICIPANTS', 'Kesalahan sistem saat import massal peserta', error, authUser.id);
        return NextResponse.json(
            { success: false, error: error.message || 'Terjadi kesalahan sistem saat import peserta' },
            { status: 500 }
        );
    }
}

export const POST = withAuth(handlePost, { allowedRoles: ['admin'] });
