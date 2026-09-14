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
        // 1. Ambil detail sesi dan modul
        const sessionRows = await executeQuery<{
            id: string;
            title: string;
            module_id: string;
            module_title: string | null;
        }[]>(
            `SELECT s.id, s.title, s.module_id, m.title as module_title
             FROM sessions s
             LEFT JOIN modules m ON s.module_id = m.id
             WHERE s.id = ?`,
            [sessionId]
        );

        if (!sessionRows || sessionRows.length === 0) {
            return NextResponse.json({ error: 'Sesi tidak ditemukan' }, { status: 404 });
        }

        const session = sessionRows[0];

        // 2. Hitung jumlah item modul dalam sesi ini
        const countRows = await executeQuery<{ total: number }[]>(
            `SELECT COUNT(*) as total FROM module_items WHERE module_id = ?`,
            [session.module_id]
        );
        const totalItems = countRows[0]?.total ? Number(countRows[0].total) : 0;

        // 3. Ambil data peserta secara agregat per peserta (mencegah data duplikat)
        interface DbParticipantExportRow {
            user_id: string;
            full_name: string | null;
            username: string;
            nip: string | null;
            id_card_number: string | null;
            institution: string | null;
            batch: string | number | null;
            graduation_status: 'pending' | 'passed' | 'failed' | null;
            skl_number: string | null;
            certificate_number: string | null;
            completed_items: number | string | null;
            in_progress_items: number | string | null;
            exam_max_score: number | string | null;
            total_attempts: number | string | null;
            last_activity_at: string | null;
        }

        const participantQuery = `
            SELECT 
                sp.user_id,
                u.full_name,
                u.username,
                p.nip,
                p.id_card_number,
                p.institution,
                p.batch,
                sp.graduation_status,
                sp.skl_number,
                sp.certificate_number,
                COUNT(DISTINCT CASE WHEN up.status = 'completed' THEN up.module_item_id END) AS completed_items,
                COUNT(DISTINCT CASE WHEN up.status = 'open' THEN up.module_item_id END) AS in_progress_items,
                MAX(CASE WHEN mi.item_type = 'exam' AND up.score IS NOT NULL THEN up.score END) AS exam_max_score,
                COALESCE(SUM(up.attempts_count), 0) AS total_attempts,
                MAX(up.updated_at) AS last_activity_at
            FROM session_participants sp
            JOIN users u ON sp.user_id = u.id
            LEFT JOIN participant_profiles p ON sp.user_id = p.user_id
            LEFT JOIN user_progress up ON up.session_id = sp.session_id AND up.user_id = u.id
            LEFT JOIN module_items mi ON mi.id = up.module_item_id
            WHERE sp.session_id = ?
            GROUP BY 
                sp.id,
                sp.user_id,
                u.full_name,
                u.username,
                p.nip,
                p.id_card_number,
                p.institution,
                p.batch,
                sp.graduation_status,
                sp.skl_number,
                sp.certificate_number
            ORDER BY u.full_name ASC, u.username ASC
        `;

        const results = await executeQuery<DbParticipantExportRow[]>(participantQuery, [sessionId]);
        const safeFilenameId = sessionId.replace(/[^a-zA-Z0-9_-]/g, '_');
        const currentDate = new Date().toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' });

        const exportRows: SessionExportRow[] = results.map((row, index) => {
            const completed = Number(row.completed_items || 0);
            const inProgress = Number(row.in_progress_items || 0);

            // Progres Belajar
            let progressLabel = '-';
            if (totalItems > 0) {
                const percent = Math.round((completed / totalItems) * 100);
                progressLabel = `${percent}% (${completed}/${totalItems} Selesai)`;
            } else if (completed > 0) {
                progressLabel = `${completed} Selesai`;
            }

            // Status Kelulusan
            let graduationLabel = 'BELUM DITETAPKAN';
            if (row.graduation_status === 'passed') {
                graduationLabel = 'LULUS';
            } else if (row.graduation_status === 'failed') {
                graduationLabel = 'TIDAK LULUS';
            }

            // Status Pengerjaan (General Status)
            let statusLabel = 'Belum Memulai';
            if (row.graduation_status === 'passed') {
                statusLabel = 'Lulus';
            } else if (row.graduation_status === 'failed') {
                statusLabel = 'Tidak Lulus';
            } else if (totalItems > 0 && completed >= totalItems) {
                statusLabel = 'Selesai';
            } else if (completed > 0 || inProgress > 0) {
                statusLabel = 'Sedang Mengerjakan';
            }

            const scoreDisplay = row.exam_max_score !== null && row.exam_max_score !== undefined
                ? Number(row.exam_max_score).toFixed(1)
                : '-';

            const attemptsDisplay = row.total_attempts ? Number(row.total_attempts) : 0;
            const dateDisplay = row.last_activity_at
                ? new Date(row.last_activity_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
                : '-';

            return {
                no: index + 1,
                fullName: row.full_name || row.username,
                nip: row.nip || '-',
                nik: row.id_card_number || '-',
                institution: row.institution || '-',
                batch: row.batch ? String(row.batch) : '1',
                username: row.username,
                progress: progressLabel,
                status: statusLabel,
                graduationStatus: graduationLabel,
                score: scoreDisplay,
                attempts: attemptsDisplay,
                sklNumber: row.skl_number || '-',
                certificateNumber: row.certificate_number || '-',
                lastAccess: dateDisplay,
            };
        });

        const xlsxBuffer = await generateSessionReportXlsx({
            sessionId,
            sessionTitle: session.title,
            moduleTitle: session.module_title || undefined,
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
