import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';
import QRCode from 'qrcode';

const possibleBrowserPaths = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Users\\' + (process.env.USERNAME || 'IT WIG') + '\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe'
];

let executablePath = undefined;
for (const p of possibleBrowserPaths) {
    if (fs.existsSync(p)) {
        executablePath = p;
        break;
    }
}

// Load Nusamitra logo
let logoBase64 = '';
try {
    const logoPath = path.resolve('public', 'logo-nusamitra-tr.png');
    if (fs.existsSync(logoPath)) {
        const logoBuf = fs.readFileSync(logoPath);
        logoBase64 = `data:image/png;base64,${logoBuf.toString('base64')}`;
    }
} catch (e) {
    console.error('Failed to load logo:', e);
}

async function run() {
    const sklNumber = '024/E/SK/VIII/2026';
    const enrollmentId = 'ENR-9842-8712-A8F2K';
    const verificationPayload = `https://lms.nusamitraconsulting.com/verify/skl/${enrollmentId}?no=${encodeURIComponent(sklNumber)}`;
    
    const qrCodeDataUrl = await QRCode.toDataURL(verificationPayload, {
        errorCorrectionLevel: 'M',
        margin: 1,
        width: 140,
        color: {
            dark: '#0f172a',
            light: '#ffffff'
        }
    });

    const participantName = 'Ahmad Fauzi, S.Kom';
    const institutionName = 'Badan Kepegawaian & Pengembangan SDM';
    const certificationName = 'Pelatihan dan Sertifikasi Profesi International Certified Project Officer (CPO)';
    const printDate = '25 Agustus 2026';

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
            margin: 14mm 16mm;
        }
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }
        body {
            font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            color: #1e293b;
            background-color: #ffffff;
            line-height: 1.6;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }
        .page-container {
            max-width: 210mm;
            margin: 0 auto;
            background: #ffffff;
            padding: 4mm 6mm;
            position: relative;
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
            gap: 12px;
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
    </style>
</head>
<body>

    <div class="page-container">
        <!-- Letterhead -->
        <div class="letterhead">
            <div class="logo-container">
                <img src="${logoBase64}" alt="Nusamitra Consulting" class="logo-img" />
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
            <div>ID Dokumen: <code>${enrollmentId}</code></div>
            <div>Status: <strong>TERCATAT RESMI DIGITAL</strong></div>
        </div>
    </div>

</body>
</html>`;

    const outputDir = path.resolve('public', 'generated-docs');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    const outputPath = path.join(outputDir, 'Surat_Keterangan_Hasil_Ujian_Sample.pdf');

    const launchOptions = {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
    };
    if (executablePath) {
        launchOptions.executablePath = executablePath;
    }

    const browser = await puppeteer.launch(launchOptions);
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load' });

    await page.pdf({
        path: outputPath,
        format: 'A4',
        printBackground: true,
        margin: {
            top: '12mm',
            right: '15mm',
            bottom: '12mm',
            left: '15mm'
        }
    });

    await browser.close();
    console.log(`SUCCESS: PDF updated at: ${outputPath}`);
}

run().catch(err => {
    console.error('Error generating PDF:', err);
    process.exit(1);
});
