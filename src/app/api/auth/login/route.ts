import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { signToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { username, password } = body;

        if (!username || !password) {
            return NextResponse.json(
                { success: false, error: 'Username dan password wajib diisi' },
                { status: 400 }
            );
        }

        // Cari user di DB
        const users = await executeQuery<any[]>(
            `SELECT id, username, password_hash, role, full_name FROM users WHERE username = ?`,
            [username]
        );

        if (!Array.isArray(users) || users.length === 0) {
            return NextResponse.json(
                { success: false, error: 'Kredensial tidak valid' },
                { status: 401 }
            );
        }

        const user = users[0];

        // Verifikasi password
        const passwordMatch = await bcrypt.compare(password, user.password_hash);
        if (!passwordMatch) {
            return NextResponse.json(
                { success: false, error: 'Kredensial tidak valid' },
                { status: 401 }
            );
        }

        // Generate JWT token
        const token = await signToken({
            sub: user.id,
            username: user.username,
            role: user.role,
        });

        // Set token in HTTP-only cookie
        const response = NextResponse.json({
            success: true,
            user: {
                id: user.id,
                username: user.username,
                full_name: user.full_name,
                role: user.role,
            }
        });

        response.cookies.set('training_session', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60 * 24, // 1 day in seconds
            path: '/',
        });

        return response;

    } catch (error) {
        console.error('Login error:', error);
        return NextResponse.json(
            { success: false, error: 'Terjadi kesalahan sistem' },
            { status: 500 }
        );
    }
}
