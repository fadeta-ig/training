import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { executeQuery } from '@/lib/db';
import { withAuth, AuthenticatedUser } from '@/lib/api-auth';
import { logActivity } from '@/lib/audit';
import pool from '@/lib/db';
import logger from '@/lib/logger';
import { generateBulkNips } from '@/lib/nip';
import { ensureParticipantSecurityColumns, generateSecurePassword } from '@/lib/participant-helpers';
import { hashPasswordsBounded } from '@/lib/password-batch';
import { enqueueCredentialEmail } from '@/lib/email-outbox';

interface ImportItem {
    name: string;
    id_card_number?: string | null;
    email: string;
    phone_number?: string | null;
    institution?: string | null;
    batch?: string | null;
    registration_date?: string | null;
    date_of_birth?: string | null;
    gender?: 'L' | 'P' | string | null;
    address?: string | null;
    target_certification_name?: string | null;
}

/**
 * Normalizes gender input from various formats to 'L' or 'P'.
 * Supports: L, P, Laki-laki, Perempuan, Pria, Wanita, Male, Female, M, F
 */
function normalizeGender(raw: string | null | undefined): 'L' | 'P' | null {
    if (!raw) return null;
    const cleaned = raw.trim().toUpperCase();
    const MALE_VARIANTS = ['L', 'LAKI-LAKI', 'LAKI', 'PRIA', 'MALE', 'M'];
    const FEMALE_VARIANTS = ['P', 'PEREMPUAN', 'WANITA', 'FEMALE', 'F'];
    if (MALE_VARIANTS.includes(cleaned)) return 'L';
    if (FEMALE_VARIANTS.includes(cleaned)) return 'P';
    return null;
}


