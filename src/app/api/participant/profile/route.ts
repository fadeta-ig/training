import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import { withAuth, AuthenticatedUser } from '@/lib/api-auth';
import { ensureParticipantSecurityColumns } from '@/lib/participant-helpers';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import pool from '@/lib/db';

const optionalText = (max: number) => z.union([z.string().trim().max(max), z.null()]).optional();
const dateOnlySchema = z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal lahir tidak valid')
    .refine((value) => {
        const date = new Date(`${value}T00:00:00Z`);
        return !Number.isNaN(date.getTime())
            && date.toISOString().slice(0, 10) === value
            && date.getTime() <= Date.now();
    }, 'Tanggal lahir tidak valid');
const profileUpdateSchema = z.object({
    full_name: z.string().trim().min(3).max(100),
    id_card_number: optionalText(50),
    phone_number: optionalText(30),
    address: optionalText(500),
    date_of_birth: z.union([
        z.literal(''),
        z.null(),
        dateOnlySchema,
    ]).optional(),
    gender: z.union([z.enum(['L', 'P']), z.literal(''), z.null()]).optional(),
    institution: optionalText(150),
    current_password: z.string().max(128).optional(),
    new_password: z.string().min(8).max(128).optional(),
});
/**
 * GET /api/participant/profile
 * Get user profile details
 */
async function handleGet(request: NextRequest, user: AuthenticatedUser) {
    try {
        await ensureParticipantSecurityColumns();
        const query = `
            SELECT 
                u.id, u.full_name, u.username, u.role, u.created_at,
                p.nip, p.id_card_number,
                p.phone_number, p.address, 
                DATE_FORMAT(p.date_of_birth, '%Y-%m-%d') as date_of_birth, 
                p.gender, p.institution, p.institution_code, p.batch,
                DATE_FORMAT(COALESCE(p.registration_date, p.created_at), '%Y-%m-%d') as registration_date
            FROM users u
            LEFT JOIN participant_profiles p ON u.id = p.user_id
            WHERE u.id = ?
        `;
        const users = await executeQuery<any[]>(query, [user.id]);

        if (!users || users.length === 0) {
            return NextResponse.json({ success: false, error: 'User tidak ditemukan' }, { status: 404 });
        }

        const userData = users[0];
        // Ensure no sensitive info is leaked
        delete userData.password_hash;

        return NextResponse.json({ success: true, data: userData });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Kesalahan server gagal mengambil profil';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

async function handlePut(request: NextRequest, user: AuthenticatedUser) {
    let connection;
    try {
        await ensureParticipantSecurityColumns();
        const parsed = profileUpdateSchema.safeParse(await request.json());
        if (!parsed.success) {
            return NextResponse.json(
                { success: false, error: 'Data profil tidak valid', details: parsed.error.issues },
                { status: 400 }
            );
        }

        const { full_name, id_card_number, phone_number, address, date_of_birth, gender, institution, current_password, new_password } = parsed.data;
        const cleanIdCard = id_card_number && id_card_number.trim() ? id_card_number.trim().toUpperCase() : null;

        let hashedNewPassword: string | null = null;
        let currentPasswordHash: string | null = null;
        if (new_password) {
            if (!current_password) {
                return NextResponse.json({ success: false, error: 'Password saat ini diperlukan untuk mengubah password baru' }, { status: 400 });
            }

            // Verify current password
            const userRec = await executeQuery<any[]>(`SELECT password_hash FROM users WHERE id = ?`, [user.id]);
            if (!userRec || userRec.length === 0) {
                return NextResponse.json({ success: false, error: 'User tidak ditemukan' }, { status: 404 });
            }

            const isValid = await bcrypt.compare(current_password, userRec[0].password_hash);
            if (!isValid) {
                return NextResponse.json({ success: false, error: 'Password saat ini tidak cocok' }, { status: 401 });
            }

            currentPasswordHash = userRec[0].password_hash;
            hashedNewPassword = await bcrypt.hash(new_password, 10);
        }

        connection = await pool.getConnection();
        await connection.beginTransaction();
        const [userUpdate] = hashedNewPassword
            ? await connection.execute<any>(
                `UPDATE users SET full_name = ?, password_hash = ? WHERE id = ? AND password_hash = ?`,
                [full_name, hashedNewPassword, user.id, currentPasswordHash],
            )
            : await connection.execute<any>(
                `UPDATE users SET full_name = ? WHERE id = ?`,
                [full_name, user.id],
            );
        if (userUpdate.affectedRows === 0) {
            await connection.rollback();
            connection.release();
            connection = undefined;
            return NextResponse.json({ success: false, error: 'Profil berubah pada sesi lain. Muat ulang lalu coba kembali.' }, { status: 409 });
        }

        const [profile] = await connection.execute<any[]>(
            `SELECT id FROM participant_profiles WHERE user_id = ? FOR UPDATE`,
            [user.id],
        );
        const dobVal = date_of_birth ? date_of_birth : null;

        if (profile && profile.length > 0) {
            await connection.execute(
                `UPDATE participant_profiles 
                 SET id_card_number = COALESCE(?, id_card_number),
                     phone_number = ?, address = ?, date_of_birth = ?, gender = ?, institution = ?,
                     initial_password = CASE WHEN ? IS NULL THEN initial_password ELSE ? END,
                     must_change_password = CASE WHEN ? IS NULL THEN must_change_password ELSE 0 END
                 WHERE user_id = ?`,
                [
                    cleanIdCard,
                    phone_number || null,
                    address || null,
                    dobVal,
                    gender || null,
                    institution || null,
                    new_password || null,
                    new_password || null,
                    new_password || null,
                    user.id,
                ]
            );
        } else {
            await connection.execute(
                `INSERT INTO participant_profiles
                    (id, user_id, id_card_number, phone_number, address, date_of_birth, gender, institution, initial_password, must_change_password)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    uuidv4(), user.id, cleanIdCard, phone_number || null, address || null,
                    dobVal, gender || null, institution || null, new_password || null, new_password ? 0 : 1,
                ]
            );
        }

        await connection.commit();
        connection.release();
        connection = undefined;

        return NextResponse.json({ success: true, message: 'Profil berhasil diperbarui' });
    } catch {
        if (connection) {
            await connection.rollback();
            connection.release();
        }
        return NextResponse.json({ success: false, error: 'Kesalahan server saat memperbarui profil' }, { status: 500 });
    }
}

export const GET = withAuth(handleGet, { allowedRoles: ['trainee'] });
export const PUT = withAuth(handlePut, { allowedRoles: ['trainee'] });
