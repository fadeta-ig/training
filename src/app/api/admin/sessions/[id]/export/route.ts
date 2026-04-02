import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import { withAuth } from '@/lib/api-auth';

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
                up.status,
                up.score,
                up.attempts_count,
                up.updated_at,
                s.title as session_title
            FROM session_participants sp
            JOIN users u ON sp.user_id = u.id
            JOIN sessions s ON sp.session_id = s.id
            LEFT JOIN user_progress up ON up.session_id = sp.session_id AND up.user_id = u.id
            WHERE sp.session_id = ?
            GROUP BY u.id, up.status, up.score, up.attempts_count, up.updated_at, s.title
            ORDER BY u.full_name ASC
        `;
        
        const results = await executeQuery<any[]>(q, [sessionId]);
        const sessionTitle = results.length > 0 ? results[0].session_title : 'Sesi Ujian';
        const currentDate = new Date().toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' });

        let htmlRows = '';
        if (results && results.length > 0) {
            results.forEach((row, index) => {
                const name = row.full_name || '-';
                const username = row.username || '-';
                
                let statusStr = 'BELUM';
                let statusColor = '#64748b'; // slate-500
                if (row.status === 'completed') {
                    statusStr = 'SELESAI';
                    statusColor = '#16a34a'; // green-600
                } else if (row.status === 'open') {
                    statusStr = 'MENGERJAKAN';
                    statusColor = '#2563eb'; // blue-600
                }

                const scoreStr = row.score !== null ? row.score : '-';
                const attemptsStr = row.attempts_count || '0';
                const dateStr = row.updated_at ? new Date(row.updated_at).toLocaleString('id-ID') : '-';
                
                htmlRows += `
                <tr>
                    <td style="text-align: center;">${index + 1}</td>
                    <td>${name}</td>
                    <td>${username}</td>
                    <td style="color: ${statusColor}; font-weight: bold; text-align: center;">${statusStr}</td>
                    <td style="text-align: center;">${scoreStr}</td>
                    <td style="text-align: center;">${attemptsStr}</td>
                    <td style="text-align: center;">${dateStr}</td>
                </tr>
                `;
            });
        } else {
            htmlRows = `<tr><td colspan="7" style="text-align: center; color: #64748b;">Belum ada data peserta terdaftar pada sesi ini.</td></tr>`;
        }

        const htmlContent = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
        <head>
            <meta charset="utf-8" />
            <style>
                table { border-collapse: collapse; font-family: Arial, sans-serif; font-size: 10pt; }
                th { background-color: #1e293b; color: #ffffff; font-weight: bold; padding: 10px; border: 1px solid #cbd5e1; }
                td { border: 1px solid #cbd5e1; padding: 6px 10px; vertical-align: middle; }
                .title-row { background-color: #f8fafc; font-size: 14pt; font-weight: bold; text-align: left; }
                .meta-row { font-size: 10pt; color: #475569; }
            </style>
        </head>
        <body>
            <table>
                <tr><td colspan="7" class="title-row" style="height: 40px; vertical-align: middle; padding-left: 10px;">Laporan Hasil Sesi: ${sessionTitle}</td></tr>
                <tr><td colspan="7" class="meta-row">ID Sesi: ${sessionId}</td></tr>
                <tr><td colspan="7" class="meta-row">Diunduh pada: ${currentDate}</td></tr>
                <tr><td colspan="7"></td></tr>
                <tr>
                    <th style="width: 40px;">No</th>
                    <th style="width: 200px;">Nama Lengkap</th>
                    <th style="width: 150px;">Username / NIK</th>
                    <th style="width: 120px;">Status Kelulusan</th>
                    <th style="width: 100px;">Skor Akhir</th>
                    <th style="width: 80px;">Percobaan</th>
                    <th style="width: 150px;">Akses Terakhir</th>
                </tr>
                ${htmlRows}
            </table>
        </body>
        </html>
        `;

        return new NextResponse(htmlContent, {
            status: 200,
            headers: {
                'Content-Type': 'application/vnd.ms-excel',
                'Content-Disposition': `attachment; filename="Laporan_Sesi_${sessionId}.xls"`,
            },
        });

    } catch (error: any) {
        console.error('Excel Export Error:', error);
        return NextResponse.json(
            { success: false, message: 'Gagal mengekspor data' },
            { status: 500 }
        );
    }
}, { allowedRoles: ['admin'] });
