import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import { withAuth } from '@/lib/api-auth';
import { AuditLog } from '@/types';

// Pagination limit
const LIMIT = 20;

async function handleGet(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const page = parseInt(searchParams.get('page') || '1', 10);
        const search = searchParams.get('search') || '';
        const offset = (page - 1) * LIMIT;

        // Where conditions
        let whereClause = `1=1`;
        let countParams: any[] = [];
        let queryParams: any[] = [LIMIT, offset];

        if (search) {
            whereClause = `(u.full_name LIKE ? OR al.action_type LIKE ? OR al.entity LIKE ?)`;
            const searchParam = `%${search}%`;
            countParams = [searchParam, searchParam, searchParam];
            queryParams.unshift(searchParam, searchParam, searchParam);
        }

        const countQuerySql = `
            SELECT COUNT(*) as total 
            FROM audit_logs al
            LEFT JOIN users u ON al.user_id = u.id
            WHERE ${whereClause}
        `;
        const countResult = await executeQuery<{ total: number }[]>(countQuerySql, countParams);
        const total = countResult[0]?.total || 0;
        const totalPages = Math.ceil(total / LIMIT);

        const logsQuerySql = `
            SELECT 
                al.*, 
                u.full_name, 
                u.username 
            FROM audit_logs al
            LEFT JOIN users u ON al.user_id = u.id
            WHERE ${whereClause}
            ORDER BY al.created_at DESC
            LIMIT ? OFFSET ?
        `;
        const logs = await executeQuery<AuditLog[]>(logsQuerySql, queryParams);

        // Parsing JSON back stringified details
        const processedLogs = logs.map(log => ({
            ...log,
            details: typeof log.details === 'string' ? JSON.parse(log.details) : log.details
        }));

        return NextResponse.json({
            success: true,
            data: processedLogs,
            pagination: { page, limit: LIMIT, total, totalPages }
        });

    } catch (error) {
        console.error('Audit Trail Get Error:', error);
        return NextResponse.json({ success: false, error: 'Gagal mengambil data audit trail.' }, { status: 500 });
    }
}

// Hanya dapat diakses administrator (Superadmin)
export const GET = withAuth(handleGet, { allowedRoles: ['admin'] });
