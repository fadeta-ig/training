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
    const sklNumber = 'SKL/2026/08/BATCH-001/A8F2K';
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

    const html = `<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Surat Keterangan Lulus (SKL) - Ahmad Fauzi, S.Kom</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;600&display=swap" rel="stylesheet">
    <style>
        @page {
            size: A4 portrait;
            margin: 12mm 15mm;
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
            line-height: 1.5;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }
        .page-container {
            max-width: 210mm;
            margin: 0 auto;
            background: #ffffff;
            padding: 8mm 10mm;
            position: relative;
        }
        
        /* Letterhead / Kop Surat */
        .letterhead {
            display: flex;
            align-items: center;
            justify-content: space-between;
            border-bottom: 3px double #0f172a;
            padding-bottom: 12px;
            margin-bottom: 20px;
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
            font-size: 16px;
            font-weight: 800;
            color: #0f172a;
            letter-spacing: -0.02em;
            text-transform: uppercase;
        }
        .company-sub {
            font-size: 11px;
            color: #475569;
            margin-top: 2px;
            font-weight: 500;
        }
        .company-address {
            font-size: 10px;
            color: #64748b;
            margin-top: 3px;
            max-width: 340px;
            line-height: 1.4;
        }
        
        /* Document Title */
        .doc-title-box {
            text-align: center;
            margin: 18px 0 22px 0;
        }
        .doc-title {
            font-size: 20px;
            font-weight: 800;
            color: #0f172a;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            text-decoration: underline;
            text-underline-offset: 5px;
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
            margin-bottom: 16px;
            color: #334155;
            line-height: 1.6;
        }

        /* Trainee Bio Table */
        .bio-table {
            width: 100%;
            margin: 14px 0 20px 0;
            border-collapse: collapse;
        }
        .bio-table td {
            padding: 7px 10px;
            font-size: 13px;
            vertical-align: top;
        }
        .bio-label {
            width: 185px;
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
            border-radius: 10px;
            padding: 14px 18px;
            text-align: center;
            margin: 18px 0 20px 0;
        }
        .verdict-label {
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.1em;
            color: #166534;
        }
        .verdict-status {
            font-size: 20px;
            font-weight: 800;
            color: #15803d;
            letter-spacing: 0.05em;
            margin-top: 3px;
        }
        .verdict-desc {
            font-size: 11.5px;
            color: #166534;
            margin-top: 4px;
        }

        /* Clause Footer */
        .clause {
            font-size: 11px;
            color: #64748b;
            text-align: justify;
            line-height: 1.55;
            margin-top: 16px;
            border-left: 3px solid #cbd5e1;
            padding-left: 12px;
            font-style: italic;
        }

        /* Signatures Section */
        .signatures {
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            margin-top: 32px;
            padding-top: 8px;
        }
        .signature-box {
            text-align: center;
            width: 240px;
        }
        .sign-date {
            font-size: 11.5px;
            color: #475569;
            margin-bottom: 5px;
        }
        .sign-role {
            font-size: 11.5px;
            font-weight: 600;
            color: #0f172a;
        }
        .qr-wrapper {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            margin: 6px 0;
        }
        .qr-img {
            width: 78px;
            height: 78px;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 3px;
            background: #ffffff;
        }
        .qr-hint {
            font-size: 8.5px;
            color: #64748b;
            margin-top: 3px;
            font-weight: 500;
        }
        .sign-name {
            font-size: 12.5px;
            font-weight: 700;
            color: #0f172a;
            text-decoration: underline;
            text-underline-offset: 3px;
        }
        .sign-title {
            font-size: 10.5px;
            color: #64748b;
            margin-top: 2px;
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

        <!-- Title -->
        <div class="doc-title-box">
            <h1 class="doc-title">SURAT KETERANGAN LULUS</h1>
            <div class="doc-number">Nomor: ${sklNumber}</div>
        </div>

        <!-- Body Statement -->
        <p class="statement">
            Yang bertanda tangan di bawah ini, Tim Evaluasi & Penguji <strong>Nusamitra Consulting</strong> menerangkan dengan sebenarnya bahwa:
        </p>

        <!-- Participant Details Table -->
        <table class="bio-table">
            <tr>
                <td class="bio-label">Nama Lengkap</td>
                <td class="bio-separator">:</td>
                <td class="bio-value" style="font-size: 13.5px; text-transform: uppercase;">Ahmad Fauzi, S.Kom</td>
            </tr>
            <tr>
                <td class="bio-label">Nomor Induk Pegawai (NIP)</td>
                <td class="bio-separator">:</td>
                <td class="bio-value" style="font-family: 'JetBrains Mono', monospace;">198904152015031002</td>
            </tr>
            <tr>
                <td class="bio-label">Instansi / Unit Kerja</td>
                <td class="bio-separator">:</td>
                <td class="bio-value">Badan Kepegawaian & Pengembangan SDM</td>
            </tr>
            <tr>
                <td class="bio-label">Program Pelatihan</td>
                <td class="bio-separator">:</td>
                <td class="bio-value">Pelatihan Transformasi Digital & Manajemen Data</td>
            </tr>
            <tr>
                <td class="bio-label">Modul / Materi Uji</td>
                <td class="bio-separator">:</td>
                <td class="bio-value">Program Komprehensif Arsitektur Cloud</td>
            </tr>
            <tr>
                <td class="bio-label">Waktu Pelaksanaan</td>
                <td class="bio-separator">:</td>
                <td class="bio-value">25 Agustus 2026</td>
            </tr>
        </table>

        <!-- Verdict Banner -->
        <div class="verdict-box">
            <div class="verdict-label">Hasil Keputusan Evaluasi</div>
            <div class="verdict-status">D I N Y A T A K A N &nbsp; L U L U S</div>
            <div class="verdict-desc">Telah memenuhi seluruh standar kompetensi, kelulusan ujian, dan persyaratan pelatihan yang ditetapkan.</div>
        </div>

        <!-- Clause -->
        <div class="clause">
            Surat Keterangan Lulus (SKL) ini diterbitkan secara sah oleh sistem sebagai dokumen keterangan kelulusan sementara sembari menunggu penerbitan dan penyerahan Sertifikat Resmi Asli. Surat ini dapat dipergunakan sebagaimana mestinya.
        </div>

        <!-- Signatures -->
        <div class="signatures">
            <div class="signature-box" style="text-align: left;">
                <div style="font-size: 9.5px; color: #64748b; font-family: monospace;">
                    <div>Kode Verifikasi:</div>
                    <div style="font-weight: 700; color: #0f172a; margin-top: 2px; font-size: 10.5px;">${enrollmentId}</div>
                    <div style="margin-top: 3px; color: #16a34a; font-weight: 600;">Status: TERVERIFIKASI SISTEM</div>
                    <div style="font-size: 9px; color: #94a3b8; margin-top: 5px; font-family: 'Plus Jakarta Sans', sans-serif; line-height: 1.4;">
                        Dokumen ini diterbitkan dan tercatat resmi secara digital pada pangkalan data Nusamitra Consulting.
                    </div>
                </div>
            </div>

            <div class="signature-box">
                <div class="sign-date">Diterbitkan pada: 25 Agustus 2026</div>
                <div class="sign-role">Tim Penilai & Penguji</div>
                <div class="qr-wrapper">
                    <img src="${qrCodeDataUrl}" alt="QR Verification" class="qr-img" />
                    <span class="qr-hint">Pindai untuk Verifikasi</span>
                </div>
                <div class="sign-name">Nusamitra Training Directorate</div>
                <div class="sign-title">Direktorat Pelatihan & Sertifikasi</div>
            </div>
        </div>
    </div>

</body>
</html>`;

    const outputDir = path.resolve('public', 'generated-docs');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    const outputPath = path.join(outputDir, 'Surat_Keterangan_Lulus_SKL_Sample.pdf');

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
            top: '10mm',
            right: '12mm',
            bottom: '10mm',
            left: '12mm'
        }
    });

    await browser.close();
    console.log(`SUCCESS: PDF updated at: ${outputPath}`);
}

run().catch(err => {
    console.error('Error generating PDF:', err);
    process.exit(1);
});
