import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import { withAuth, AuthenticatedUser } from '@/lib/api-auth';
import { generateParticipantsDetailExportXlsx, ParticipantDetailExportRow } from '@/lib/excel';
import { ensureInitialPasswordColumn } from '@/lib/participant-helpers';
import logger from '@/lib/logger';

interface RawParticipantRow {
    id: string;
    email: string;
    name: string;
    nip: string | null;
    initial_password: string | null;
    phone_number: string | null;
    address: string | null;
    date_of_birth: string | null;
    gender: string | null;
    institution: string | null;
    batch: string | number | null;
    registration_date: string | null;
    created_at: string;
}

async function handleGet(request: NextRequest, _authUser: AuthenticatedUser) {
    try {
        await ensureInitialPasswordColumn();

        const searchParams = request.nextUrl.searchParams;
        const idsParam = searchParams.get('ids');
        const search = searchParams.get('search');
        const institution = searchParams.get('institution');
        const batchParam = searchParams.get('batch');
        const genderParam = searchParams.get('gender');
        const dateFromParam = searchParams.get('date_from');
        const dateToParam = searchParams.get('date_to');
        const sortByParam = searchParams.get('sort_by');

        let query = `
            SELECT 
                u.id, 
                u.username as email, 
                u.full_name as name, 
                u.created_at,
                p.nip,
                p.initial_password,
                p.phone_number,
                p.address,
                DATE_FORMAT(p.date_of_birth, '%Y-%m-%d') as date_of_birth,
                p.gender,
                p.institution,
                p.batch,
                DATE_FORMAT(COALESCE(p.registration_date, p.created_at), '%Y-%m-%d') as registration_date
            FROM users u
            LEFT JOIN participant_profiles p ON u.id = p.user_id
            WHERE u.role = 'trainee'
        `;
        const params: (string | number)[] = [];

        // Filter by explicit IDs if requested (for bulk export of selected items)
        if (idsParam) {
            const ids = idsParam.split(',').map((id) => id.trim()).filter(Boolean);
            if (ids.length > 0) {
                const placeholders = ids.map(() => '?').join(',');
                query += ` AND u.id IN (${placeholders})`;
                params.push(...ids);
            }
        }

        if (search) {
            const searchClause = ` AND (u.username LIKE ? OR u.full_name LIKE ? OR p.institution LIKE ? OR p.nip LIKE ? OR p.phone_number LIKE ?)`;
            query += searchClause;
            const s = `%${search}%`;
            params.push(s, s, s, s, s);
        }

        if (institution && institution !== 'all') {
            if (institution === '__NONE__') {
                query += ` AND (p.institution IS NULL OR p.institution = '')`;
            } else {
                query += ` AND p.institution = ?`;
                params.push(institution);
            }
        }

        if (batchParam && batchParam !== 'all') {
            query += ` AND p.batch = ?`;
            params.push(batchParam);
        }

        if (genderParam && genderParam !== 'all') {
            query += ` AND p.gender = ?`;
            params.push(genderParam);
        }

        if (dateFromParam) {
            query += ` AND DATE(COALESCE(p.registration_date, p.created_at, u.created_at)) >= ?`;
            params.push(dateFromParam);
        }

        if (dateToParam) {
            query += ` AND DATE(COALESCE(p.registration_date, p.created_at, u.created_at)) <= ?`;
            params.push(dateToParam);
        }

        let orderByClause = 'ORDER BY u.created_at DESC';
        switch (sortByParam) {
            case 'created_asc':
                orderByClause = 'ORDER BY u.created_at ASC';
                break;
            case 'name_asc':
                orderByClause = 'ORDER BY u.full_name ASC';
                break;
            case 'name_desc':
                orderByClause = 'ORDER BY u.full_name DESC';
                break;
            case 'nip_asc':
                orderByClause = 'ORDER BY p.nip ASC';
                break;
            case 'nip_desc':
                orderByClause = 'ORDER BY p.nip DESC';
                break;
            case 'batch_asc':
                orderByClause = 'ORDER BY p.batch ASC, p.nip ASC';
                break;
            case 'batch_desc':
                orderByClause = 'ORDER BY p.batch DESC, p.nip DESC';
                break;
            default:
                orderByClause = 'ORDER BY u.created_at DESC';
                break;
        }

        query += ` ${orderByClause}`;

        const rows = await executeQuery<RawParticipantRow[]>(query, params);

        const exportRows: ParticipantDetailExportRow[] = (rows || []).map((row, idx) => ({
            no: idx + 1,
            fullName: row.name || '-',
            nip: row.nip || '-',
            email: row.email || '-',
            password: row.initial_password || '******',
            phoneNumber: row.phone_number || '-',
            gender: row.gender === 'L' ? 'L' : (row.gender === 'P' ? 'P' : '-'),
            dateOfBirth: row.date_of_birth || '-',
            address: row.address || '-',
            institution: row.institution || '-',
            batch: row.batch ? String(row.batch) : '1',
            registrationDate: row.registration_date || '-',
        }));

        const nowStr = new Date().toLocaleString('id-ID', {
            dateStyle: 'medium',
            timeStyle: 'short',
        });

        const xlsxBuffer = await generateParticipantsDetailExportXlsx({
            title: 'DATA DETAIL KREDENSIAL & PROFIL PESERTA',
            exportedAt: nowStr,
            rows: exportRows,
        });

        const dateSuffix = new Date().toISOString().slice(0, 10);
        const filename = `Data_Detail_Peserta_${dateSuffix}.xlsx`;

        return new NextResponse(xlsxBuffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': `attachment; filename="${filename}"`,
            },
        });

    } catch (error: any) {
        logger.error('EXPORT_PARTICIPANTS', 'Gagal mengekspor data detail peserta ke Excel', error);
        return NextResponse.json(
            { success: false, error: 'Terjadi kesalahan sistem saat mengekspor data peserta' },
            { status: 500 }
        );
    }
}

export const GET = withAuth(handleGet, { allowedRoles: ['admin', 'trainer'] });
