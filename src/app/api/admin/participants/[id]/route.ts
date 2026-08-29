import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import { z } from 'zod';
import { withAuth, AuthenticatedUser } from '@/lib/api-auth';
import { logActivity } from '@/lib/audit';
import pool from '@/lib/db';

import { extractInstitutionCode, formatNip, formatYearMonth, generateSingleNip } from '@/lib/nip';

const participantUpdateSchema = z.object({
    name: z.string().min(3, 'Nama lengkap minimal 3 karakter').max(100),
    email: z.string().email('Format email tidak valid'),
    nip: z.string().optional().nullable(),
    regenerate_nip: z.boolean().optional().default(false),
    phone_number: z.string().optional().nullable(),
    address: z.string().optional().nullable(),
    date_of_birth: z.string().optional().nullable(),
    gender: z.enum(['L', 'P'], { message: 'Jenis kelamin wajib diisi' }),
    institution: z.string().optional().nullable(),
    batch: z.preprocess((val) => (val === '' || val == null ? null : String(val).trim()), z.string().max(50).optional().nullable()),
    registration_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal pendaftaran harus YYYY-MM-DD').optional().nullable(),
});

async function handleGet(
    request: NextRequest,
    _user: any,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const resolvedParams = await context.params;
        const participants = await executeQuery(
            `SELECT 
        u.id, u.username as email, u.full_name as name, u.created_at,
        p.nip, p.phone_number, p.address, 
        DATE_FORMAT(p.date_of_birth, '%Y-%m-%d') as date_of_birth, 
        p.gender, p.institution, p.institution_code, p.batch,
        DATE_FORMAT(COALESCE(p.registration_date, p.created_at), '%Y-%m-%d') as registration_date
      FROM users u
      LEFT JOIN participant_profiles p ON u.id = p.user_id
      WHERE u.id = ? AND u.role = 'trainee'`,
            [resolvedParams.id]
        );

        const data = Array.isArray(participants) ? participants[0] : null;

        if (!data) {
            return NextResponse.json({ success: false, error: 'Peserta tidak ditemukan' }, { status: 404 });
        }

        return NextResponse.json({ success: true, data });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Internal Server Error';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

async function handlePut(
    request: NextRequest,
    authUser: AuthenticatedUser,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const resolvedParams = await context.params;
        const body = await request.json();
        const parsed = participantUpdateSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { success: false, error: 'Validasi gagal', details: parsed.error.flatten().fieldErrors },
                { status: 400 }
            );
        }

        const { name, email, nip, regenerate_nip, phone_number, address, date_of_birth, gender, institution, batch, registration_date } = parsed.data;

        const existing = await executeQuery<{ id: string }[]>(
            `SELECT id FROM users WHERE username = ? AND id != ?`,
            [email, resolvedParams.id]
        );

        if (Array.isArray(existing) && existing.length > 0) {
            return NextResponse.json(
                { success: false, error: 'Email sudah digunakan oleh peserta lain' },
                { status: 400 }
            );
        }

        const connection = await pool.getConnection();
        let finalNip: string | null = null;
        let finalInstCode: string | null = null;

        try {
            await connection.beginTransaction();

            // Fetch current profile to check NIP
            const [currentProfiles] = await connection.execute<any[]>(
                `SELECT nip, institution_code, batch, registration_date FROM participant_profiles WHERE user_id = ?`,
                [resolvedParams.id]
            );
            const current = currentProfiles[0] || {};

            const safeBatch = (batch || current.batch || '1').trim().toUpperCase();
            const instCode = extractInstitutionCode(institution);
            finalInstCode = instCode;

            if (regenerate_nip) {
                // Calculate new NIP preserving sequence if available
                let seq = 1;
                if (current.nip && typeof current.nip === 'string') {
                    const parts = current.nip.split('-');
                    const lastNum = parseInt(parts[parts.length - 1], 10);
                    if (!isNaN(lastNum) && lastNum > 0) {
                        seq = lastNum;
                    }
                }
                const ym = formatYearMonth(registration_date || current.registration_date);
                finalNip = formatNip(instCode, safeBatch, ym, seq);
            } else if (nip && nip.trim()) {
                finalNip = nip.trim().toUpperCase();
                // Check uniqueness
                const [dupNip] = await connection.execute<any[]>(
                    `SELECT user_id FROM participant_profiles WHERE nip = ? AND user_id != ?`,
                    [finalNip, resolvedParams.id]
                );
                if (dupNip.length > 0) {
                    await connection.rollback();
                    return NextResponse.json({ success: false, error: 'NIP sudah digunakan oleh peserta lain' }, { status: 400 });
                }
            } else {
                finalNip = current.nip || null;
            }

            await connection.execute(
                `UPDATE users SET username = ?, full_name = ? WHERE id = ? AND role = 'trainee'`,
                [email, name, resolvedParams.id]
            );

            // Upsert profile pattern
            const [updatedProfile] = await connection.execute<import('mysql2').ResultSetHeader>(
                `UPDATE participant_profiles SET 
                 phone_number = ?, address = ?, date_of_birth = ?, gender = ?, institution = ?,
                 institution_code = COALESCE(?, institution_code),
                 batch = COALESCE(?, batch),
                 nip = COALESCE(?, nip),
                 registration_date = COALESCE(?, registration_date)
                 WHERE user_id = ?`,
                [
                    phone_number || null,
                    address || null,
                    date_of_birth || null,
                    gender || 'L',
                    institution || null,
                    finalInstCode || null,
                    safeBatch || null,
                    finalNip || null,
                    registration_date || null,
                    resolvedParams.id,
                ]
            );

            if (updatedProfile && updatedProfile.affectedRows === 0) {
                const { v4: uuidv4 } = await import('uuid');
                await connection.execute(
                    `INSERT INTO participant_profiles (id, user_id, nip, phone_number, address, date_of_birth, gender, institution, institution_code, batch, registration_date) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        uuidv4(),
                        resolvedParams.id,
                        finalNip || null,
                        phone_number || null,
                        address || null,
                        date_of_birth || null,
                        gender || 'L',
                        institution || null,
                        finalInstCode || null,
                        safeBatch || '1',
                        registration_date || new Date().toISOString().slice(0, 10),
                    ]
                );
            }

            await connection.commit();
        } catch (dbError) {
            await connection.rollback();
            throw dbError;
        } finally {
            connection.release();
        }

        // Emit Audit Trail
        await logActivity(authUser.id, 'UPDATE_USER', 'users', resolvedParams.id, {
            email: email,
            name: name,
            nip: finalNip,
            batch: batch,
        });

        return NextResponse.json({ 
            success: true, 
            message: 'Data peserta berhasil diperbarui',
            nip: finalNip
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Internal Server Error';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

async function handleDelete(
    request: NextRequest,
    authUser: AuthenticatedUser,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const resolvedParams = await context.params;

        const result = await executeQuery<{ affectedRows: number }>(
            `DELETE FROM users WHERE id = ? AND role = 'trainee'`,
            [resolvedParams.id]
        );

        if (result && 'affectedRows' in result && result.affectedRows === 0) {
            return NextResponse.json({ success: false, error: 'Peserta tidak ditemukan' }, { status: 404 });
        }

        // participant_profiles deletes automatically via CASCADE FK

        // Emit Audit Trail
        await logActivity(authUser.id, 'DELETE_USER', 'users', resolvedParams.id);

        return NextResponse.json({ success: true, message: 'Peserta berhasil dihapus' });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Internal Server Error';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

export const GET = withAuth(handleGet, { allowedRoles: ['admin'] });
export const PUT = withAuth(handlePut, { allowedRoles: ['admin'] });
export const DELETE = withAuth(handleDelete, { allowedRoles: ['admin'] });
