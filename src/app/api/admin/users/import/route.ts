import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthenticatedUser } from '@/lib/api-auth';
import { v4 as uuidv4 } from 'uuid';
import pool from '@/lib/db';
import bcrypt from 'bcryptjs';
import * as xlsx from 'xlsx';
import { logActivity } from '@/lib/audit';

async function handlePost(request: NextRequest, user: AuthenticatedUser) {
    let connection;
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json({ success: false, error: 'File Excel tidak ditemukan' }, { status: 400 });
        }

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const workbook = xlsx.read(buffer, { type: 'buffer' });

        if (workbook.SheetNames.length === 0) {
            return NextResponse.json({ success: false, error: 'File Excel kosong' }, { status: 400 });
        }

        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Asumsi kolom: A=Username(Email/NIK), B=Full Name, C=Password, D=Gender(L/P)
        const rows: any[] = xlsx.utils.sheet_to_json(worksheet, { header: ['username', 'full_name', 'password', 'gender'] });
        
        // Remove Header Row (First Row)
        rows.shift();

        if (rows.length === 0) {
            return NextResponse.json({ success: false, error: 'Tidak ada data user di dalam file Excel' }, { status: 400 });
        }

        connection = await pool.getConnection();
        await connection.beginTransaction();

        let insertedCount = 0;
        const salt = await bcrypt.genSalt(10);

        for (const row of rows) {
            const { username, full_name, password, gender } = row;

            if (!username || !full_name || !password) continue;

            const hashedPassword = await bcrypt.hash(password.toString(), salt);
            const userId = uuidv4();
            const profileId = uuidv4();
            
            // Normalkan Gender
            let normalizedGender = null;
            if (gender) {
                const g = String(gender).toUpperCase();
                normalizedGender = g === 'L' || g === 'M' || g === 'LAKI-LAKI' ? 'L' : 'P';
            }

            // Insert User
            await connection.execute(
                `INSERT INTO users (id, role, full_name, username, password_hash)
                 VALUES (?, 'trainee', ?, ?, ?)`,
                [userId, full_name, username, hashedPassword]
            );

            // Insert Profile Profile
            await connection.execute(
                `INSERT INTO participant_profiles (id, user_id, gender) VALUES (?, ?, ?)`,
                [profileId, userId, normalizedGender]
            );

            insertedCount++;
        }

        await connection.commit();
        
        // Log activity
        await logActivity(user.id, 'BULK_IMPORT_USERS', 'users', null, { count: insertedCount });

        return NextResponse.json({ success: true, message: `${insertedCount} peserta berhasil di-import` });
    } catch (error: any) {
        if (connection) await connection.rollback();
        console.error('Bulk Import Error:', error);

        // Menangkap error unique constraint (Duplicate username)
        if (error.code === 'ER_DUP_ENTRY') {
            return NextResponse.json({ success: false, error: 'Gagal mengimpor: Ada username atau email yang duplikat dengan database.' }, { status: 400 });
        }

        return NextResponse.json({ success: false, error: 'Terjadi kesalahan sistem saat memproses file.' }, { status: 500 });
    } finally {
        if (connection) connection.release();
    }
}

export const POST = withAuth(handlePost, { allowedRoles: ['admin', 'trainer'] });
