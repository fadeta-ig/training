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

        let users: any[];
        try {
            users = await executeQuery<any[]>(
                `SELECT 
                    u.id, u.username, u.full_name, u.role, u.created_at,
                    p.nip, p.gender, p.phone_number, p.address,
                    DATE_FORMAT(p.date_of_birth, '%Y-%m-%d') as date_of_birth,
                    p.institution, p.institution_code, p.batch,
                    COALESCE(p.must_change_password, 0) as must_change_password,
                    DATE_FORMAT(COALESCE(p.registration_date, p.created_at), '%Y-%m-%d') as registration_date
                 FROM users u
                 LEFT JOIN participant_profiles p ON u.id = p.user_id
                 WHERE u.id = ?`,
                [payload.sub]
            );
        } catch (dbErr: any) {
            // Graceful fallback if must_change_password column has not been migrated yet
            if (dbErr?.code === 'ER_BAD_FIELD_ERROR' || String(dbErr?.message || dbErr).includes('must_change_password')) {
                users = await executeQuery<any[]>(
                    `SELECT 
                        u.id, u.username, u.full_name, u.role, u.created_at,
                        p.nip, p.gender, p.phone_number, p.address,
                        DATE_FORMAT(p.date_of_birth, '%Y-%m-%d') as date_of_birth,
                        p.institution, p.institution_code, p.batch,
                        0 as must_change_password,
                        DATE_FORMAT(COALESCE(p.registration_date, p.created_at), '%Y-%m-%d') as registration_date
                     FROM users u
                     LEFT JOIN participant_profiles p ON u.id = p.user_id
                     WHERE u.id = ?`,
                    [payload.sub]
                );
            } else {
                throw dbErr;
            }
        }

        if (!Array.isArray(users) || users.length === 0) {
            return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true, data: users[0] });
    } catch {
        return NextResponse.json({ success: false, error: 'Server Error' }, { status: 500 });
    }
}
