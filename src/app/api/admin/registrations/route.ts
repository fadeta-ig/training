import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import { withAuth, AuthenticatedUser } from '@/lib/api-auth';

async function handleGet(request: NextRequest, _user: AuthenticatedUser) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
        const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '10', 10)));
        const offset = (page - 1) * limit;
        const status = searchParams.get('status') || 'pending';
        const search = searchParams.get('search')?.trim() || '';

        let whereClause = `WHERE u.role = 'trainee'`;
        const params: any[] = [];

        if (status !== 'all') {
            whereClause += ` AND u.approval_status = ?`;
            params.push(status);
        }

        if (search) {
            whereClause += ` AND (u.full_name LIKE ? OR u.username LIKE ? OR pp.institution LIKE ? OR pp.target_certification_name LIKE ?)`;
            const wildcard = `%${search}%`;
            params.push(wildcard, wildcard, wildcard, wildcard);
        }

        // Count pending
        const [pendingCountRow] = await executeQuery<any[]>(
            `SELECT COUNT(*) as count FROM users WHERE role = 'trainee' AND approval_status = 'pending'`
        );
        const pendingCount = pendingCountRow?.count || 0;

        // Total filtered count
        const countQuery = `
            SELECT COUNT(*) as total
            FROM users u
            LEFT JOIN participant_profiles pp ON pp.user_id = u.id
            ${whereClause}
        `;
        const [totalRow] = await executeQuery<any[]>(countQuery, params);
        const total = totalRow?.total || 0;

        // Fetch data
        const dataQuery = `
            SELECT 
                u.id,
                u.full_name,
                u.username,
                u.approval_status,
                u.rejection_reason,
                u.approved_at,
                u.created_at,
                pp.nip,
                pp.phone_number,
                pp.address,
                pp.gender,
                pp.date_of_birth,
                pp.institution,
                pp.institution_code,
                pp.batch,
                pp.target_certification_id,
                pp.target_certification_name,
                pp.target_period
            FROM users u
            LEFT JOIN participant_profiles pp ON pp.user_id = u.id
            ${whereClause}
            ORDER BY u.created_at DESC
            LIMIT ? OFFSET ?
        `;

        const dataParams = [...params, limit, offset];
        const rows = await executeQuery<any[]>(dataQuery, dataParams);

        return NextResponse.json({
            success: true,
            data: rows || [],
            pendingCount,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit) || 1,
            },
        });
    } catch (error) {
        console.error('[ADMIN_REGISTRATIONS_GET_ERROR]', error);
        return NextResponse.json(
            { success: false, error: 'Gagal memuat antrean pendaftaran peserta' },
            { status: 500 }
        );
    }
}

export const GET = withAuth(handleGet, { allowedRoles: ['admin', 'trainer'] });
