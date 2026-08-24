import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import { withAuth, AuthenticatedUser } from '@/lib/api-auth';

/**
 * GET /api/participant/sessions/[id]/skl
 * Generates an official, print-ready Surat Keterangan Lulus (SKL) document.
 */
async function handleGet(
    request: NextRequest,
    user: AuthenticatedUser,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id: sessionId } = await context.params;
        const searchParams = request.nextUrl.searchParams;
        const targetUserId = (user.role === 'admin' || user.role === 'trainer')
            ? searchParams.get('userId') || user.id
            : user.id;

        // Fetch participant and session details
        const rows = await executeQuery<any[]>(
            `SELECT 
                sp.id AS enrollment_id,
                sp.graduation_status,
                sp.graduation_decided_at,
                sp.graduation_notes,
                sp.skl_number,
                sp.skl_generated_at,
                u.full_name,
                u.username,
                pp.nip,
                pp.institution,
                pp.batch,
                s.title AS session_title,
                s.start_time,
                s.end_time,
                m.title AS module_title,
                MAX(up.score) AS final_score
             FROM session_participants sp
             JOIN users u ON sp.user_id = u.id
             JOIN sessions s ON sp.session_id = s.id
             LEFT JOIN modules m ON s.module_id = m.id
             LEFT JOIN participant_profiles pp ON u.id = pp.user_id
             LEFT JOIN user_progress up ON up.user_id = sp.user_id AND up.session_id = sp.session_id
             WHERE sp.session_id = ? AND sp.user_id = ?
             GROUP BY sp.id, sp.graduation_status, sp.graduation_decided_at, sp.graduation_notes,
                      sp.skl_number, sp.skl_generated_at, u.full_name, u.username,
                      pp.nip, pp.institution, pp.batch, s.title, s.start_time, s.end_time, m.title
             LIMIT 1`,
            [sessionId, targetUserId]
        );

        if (!rows || rows.length === 0) {
            return new NextResponse('Data peserta atau sesi tidak ditemukan.', { status: 404 });
        }

        const data = rows[0];

        if (data.graduation_status !== 'passed') {
            return new NextResponse('Peserta belum dinyatakan LULUS pada sesi ini. SKL belum dapat diterbitkan.', { status: 403 });
        }

        const sklNumber = data.skl_number || `SKL/${new Date().getFullYear()}/TEMP/${data.enrollment_id.slice(0, 8)}`;
        const printDate = data.graduation_decided_at
            ? new Date(data.graduation_decided_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
            : new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

        const sessionDate = new Date(data.start_time).toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
        });

        // Format HTML print document
        const html = `<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Surat Keterangan Lulus (SKL) - ${data.full_name || data.username}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Playfair+Display:ital,wght@0,700;1,700&family=JetBrains+Mono:wght@500&display=swap" rel="stylesheet">
    <style>
        @page {
            size: A4 portrait;
            margin: 18mm 20mm;
        }
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }
        body {
            font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            color: #1e293b;
            background-color: #f8fafc;
            line-height: 1.6;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }
        .page-container {
            max-width: 210mm;
            min-height: 297mm;
            margin: 20px auto;
            background: #ffffff;
            padding: 24mm 22mm;
            position: relative;
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
            border-radius: 8px;
        }
        @media print {
            body {
                background: none;
            }
            .page-container {
                margin: 0;
                padding: 0;
                box-shadow: none;
                border-radius: 0;
                min-height: auto;
            }
            .no-print {
                display: none !important;
            }
        }
        
        /* Letterhead / Kop Surat */
        .letterhead {
            display: flex;
            align-items: center;
            justify-content: space-between;
            border-bottom: 3px double #0f172a;
            padding-bottom: 16px;
            margin-bottom: 24px;
        }
        .company-info {
            text-align: right;
        }
        .company-name {
            font-size: 18px;
            font-weight: 800;
            color: #0f172a;
            letter-spacing: -0.02em;
            text-transform: uppercase;
        }
        .company-sub {
            font-size: 11px;
            color: #64748b;
            margin-top: 2px;
        }
        .company-address {
            font-size: 10px;
            color: #94a3b8;
            margin-top: 4px;
            max-width: 320px;
            line-height: 1.4;
        }
        
        /* Document Title */
        .doc-title-box {
            text-align: center;
            margin: 24px 0 28px 0;
        }
        .doc-title {
            font-size: 20px;
            font-weight: 800;
            color: #0f172a;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            text-decoration: underline;
            text-underline-offset: 6px;
        }
        .doc-number {
            font-family: 'JetBrains Mono', monospace;
            font-size: 12px;
            font-weight: 600;
            color: #475569;
            margin-top: 8px;
        }

        /* Statement Text */
        .statement {
            font-size: 13px;
            text-align: justify;
            margin-bottom: 20px;
            color: #334155;
            line-height: 1.7;
        }

        /* Trainee Bio Table */
        .bio-table {
            width: 100%;
            margin: 20px 0 28px 0;
            border-collapse: collapse;
        }
        .bio-table td {
            padding: 8px 12px;
            font-size: 13px;
            vertical-align: top;
        }
        .bio-label {
            width: 170px;
            color: #64748b;
            font-weight: 500;
        }
        .bio-separator {
            width: 15px;
            color: #94a3b8;
            font-weight: bold;
        }
        .bio-value {
            color: #0f172a;
            font-weight: 600;
        }

        /* Verdict Box */
        .verdict-box {
            background: #f0fdf4;
            border: 2px solid #bbf7d0;
            border-radius: 12px;
            padding: 18px 24px;
            text-align: center;
            margin: 24px 0 28px 0;
        }
        .verdict-label {
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.1em;
            color: #166534;
        }
        .verdict-status {
            font-size: 24px;
            font-weight: 800;
            color: #15803d;
            letter-spacing: 0.05em;
            margin-top: 4px;
        }
        .verdict-desc {
            font-size: 12px;
            color: #166534;
            margin-top: 6px;
        }

        /* Clause Footer */
        .clause {
            font-size: 12px;
            color: #64748b;
            text-align: justify;
            line-height: 1.6;
            margin-top: 20px;
            border-left: 3px solid #cbd5e1;
            padding-left: 14px;
            font-style: italic;
        }

        /* Signatures Section */
        .signatures {
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            margin-top: 40px;
            padding-top: 10px;
        }
        .signature-box {
            text-align: center;
            width: 220px;
        }
        .sign-date {
            font-size: 12px;
            color: #475569;
            margin-bottom: 6px;
        }
        .sign-role {
            font-size: 12px;
            font-weight: 600;
            color: #0f172a;
        }
        .sign-space {
            height: 65px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .sign-stamp {
            display: inline-block;
            padding: 4px 12px;
            border: 2px dashed #0284c7;
            border-radius: 6px;
            font-size: 10px;
            font-weight: 700;
            color: #0284c7;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            transform: rotate(-3deg);
        }
        .sign-name {
            font-size: 13px;
            font-weight: 700;
            color: #0f172a;
            text-decoration: underline;
            text-underline-offset: 4px;
        }
        .sign-title {
            font-size: 11px;
            color: #64748b;
            margin-top: 2px;
        }

        /* Print Controls Floating Bar */
        .print-bar {
            position: fixed;
            bottom: 24px;
            right: 24px;
            display: flex;
            gap: 12px;
            background: #0f172a;
            padding: 10px 18px;
            border-radius: 100px;
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3);
            z-index: 999;
        }
        .print-btn {
            background: #2563eb;
            color: #ffffff;
            border: none;
            padding: 8px 18px;
            border-radius: 100px;
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            gap: 8px;
            transition: all 0.15s ease;
        }
        .print-btn:hover {
            background: #1d4ed8;
        }
        .close-btn {
            background: transparent;
            color: #94a3b8;
            border: 1px solid #334155;
            padding: 8px 16px;
            border-radius: 100px;
            font-size: 12px;
            font-weight: 500;
            cursor: pointer;
        }
        .close-btn:hover {
            color: #ffffff;
            background: #1e293b;
        }
    </style>
</head>
<body>

    <!-- Floating Action Bar -->
    <div class="print-bar no-print">
        <button class="print-btn" onclick="window.print()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v8H6z"/></svg>
            Cetak / Simpan PDF
        </button>
        <button class="close-btn" onclick="window.close()">Tutup</button>
    </div>

    <div class="page-container">
        <!-- Letterhead -->
        <div class="letterhead">
            <div style="display: flex; align-items: center; gap: 12px;">
                <div style="width: 48px; height: 48px; border-radius: 10px; background: #0f172a; display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 800; font-size: 20px; letter-spacing: -0.05em;">
                    NC
                </div>
                <div>
                    <div style="font-size: 16px; font-weight: 800; color: #0f172a;">NUSAMITRA</div>
                    <div style="font-size: 10px; font-weight: 600; color: #64748b; letter-spacing: 0.15em; text-transform: uppercase;">Consulting & Training</div>
                </div>
            </div>
            <div class="company-info">
                <div class="company-name">LMS Antigravity Training Center</div>
                <div class="company-sub">Lembaga Pelatihan & Pengembangan Profesional</div>
                <div class="company-address">Official Online Portal • Verifikasi Keaslian Dokumen Terdaftar</div>
            </div>
        </div>

        <!-- Title -->
        <div class="doc-title-box">
            <h1 class="doc-title">SURAT KETERANGAN LULUS</h1>
            <div class="doc-number">Nomor: ${sklNumber}</div>
        </div>

        <!-- Body Statement -->
        <p class="statement">
            Yang bertanda tangan di bawah ini, Tim Evaluasi & Penguji <strong>LMS Nusamitra Consulting</strong> menerangkan dengan sebenarnya bahwa:
        </p>

        <!-- Participant Details Table -->
        <table class="bio-table">
            <tr>
                <td class="bio-label">Nama Lengkap</td>
                <td class="bio-separator">:</td>
                <td class="bio-value" style="font-size: 14px; text-transform: uppercase;">${data.full_name || data.username}</td>
            </tr>
            ${data.nip ? `<tr>
                <td class="bio-label">Nomor Induk Pegawai (NIP)</td>
                <td class="bio-separator">:</td>
                <td class="bio-value" style="font-family: 'JetBrains Mono', monospace;">${data.nip}</td>
            </tr>` : ''}
            <tr>
                <td class="bio-label">Instansi / Unit Kerja</td>
                <td class="bio-separator">:</td>
                <td class="bio-value">${data.institution || '-'}</td>
            </tr>
            <tr>
                <td class="bio-label">Program Pelatihan</td>
                <td class="bio-separator">:</td>
                <td class="bio-value">${data.session_title}</td>
            </tr>
            <tr>
                <td class="bio-label">Modul / Materi Uji</td>
                <td class="bio-separator">:</td>
                <td class="bio-value">${data.module_title || 'Program Komprehensif'}</td>
            </tr>
            <tr>
                <td class="bio-label">Waktu Pelaksanaan</td>
                <td class="bio-separator">:</td>
                <td class="bio-value">${sessionDate}</td>
            </tr>
            ${data.final_score !== null ? `<tr>
                <td class="bio-label">Nilai Evaluasi Akhir</td>
                <td class="bio-separator">:</td>
                <td class="bio-value" style="color: #15803d; font-size: 14px;">${Number(data.final_score).toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} / 100.0</td>
            </tr>` : ''}
        </table>

        <!-- Verdict Banner -->
        <div class="verdict-box">
            <div class="verdict-label">Hasil Keputusan Evaluasi</div>
            <div class="verdict-status">D I N Y A T A K A N &nbsp; L U L U S</div>
            <div class="verdict-desc">${data.graduation_notes || 'Telah memenuhi seluruh standar kompetensi, kelulusan ujian, dan persyaratan pelatihan yang ditetapkan.'}</div>
        </div>

        <!-- Clause -->
        <div class="clause">
            Surat Keterangan Lulus (SKL) ini diterbitkan secara sah oleh sistem sebagai dokumen keterangan kelulusan sementara sembari menunggu penerbitan dan penyerahan Sertifikat Resmi Asli. Surat ini dapat dipergunakan sebagaimana mestinya.
        </div>

        <!-- Signatures -->
        <div class="signatures">
            <div class="signature-box" style="text-align: left;">
                <div style="font-size: 10px; color: #94a3b8; font-family: monospace;">
                    <div>Kode Verifikasi:</div>
                    <div style="font-weight: 700; color: #475569; margin-top: 2px;">${data.enrollment_id}</div>
                    <div style="margin-top: 4px;">Status: TERVERIFIKASI SISTEM</div>
                </div>
            </div>

            <div class="signature-box">
                <div class="sign-date">Diterbitkan pada: ${printDate}</div>
                <div class="sign-role">Tim Penilai & Administrator LMS</div>
                <div class="sign-space">
                    <div class="sign-stamp">✓ Verified & Approved</div>
                </div>
                <div class="sign-name">Nusamitra Training Directorate</div>
                <div class="sign-title">Direktorat Pelatihan & Sertifikasi</div>
            </div>
        </div>
    </div>

</body>
</html>`;

        return new NextResponse(html, {
            status: 200,
            headers: {
                'Content-Type': 'text/html; charset=utf-8',
            },
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Internal Server Error';
        return new NextResponse(`Terjadi kesalahan sistem: ${message}`, { status: 500 });
    }
}

export const GET = withAuth(handleGet, { allowedRoles: ['admin', 'trainer', 'trainee'] });
