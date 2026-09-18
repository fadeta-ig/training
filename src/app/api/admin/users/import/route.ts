import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { executeQuery } from '@/lib/db';
import { withAuth, AuthenticatedUser } from '@/lib/api-auth';
import { logActivity } from '@/lib/audit';
import pool from '@/lib/db';
import logger from '@/lib/logger';
import { generateSecurePassword, ensureParticipantSecurityColumns } from '@/lib/participant-helpers';
import { hashPasswordsBounded } from '@/lib/password-batch';
import { enqueueCredentialEmail } from '@/lib/email-outbox';

interface UserImportItem {
    name: string;
    email: string;
    role?: 'admin' | 'trainer' | 'trainee';
    password?: string | null;
    phone_number?: string | null;
    institution?: string | null;
}



const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function handlePost(request: NextRequest, authUser: AuthenticatedUser) {
    try {
        const body = await request.json();
        const { users: userItems, sendEmail } = body as { users: UserImportItem[]; sendEmail?: boolean };

        if (!Array.isArray(userItems) || userItems.length === 0) {
            return NextResponse.json(
                { success: false, error: 'Data pengguna tidak boleh kosong' },
                { status: 400 }
            );
        }

        if (userItems.length > 500) {
            return NextResponse.json(
                { success: false, error: 'Maksimal 500 pengguna dalam sekali import' },
                { status: 400 }
            );
        }

        // 1. Structural & Format Validation (Pre-flight)
        const failed: { name: string; email: string; reason: string }[] = [];
        const validQueue: UserImportItem[] = [];
        const seenEmails = new Set<string>();

        for (let i = 0; i < userItems.length; i++) {
            const item = userItems[i];
            if (!item || typeof item !== 'object') {
                failed.push({ name: `Baris ${i + 1}`, email: '-', reason: 'Struktur data pengguna tidak valid' });
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
                failed.push({ name: cleanName, email: cleanEmail || '-', reason: 'Format email (username) tidak valid' });
                continue;
            }

            if (seenEmails.has(cleanEmail)) {
                failed.push({ name: cleanName, email: cleanEmail, reason: 'Duplikasi email di dalam file import' });
                continue;
            }

            const rawRole = String(item.role || 'trainer').toLowerCase();
            const role: 'admin' | 'trainer' = (rawRole.includes('admin') || rawRole === 'administrator') ? 'admin' : 'trainer';

            const suppliedPassword = item.password ? String(item.password).trim() : null;
            if (suppliedPassword && suppliedPassword.length > 128) {
                failed.push({ name: cleanName, email: cleanEmail, reason: 'Password maksimal 128 karakter' });
                continue;
            }
            const phoneNumber = item.phone_number ? String(item.phone_number).trim() : null;
            const institution = item.institution ? String(item.institution).trim() : null;
            if ((phoneNumber?.length || 0) > 20 || (institution?.length || 0) > 150) {
                failed.push({ name: cleanName, email: cleanEmail, reason: 'Nomor telepon atau instansi melebihi batas karakter' });
                continue;
            }
            seenEmails.add(cleanEmail);
            validQueue.push({
                ...item,
                name: cleanName,
                email: cleanEmail,
                role,
                password: suppliedPassword,
                phone_number: phoneNumber,
                institution,
            });
        }

        if (validQueue.length === 0) {
            return NextResponse.json({
                success: false,
                error: 'Tidak ada data pengguna yang valid untuk diimport',
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

        const readyToInsert: UserImportItem[] = [];
        for (const item of validQueue) {
            if (existingSet.has(item.email)) {
                failed.push({ name: item.name, email: item.email, reason: 'Username/Email sudah terdaftar di sistem' });
            } else {
                readyToInsert.push(item);
            }
        }

        if (readyToInsert.length === 0) {
            return NextResponse.json({
                success: false,
                error: 'Semua email pengguna sudah terdaftar di database',
                importedCount: 0,
                failedCount: failed.length,
                failed,
            }, { status: 400 });
        }

        // 3. Batch DB Transaction Execution
        const preparedAccounts = readyToInsert.map((item) => ({
            item,
            finalPassword: item.password && item.password.length >= 8 ? item.password : generateSecurePassword(12),
            userId: uuidv4(),
            profileId: uuidv4(),
        }));
        const passwordHashes = await hashPasswordsBounded(preparedAccounts.map((account) => account.finalPassword));
        await ensureParticipantSecurityColumns();
        const connection = await pool.getConnection();
        const credentials: { name: string; email: string; password: string; role: string }[] = [];

        try {
            await connection.beginTransaction();

            for (let index = 0; index < preparedAccounts.length; index += 1) {
                const { item, finalPassword, userId, profileId } = preparedAccounts[index];
                const passwordHash = passwordHashes[index];
                const userRole = item.role || 'trainer';

                await connection.execute(
                    `INSERT INTO users (id, username, password_hash, full_name, role) VALUES (?, ?, ?, ?, ?)`,
                    [userId, item.email, passwordHash, item.name, userRole]
                );

                if (sendEmail) await enqueueCredentialEmail(connection, userId);

                await connection.execute(
                    `INSERT INTO participant_profiles (id, user_id, phone_number, institution, initial_password, must_change_password) 
                     VALUES (?, ?, ?, ?, ?, 1)`,
                    [
                        profileId,
                        userId,
                        item.phone_number || null,
                        item.institution || null,
                        finalPassword,
                    ]
                );

                credentials.push({
                    name: item.name,
                    email: item.email,
                    password: finalPassword,
                    role: userRole === 'admin' ? 'Administrator' : 'Pelatih / Trainer',
                });
            }

            await connection.commit();
        } catch (dbError) {
            await connection.rollback();
            logger.error('BULK_IMPORT_USERS', 'Transaksi import massal pengguna gagal', dbError, authUser.id);
            throw dbError;
        } finally {
            connection.release();
        }

        // 4. Audit Log
        await logActivity(authUser.id, 'BULK_IMPORT_USERS', 'users', 'batch', {
            importedCount: credentials.length,
            failedCount: failed.length,
        });

        return NextResponse.json({
            success: true,
            message: `Berhasil mengimport ${credentials.length} pengguna`,
            importedCount: credentials.length,
            failedCount: failed.length,
            credentials,
            emailQueued: sendEmail ? credentials.length : 0,
            failed,
        }, { status: 201 });

    } catch (error: unknown) {
        logger.error('BULK_IMPORT_USERS', 'Kesalahan sistem saat import massal pengguna', error);
        return NextResponse.json(
            { success: false, error: 'Terjadi kesalahan sistem saat import pengguna' },
            { status: 500 }
        );
    }
}

export const POST = withAuth(handlePost, { allowedRoles: ['admin'] });
