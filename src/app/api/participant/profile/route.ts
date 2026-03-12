import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import { withAuth, AuthenticatedUser } from '@/lib/api-auth';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';

/**
 * GET /api/participant/profile
 * Get user profile details
 */
async function handleGet(request: NextRequest, user: AuthenticatedUser) {
    try {
        const query = `
            SELECT 
                u.id, u.full_name, u.username, u.role, u.created_at,
                p.phone_number, p.address, p.date_of_birth, p.gender, p.institution
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

/**
 * PUT /api/participant/profile
 * Update user profile details and handle password change if provided
 */
async function handlePut(request: NextRequest, user: AuthenticatedUser) {
    try {
        const body = await request.json();
        const { full_name, phone_number, address, date_of_birth, gender, institution, current_password, new_password } = body;

        // 1. Update User Table (full_name) and handle Password Change
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

            const hashedNewPassword = await bcrypt.hash(new_password, 10);
            await executeQuery(
                `UPDATE users SET full_name = ?, password_hash = ? WHERE id = ?`,
                [full_name, hashedNewPassword, user.id]
            );
        } else {
            // Update without password change
            await executeQuery(
                `UPDATE users SET full_name = ? WHERE id = ?`,
                [full_name, user.id]
            );
        }

        // 2. Upsert Participant Profile Info
        const profile = await executeQuery<any[]>(`SELECT id FROM participant_profiles WHERE user_id = ?`, [user.id]);

        // Handle potentially empty dates correctly or nulls
        const dobVal = date_of_birth ? date_of_birth : null;

        if (profile && profile.length > 0) {
            await executeQuery(
                `UPDATE participant_profiles 
                 SET phone_number = ?, address = ?, date_of_birth = ?, gender = ?, institution = ? 
                 WHERE user_id = ?`,
                [phone_number || null, address || null, dobVal, gender || null, institution || null, user.id]
            );
        } else {
            await executeQuery(
                `INSERT INTO participant_profiles (id, user_id, phone_number, address, date_of_birth, gender, institution)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [uuidv4(), user.id, phone_number || null, address || null, dobVal, gender || null, institution || null]
            );
        }

        return NextResponse.json({ success: true, message: 'Profil berhasil diperbarui' });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Kesalahan server saat memperbarui profil';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

export const GET = withAuth(handleGet);
export const PUT = withAuth(handlePut);
