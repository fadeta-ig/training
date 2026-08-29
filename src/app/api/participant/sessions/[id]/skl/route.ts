import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import { withAuth, AuthenticatedUser } from '@/lib/api-auth';
import fs from 'fs';
import path from 'path';
import QRCode from 'qrcode';

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
                m.title AS module_title
             FROM session_participants sp
             JOIN users u ON sp.user_id = u.id
             JOIN sessions s ON sp.session_id = s.id
             LEFT JOIN modules m ON s.module_id = m.id
             LEFT JOIN participant_profiles pp ON u.id = pp.user_id
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

        // Format date and Roman month
        const decidedDateObj = data.graduation_decided_at ? new Date(data.graduation_decided_at) : new Date();
        const ROMAN_MONTHS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
        const romanMonth = ROMAN_MONTHS[decidedDateObj.getMonth()] || 'I';
        const currentYear = decidedDateObj.getFullYear();

        const printDate = decidedDateObj.toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });

        // Format SKL Number according to official pattern (<<No. SKL>>/E/SK/<<Bln Romawi>>/<<Tahun>>)
        let sklNumber = data.skl_number || '';
        if (!sklNumber) {
            const shortId = (data.enrollment_id || '001').slice(0, 3).toUpperCase();
            sklNumber = `${shortId}/E/SK/${romanMonth}/${currentYear}`;
        } else if (!sklNumber.includes('/E/SK/')) {
            const parts = sklNumber.split('/');
            const seq = parts[parts.length - 1] || '001';
            sklNumber = `${seq}/E/SK/${romanMonth}/${currentYear}`;
        }

        // Load Nusamitra logo as base64 for self-contained print reliability
        let logoBase64 = '';
        try {
            const logoPath = path.join(process.cwd(), 'public', 'logo-nusamitra-tr.png');
            if (fs.existsSync(logoPath)) {
                const logoBuf = fs.readFileSync(logoPath);
                logoBase64 = `data:image/png;base64,${logoBuf.toString('base64')}`;
            }
        } catch (logoErr) {
            console.error('Failed reading Nusamitra logo:', logoErr);
        }

        // Robust base URL resolution (respects reverse proxy headers & production domain)
        const forwardedHost = request.headers.get('x-forwarded-host') || request.headers.get('host');
        const forwardedProto = request.headers.get('x-forwarded-proto') || (request.url.startsWith('https') ? 'https' : 'http');
        let baseUrl = request.nextUrl.origin;

        if (process.env.NEXT_PUBLIC_APP_URL && !process.env.NEXT_PUBLIC_APP_URL.includes('localhost')) {
            baseUrl = process.env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, '');
        } else if (process.env.APP_URL && !process.env.APP_URL.includes('localhost')) {
            baseUrl = process.env.APP_URL.replace(/\/+$/, '');
        } else if (forwardedHost && !forwardedHost.includes('127.0.0.1')) {
            baseUrl = `${forwardedProto}://${forwardedHost}`.replace(/\/+$/, '');
        }

        // Generate dynamic QR Code for public online verification
        const verificationPayload = `${baseUrl}/verify/skl/${data.enrollment_id}?no=${encodeURIComponent(sklNumber)}`;
        const qrCodeDataUrl = await QRCode.toDataURL(verificationPayload, {
            errorCorrectionLevel: 'M',
            margin: 1,
            width: 140,
            color: {
                dark: '#0f172a',
                light: '#ffffff',
            },
        });

        const participantName = data.full_name || data.username || '-';
        const institutionName = data.institution || 'Instansi Peserta Terdaftar';
        const certificationName = data.session_title || data.module_title || 'Pelatihan dan Sertifikasi Profesi International';

        // Format HTML print document
        const html = `<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Surat Keterangan Hasil Ujian - ${participantName}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;600&display=swap" rel="stylesheet">
    <style>
        @page {
            size: A4 portrait;
            margin: 15mm 18mm;
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
            padding: 16mm 20mm;
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
            padding-bottom: 12px;
            margin-bottom: 24px;
        }
        .logo-container {
            display: flex;
            align-items: center;
            gap: 14px;
        }
        .logo-img {
            height: 52px;
            width: auto;
            max-width: 190px;
            object-fit: contain;
        }
        .company-info {
            text-align: right;
        }
        .company-name {
            font-size: 15px;
            font-weight: 800;
            color: #0f172a;
            letter-spacing: -0.02em;
            text-transform: uppercase;
        }
        .company-sub {
            font-size: 10.5px;
            color: #475569;
            margin-top: 2px;
            font-weight: 500;
        }
        .company-address {
            font-size: 9.5px;
            color: #64748b;
            margin-top: 2px;
            max-width: 340px;
            line-height: 1.35;
        }

        /* Top Header Meta (Location Date & Ref Info) */
        .doc-header-meta {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 22px;
            font-size: 13px;
            color: #1e293b;
        }
        .meta-left {
            flex: 1;
        }
        .meta-table {
            border-collapse: collapse;
        }
        .meta-table td {
            padding: 2px 0;
            vertical-align: top;
            font-size: 13px;
        }
        .meta-label {
            width: 80px;
            color: #1e293b;
            font-weight: 500;
        }
        .meta-sep {
            width: 18px;
            color: #1e293b;
            text-align: center;
        }
        .meta-val {
            color: #0f172a;
            font-weight: 600;
        }
        .meta-right {
            text-align: right;
            font-size: 13px;
            font-weight: 500;
            color: #1e293b;
            white-space: nowrap;
        }

        /* Recipient Section */
        .recipient-box {
            margin-bottom: 22px;
            font-size: 13px;
            line-height: 1.5;
            color: #1e293b;
        }
        .recipient-title {
            margin-bottom: 6px;
            font-weight: 500;
        }
        .recipient-name {
            font-weight: 700;
            color: #0f172a;
        }
        .recipient-inst {
            font-weight: 600;
            color: #334155;
        }

        /* Salutation */
        .salutation {
            font-size: 13px;
            margin-bottom: 14px;
            color: #1e293b;
        }

        /* Statement Paragraphs */
        .body-paragraph {
            font-size: 13px;
            text-align: justify;
            margin-bottom: 16px;
            color: #1e293b;
            line-height: 1.65;
        }

        /* Results Table (3 Columns: NAMA, SERTIFIKASI, KETERANGAN) */
        .results-table-container {
            margin: 22px 0;
        }
        .results-table {
            width: 100%;
            border-collapse: collapse;
            border: 1.5px solid #334155;
        }
        .results-table th {
            background-color: #cbd5e1;
            color: #0f172a;
            font-weight: 700;
            font-size: 12.5px;
            padding: 10px 14px;
            border: 1.5px solid #334155;
            text-transform: uppercase;
            letter-spacing: 0.04em;
            text-align: center;
        }
        .results-table td {
            border: 1.5px solid #334155;
            padding: 12px 14px;
            font-size: 13px;
            color: #0f172a;
            vertical-align: middle;
        }
        .col-nama {
            width: 40%;
            font-weight: 600;
            text-align: left;
        }
        .col-sertifikasi {
            width: 42%;
            text-align: left;
        }
        .col-keterangan {
            width: 18%;
            text-align: center;
            font-weight: 700;
            letter-spacing: 0.05em;
        }

        /* Closing Section */
        .closing-section {
            margin-top: 14px;
        }

        /* Signatures Section */
        .signature-container {
            margin-top: 26px;
            display: flex;
            justify-content: flex-end;
        }
        .signature-box {
            text-align: center;
            width: 250px;
            display: flex;
            flex-direction: column;
            align-items: center;
        }
        .sign-salute {
            font-size: 13px;
            color: #1e293b;
            margin-bottom: 8px;
            width: 100%;
            text-align: center;
        }
        .qr-wrapper {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            margin: 6px 0 10px 0;
        }
        .qr-img {
            width: 82px;
            height: 82px;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 3px;
            background: #ffffff;
        }
        .qr-hint {
            font-size: 9px;
            color: #64748b;
            margin-top: 4px;
            font-weight: 500;
        }
        .sign-name {
            font-size: 13px;
            font-weight: 700;
            color: #0f172a;
            text-decoration: underline;
            text-underline-offset: 4px;
        }
        .sign-title {
            font-size: 11.5px;
            color: #475569;
            margin-top: 3px;
        }

        /* Verification Badge Bottom */
        .doc-footer-audit {
            margin-top: 36px;
            padding-top: 12px;
            border-top: 1px dashed #cbd5e1;
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 10px;
            color: #64748b;
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
            <div class="logo-container">
                ${logoBase64 
                    ? `<img src="${logoBase64}" alt="Nusamitra Consulting" class="logo-img" />`
                    : `<div style="font-size: 18px; font-weight: 800; color: #0f172a; letter-spacing: -0.03em;">NUSAMITRA</div>`
                }
            </div>
            <div class="company-info">
                <div class="company-name">NUSAMITRA CONSULTING</div>
                <div class="company-sub">Lembaga Konsultasi & Pelatihan Profesional</div>
                <div class="company-address">Official Online Training Portal • Verifikasi Dokumen Terdaftar</div>
            </div>
        </div>

        <!-- Header Meta (Reference Info & Date) -->
        <div class="doc-header-meta">
            <div class="meta-left">
                <table class="meta-table">
                    <tr>
                        <td class="meta-label">No</td>
                        <td class="meta-sep">:</td>
                        <td class="meta-val">${sklNumber}</td>
                    </tr>
                    <tr>
                        <td class="meta-label">Perihal</td>
                        <td class="meta-sep">:</td>
                        <td class="meta-val">Surat Keterangan Hasil Ujian</td>
                    </tr>
                    <tr>
                        <td class="meta-label">Lampiran</td>
                        <td class="meta-sep">:</td>
                        <td class="meta-val">-</td>
                    </tr>
                </table>
            </div>
            <div class="meta-right">
                Surabaya, ${printDate}
            </div>
        </div>

        <!-- Recipient Information -->
        <div class="recipient-box">
            <div class="recipient-title">Kepada Yth :</div>
            <div class="recipient-name">${participantName}</div>
            <div class="recipient-inst">${institutionName}</div>
        </div>

        <!-- Salutation -->
        <div class="salutation">Dengan Hormat,</div>

        <!-- Body Opening Statement -->
        <p class="body-paragraph">
            Bersama dengan surat ini kami sampaikan hasil dari pengujian yang telah dilakukan oleh <strong>Assesor American Academy</strong> sebagai tindak lanjut <strong>&ldquo;Exam Preparation Course&rdquo;</strong> yang merupakan proses akhir dari rangkaian kegiatan Pelatihan dan Sertifikasi Profesi International melalui American Academy of Project Management.
        </p>

        <!-- Results Table (3 Columns without C3) -->
        <div class="results-table-container">
            <table class="results-table">
                <thead>
                    <tr>
                        <th style="width: 38%;">NAMA</th>
                        <th style="width: 44%;">SERTIFIKASI</th>
                        <th style="width: 18%;">KETERANGAN</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td class="col-nama">${participantName}</td>
                        <td class="col-sertifikasi">${certificationName}</td>
                        <td class="col-keterangan">LULUS</td>
                    </tr>
                </tbody>
            </table>
        </div>

        <!-- Closing Paragraphs -->
        <div class="closing-section">
            <p class="body-paragraph">
                Selanjutnya akan dilakukan penerbitan Sertifikat Kompetensi / Profesi International melalui American Academy of Project Management.
            </p>
            <p class="body-paragraph">
                Demikian surat keterangan ini kami sampaikan, terima kasih atas perhatian dan kerjasamanya.
            </p>
        </div>

        <!-- Signatures & Dynamic QR Verification -->
        <div class="signature-container">
            <div class="signature-box">
                <div class="sign-salute">Hormat Kami,</div>
                <div class="qr-wrapper">
                    <img src="${qrCodeDataUrl}" alt="QR Verification" class="qr-img" />
                    <span class="qr-hint">Pindai untuk Verifikasi</span>
                </div>
                <div class="sign-name">Nusamitra Training Directorate</div>
                <div class="sign-title">Direktorat Pelatihan & Sertifikasi</div>
            </div>
        </div>

        <!-- Footer Audit Trail -->
        <div class="doc-footer-audit">
            <div>ID Dokumen: <code>${data.enrollment_id}</code></div>
            <div>Status: <strong>TERCATAT RESMI DIGITAL</strong></div>
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