const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidIsoDate(value: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00.000Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

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
            if (!item || typeof item !== 'object') {
                failed.push({ name: `Baris ${i + 1}`, email: '-', reason: 'Struktur data peserta tidak valid' });
                continue;
            }
            const cleanName = String(item.name || '').trim();
            const cleanEmail = String(item.email || '').trim().toLowerCase();

            if (!cleanName || cleanName.length < 3) {
                failed.push({ name: item.name || `Baris ${i + 1}`, email: cleanEmail || '-', reason: 'Nama lengkap minimal 3 karakter' });
                continue;
            }
            if (cleanName.length > 100) {
                failed.push({ name: cleanName.slice(0, 100), email: cleanEmail || '-', reason: 'Nama lengkap maksimal 100 karakter' });
                continue;
            }

            if (!cleanEmail || cleanEmail.length > 255 || !EMAIL_REGEX.test(cleanEmail)) {
                failed.push({ name: cleanName, email: cleanEmail || '-', reason: 'Format email tidak valid' });
                continue;
            }

            if (seenEmails.has(cleanEmail)) {
                failed.push({ name: cleanName, email: cleanEmail, reason: 'Duplikasi email di dalam file import' });
                continue;
            }

            let parsedBatch = '1';
            if (item.batch !== undefined && item.batch !== null && String(item.batch).trim() !== '') {
                parsedBatch = String(item.batch).trim();
            }
            if (parsedBatch.length > 50) {
                failed.push({ name: cleanName, email: cleanEmail, reason: 'Batch maksimal 50 karakter' });
                continue;
            }

            let regDate = todayStr;
            if (item.registration_date) {
                const suppliedRegistrationDate = String(item.registration_date).trim();
                if (!isValidIsoDate(suppliedRegistrationDate)) {
                    failed.push({ name: cleanName, email: cleanEmail, reason: 'Tanggal pendaftaran tidak valid' });
                    continue;
                }
                regDate = suppliedRegistrationDate;
            }
            const birthDate = item.date_of_birth ? String(item.date_of_birth).trim() : null;
            if (birthDate && !isValidIsoDate(birthDate)) {
                failed.push({ name: cleanName, email: cleanEmail, reason: 'Tanggal lahir tidak valid' });
                continue;
            }

            // Normalize gender input if provided — OPTIONAL (can be completed by participant on profile)
            const normalizedGender = item.gender ? normalizeGender(String(item.gender)) : null;
            const phoneNumber = item.phone_number ? String(item.phone_number).trim() : null;
            const institution = item.institution ? String(item.institution).trim() : null;
            const idCardNumber = item.id_card_number ? String(item.id_card_number).trim() : null;
            const targetCertification = item.target_certification_name ? String(item.target_certification_name).trim() : null;
            if ((phoneNumber?.length || 0) > 20
                || (institution?.length || 0) > 150
                || (idCardNumber?.length || 0) > 50
                || (targetCertification?.length || 0) > 255) {
                failed.push({ name: cleanName, email: cleanEmail, reason: 'Salah satu data profil melebihi batas karakter' });
                continue;
            }

            seenEmails.add(cleanEmail);
            validQueue.push({
                ...item,
                name: cleanName,
                email: cleanEmail,
                id_card_number: idCardNumber,
                phone_number: phoneNumber,
                institution,
                batch: parsedBatch,
                registration_date: regDate,
                date_of_birth: birthDate,
                gender: normalizedGender,
                address: item.address ? String(item.address).trim() : null,
                target_certification_name: targetCertification,
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

        const readyToInsert: Array<ImportItem & { batch: string }> = [];
        for (const item of validQueue) {
            if (existingSet.has(item.email)) {
                failed.push({ name: item.name, email: item.email, reason: 'Email sudah terdaftar di sistem' });
            } else {
                readyToInsert.push({
                    ...item,
                    batch: String(item.batch || '1'),
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
        await ensureParticipantSecurityColumns();
        const preparedAccounts = readyToInsert.map((participant) => ({
            participant,
            rawPassword: generateSecurePassword(12),
            userId: uuidv4(),
            profileId: uuidv4(),
        }));
        const passwordHashes = await hashPasswordsBounded(preparedAccounts.map((account) => account.rawPassword));
        const connection = await pool.getConnection();
        const credentials: {
            name: string;
            email: string;
            password: string;
            nip: string;
            institution: string | null;
            batch: string;
            registrationDate: string;
        }[] = [];

        try {
            await connection.beginTransaction();

            // Auto-generate all NIPs atomically per (institution, batch, yearMonth)
            const { nips, institutionCodes } = await generateBulkNips(connection, readyToInsert);

            for (let idx = 0; idx < preparedAccounts.length; idx++) {
                const { participant, rawPassword, userId, profileId } = preparedAccounts[idx];
                const passwordHash = passwordHashes[idx];
                const nip = nips[idx];
                const institutionCode = institutionCodes[idx];
                const batchVal = String(participant.batch) || '1';
                const regDate = participant.registration_date || todayStr;

                await connection.execute(
                    `INSERT INTO users (id, username, password_hash, full_name, role) VALUES (?, ?, ?, ?, ?)`,
                    [userId, participant.email, passwordHash, participant.name, 'trainee']
                );

                if (sendEmail) await enqueueCredentialEmail(connection, userId);

                await connection.execute(
                    `INSERT INTO participant_profiles (id, user_id, nip, id_card_number, phone_number, address, date_of_birth, gender, institution, institution_code, batch, registration_date, initial_password, must_change_password) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        profileId,
                        userId,
                        nip,
                        participant.id_card_number?.trim() || null,
                        participant.phone_number || null,
                        participant.address || null,
                        participant.date_of_birth || null,
                        participant.gender || null,
                        participant.institution || null,
                        institutionCode || null,
                        batchVal,
                        regDate,
                        rawPassword,
                        1,
                    ]
                );

                credentials.push({
                    name: participant.name,
                    email: participant.email,
                    password: rawPassword,
                    nip: nip,
                    institution: participant.institution || null,
                    batch: batchVal,
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

        return NextResponse.json({
            success: true,
            message: `Berhasil mengimport ${credentials.length} peserta`,
            importedCount: credentials.length,
            failedCount: failed.length,
            credentials,
            emailQueued: sendEmail ? credentials.length : 0,
            failed,
        }, { status: 201 });

    } catch (error: unknown) {
        logger.error('BULK_IMPORT_PARTICIPANTS', 'Kesalahan sistem saat import massal peserta', error, authUser.id);
        return NextResponse.json(
            { success: false, error: 'Terjadi kesalahan sistem saat import peserta' },
            { status: 500 }
        );
    }
}

export const POST = withAuth(handlePost, { allowedRoles: ['admin'] });
