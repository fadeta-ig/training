import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { executeQuery } from '@/lib/db';

export async function GET(request: NextRequest) {
    try {
        const token = request.cookies.get('training_session')?.value;
        if (!token) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const payload = await verifyToken(token);
        if (!payload || !payload.sub) {
            return NextResponse.json({ success: false, error: 'Invalid Token' }, { status: 401 });
        }

        const users = await executeQuery<any[]>(
            `SELECT id, username, full_name, role, created_at FROM users WHERE id = ?`,
            [payload.sub]
        );

        if (!Array.isArray(users) || users.length === 0) {
            return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true, data: users[0] });
    } catch (error) {
        return NextResponse.json({ success: false, error: 'Server Error' }, { status: 500 });
    }
}
