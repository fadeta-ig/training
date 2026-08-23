import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import { withAuth } from '@/lib/api-auth';
import logger from '@/lib/logger';
import { generateSessionReportXlsx, SessionExportRow } from '@/lib/excel';

export const GET = withAuth(async (
    request: NextRequest,
    user,
    context?: { params: Promise<{ id: string }> }
) => {
    const resolvedParams = await context?.params;
    const sessionId = resolvedParams?.id;

    if (!sessionId) {
        return NextResponse.json({ error: 'ID sesi tidak valid' }, { status: 400 });
    }

    try {
        const q = `
            SELECT 
                u.full_name,
                u.username,
                p.nip,
                p.institution,
                p.batch,
                up.status,
                up.score,
                up.attempts_count,
                up.updated_at,
                s.title as session_title
            FROM session_participants sp
            JOIN users u ON sp.user_id = u.id
            JOIN sessions s ON sp.session_id = s.id
            LEFT JOIN participant_profiles p ON sp.user_id = p.user_id
            LEFT JOIN user_progress up ON up.session_id = sp.session_id AND up.user_id = u.id
            WHERE sp.session_id = ?
            GROUP BY u.id, u.full_name, u.username, p.nip, p.institution, p.batch, up.status, up.score, up.attempts_count, up.updated_at, s.title
            ORDER BY u.full_name ASC
        `;

        interface DbRow {
            full_name: string | null;
            username: string | null;
            nip: string | null;
            institution: string | null;
            batch: number | null;
            status: string | null;
            score: number | string | null;
            attempts_count: number | null;
            updated_at: string | null;
            session_title: string | null;
        }

        const results = await executeQuery<DbRow[]>(q, [sessionId]);
        const sessionTitle = results.length > 0 && results[0].session_title ? results[0].session_title : 'Sesi Pelatihan & Ujian';
        const safeFilenameId = sessionId.replace(/[^a-zA-Z0-9_-]/g, '_');
        const currentDate = new Date().toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' });

        const exportRows: SessionExportRow[] = results.map((row, index) => {
            let statusLabel = 'Belum Memulai';
            if (row.status === 'completed') {
                statusLabel = 'Selesai / Lulus';
            } else if (row.status === 'open') {
                statusLabel = 'Sedang Mengerjakan';
            }

            const scoreDisplay = row.score !== null && row.score !== undefined ? row.score : '-';
            const attemptsDisplay = row.attempts_count ? row.attempts_count : 0;
            const dateDisplay = row.updated_at
                ? new Date(row.updated_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
                : '-';

            return {
                no: index + 1,
                fullName: row.full_name || '-',
                nip: row.nip || '-',
                institution: row.institution || '-',
                batch: row.batch || 1,
                username: row.username || '-',
                status: statusLabel,
                score: scoreDisplay,
                attempts: attemptsDisplay,
                lastAccess: dateDisplay,
            };
        });

        const xlsxBuffer = await generateSessionReportXlsx({
            sessionId,
            sessionTitle,
            exportedAt: currentDate,
            rows: exportRows,
        });

        return new NextResponse(Buffer.from(xlsxBuffer), {
            status: 200,
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': `attachment; filename="Laporan_Sesi_${safeFilenameId}.xlsx"`,
                'Cache-Control': 'no-store',
            },
        });
    } catch (error: unknown) {
        logger.error('SESSION_EXPORT', 'Gagal mengekspor data sesi ke Excel', error);
        return NextResponse.json(
            { success: false, message: 'Gagal mengekspor data sesi. Silakan coba lagi.' },
            { status: 500 }
        );
    }
}, { allowedRoles: ['admin', 'trainer'] });
