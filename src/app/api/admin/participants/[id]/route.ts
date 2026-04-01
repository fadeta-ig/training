import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import { z } from 'zod';
import { withAuth } from '@/lib/api-auth';
import pool from '@/lib/db';

const participantUpdateSchema = z.object({
    name: z.string().min(3, 'Nama lengkap minimal 3 karakter').max(100),
    email: z.string().email('Format email tidak valid'),
    phone_number: z.string().optional().nullable(),
    address: z.string().optional().nullable(),
    date_of_birth: z.string().optional().nullable(),
    gender: z.enum(['L', 'P']).optional().nullable(),
    institution: z.string().optional().nullable(),
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
        p.phone_number, p.address, DATE_FORMAT(p.date_of_birth, '%Y-%m-%d') as date_of_birth, p.gender, p.institution
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
    _user: any,
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

        const { name, email, phone_number, address, date_of_birth, gender, institution } = parsed.data;

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
        try {
            await connection.beginTransaction();

            await connection.execute(
                `UPDATE users SET username = ?, full_name = ? WHERE id = ? AND role = 'trainee'`,
                [email, name, resolvedParams.id]
            );

            // Upsert profile pattern since profile might not exist for old trainees
            const [updatedProfile] = await connection.execute<import('mysql2').ResultSetHeader>(
                `UPDATE participant_profiles SET 
         phone_number = ?, address = ?, date_of_birth = ?, gender = ?, institution = ?
         WHERE user_id = ?`,
                [phone_number || null, address || null, date_of_birth || null, gender || null, institution || null, resolvedParams.id]
            );

            if (updatedProfile && updatedProfile.affectedRows === 0) {
                // Create profile if it doesn't exist yet
                const { v4: uuidv4 } = await import('uuid');
                await connection.execute(
                    `INSERT INTO participant_profiles (id, user_id, phone_number, address, date_of_birth, gender, institution) 
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [uuidv4(), resolvedParams.id, phone_number || null, address || null, date_of_birth || null, gender || null, institution || null]
                );
            }

            await connection.commit();
        } catch (dbError) {
            await connection.rollback();
            throw dbError;
        } finally {
            connection.release();
        }

        return NextResponse.json({ success: true, message: 'Data peserta berhasil diperbarui' });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Internal Server Error';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

async function handleDelete(
    request: NextRequest,
    _user: any,
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

        return NextResponse.json({ success: true, message: 'Peserta berhasil dihapus' });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Internal Server Error';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

export const GET = withAuth(handleGet, { allowedRoles: ['admin'] });
export const PUT = withAuth(handlePut, { allowedRoles: ['admin'] });
export const DELETE = withAuth(handleDelete, { allowedRoles: ['admin'] });
