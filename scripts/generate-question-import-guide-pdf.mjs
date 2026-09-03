import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';

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

// Load Nusamitra logo if available
let logoBase64 = '';
try {
    const logoPath = path.resolve('public', 'logo-nusamitra-tr.png');
    if (fs.existsSync(logoPath)) {
        const logoBuf = fs.readFileSync(logoPath);
        logoBase64 = `data:image/png;base64,${logoBuf.toString('base64')}`;
    }
} catch (e) {
    console.warn('Logo not loaded:', e.message);
}

const html = `<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Panduan Praktis Import Soal Excel - LMS</title>
    <style>
        @page {
            size: A4 portrait;
            margin: 8mm 10mm 8mm 10mm;
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif;
            color: #1e293b;
            background: #ffffff;
            font-size: 7.8pt;
            line-height: 1.35;
        }

        .header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            border-bottom: 2px solid #0284c7;
            padding-bottom: 6px;
            margin-bottom: 8px;
        }

        .header-left {
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .header-logo {
            height: 32px;
            object-fit: contain;
        }

        .header-title h1 {
            font-size: 13pt;
            font-weight: 800;
            color: #0f172a;
            letter-spacing: -0.2px;
        }

        .header-title p {
            font-size: 7.5pt;
            color: #64748b;
            font-weight: 500;
        }

        .badge-doc {
            background: #f0fdf4;
            border: 1px solid #86efac;
            color: #166534;
            font-size: 7.5pt;
            font-weight: 700;
            padding: 3px 8px;
            border-radius: 12px;
            text-transform: uppercase;
        }

        .section-title {
            font-size: 9.5pt;
            font-weight: 700;
            color: #0f172a;
            margin-top: 8px;
            margin-bottom: 5px;
            display: flex;
            align-items: center;
            gap: 5px;
        }

        .section-title::before {
            content: "";
            display: inline-block;
            width: 3.5px;
            height: 12px;
            background: #0284c7;
            border-radius: 2px;
        }

        /* Step workflow */
        .workflow-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 6px;
            margin-bottom: 6px;
        }

        .step-card {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 5px;
            padding: 5px 7px;
        }

        .step-num {
            display: inline-block;
            background: #0284c7;
            color: #ffffff;
            font-size: 7pt;
            font-weight: 800;
            width: 15px;
            height: 15px;
            line-height: 15px;
            text-align: center;
            border-radius: 50%;
            margin-bottom: 2px;
        }

        .step-title {
            font-size: 8pt;
            font-weight: 700;
            color: #0f172a;
            margin-bottom: 1px;
        }

        .step-desc {
            font-size: 7pt;
            color: #64748b;
            line-height: 1.25;
        }

        /* Tables */
        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 6px;
            font-size: 7.5pt;
        }

        th {
            background: #f1f5f9;
            color: #334155;
            font-weight: 700;
            text-align: left;
            padding: 3.5px 6px;
            border: 1px solid #cbd5e1;
            font-size: 7.5pt;
        }

        td {
            padding: 3px 6px;
            border: 1px solid #e2e8f0;
            vertical-align: middle;
        }

        tr:nth-child(even) td {
            background: #fafafa;
        }

        .code-box {
            font-family: 'Consolas', 'Courier New', monospace;
            background: #f1f5f9;
            color: #0f172a;
            font-weight: 600;
            padding: 0.5px 3px;
            border-radius: 2px;
            font-size: 7.5pt;
        }

        /* 3 Sheet Overview Cards in 3 columns */
        .sheet-container {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 6px;
            margin-bottom: 6px;
        }

        .sheet-box {
            border: 1px solid #cbd5e1;
            border-radius: 5px;
            padding: 5px 7px;
        }

        .sheet-box-blue {
            border-top: 3px solid #2563eb;
            background: #f8fafc;
        }

        .sheet-box-green {
            border-top: 3px solid #16a34a;
            background: #f0fdf4;
        }

        .sheet-box-purple {
            border-top: 3px solid #9333ea;
            background: #faf5ff;
        }

        .sheet-name {
            font-weight: 800;
            font-size: 8pt;
            display: block;
            margin-bottom: 2px;
        }

        .sheet-for {
            display: inline-block;
            font-size: 6.8pt;
            font-weight: 700;
            background: #ffffff;
            border: 1px solid #cbd5e1;
            padding: 1px 4px;
            border-radius: 3px;
            color: #475569;
            margin-bottom: 4px;
        }

        .sheet-desc {
            font-size: 7pt;
            color: #334155;
            line-height: 1.25;
        }

        /* Matrix table */
        .matrix-table th {
            text-align: center;
        }

        /* Warning rules */
        .rule-card {
            background: #fffbeb;
            border: 1px solid #fde68a;
            border-left: 3.5px solid #f59e0b;
            border-radius: 5px;
            padding: 6px 10px;
            margin-top: 4px;
        }

        .rule-card h4 {
            color: #b45309;
            font-size: 8pt;
            font-weight: 700;
            margin-bottom: 3px;
        }

        .rule-list {
            list-style: none;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 3px 10px;
            font-size: 7pt;
            color: #78350f;
        }

        .rule-list li {
            position: relative;
            padding-left: 10px;
        }

        .rule-list li::before {
            content: "•";
            position: absolute;
            left: 0;
            color: #d97706;
            font-weight: bold;
        }

        .footer {
            margin-top: 6px;
            padding-top: 4px;
            border-top: 1px solid #e2e8f0;
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 6.8pt;
            color: #94a3b8;
        }
    </style>
</head>
<body>

    <!-- HEADER -->
    <div class="header">
        <div class="header-left">
            ${logoBase64 ? `<img src="${logoBase64}" class="header-logo" alt="Nusamitra Logo" />` : ''}
            <div class="header-title">
                <h1>Panduan Praktis Import Soal Excel</h1>
                <p>Format resmi pengisian template Excel (.xlsx) untuk bank soal LMS Nusamitra</p>
            </div>
        </div>
        <div class="badge-doc">Format Resmi LMS</div>
    </div>

    <!-- 1. ALUR PENGGUNAAN -->
    <div class="section-title">1. Empat Langkah Mudah Import Soal</div>
    <div class="workflow-grid">
        <div class="step-card">
            <span class="step-num">1</span>
            <div class="step-title">Unduh Template</div>
            <div class="step-desc">Buka menu <b>Import Soal Excel</b> pada ujian, lalu unduh file template resminya.</div>
        </div>
        <div class="step-card">
            <span class="step-num">2</span>
            <div class="step-title">Isi File Excel</div>
            <div class="step-desc">Isi soal pada sheet <b>SOAL</b>, <b>OPSI</b>, atau <b>PASANGAN</b> sesuai petunjuk di bawah.</div>
        </div>
        <div class="step-card">
            <span class="step-num">3</span>
            <div class="step-title">Unggah & Validasi</div>
            <div class="step-desc">Upload file .xlsx. Sistem akan langsung memvalidasi dan menampilkan pratinjau data.</div>
        </div>
        <div class="step-card">
            <span class="step-num">4</span>
            <div class="step-title">Simpan & Selesai</div>
            <div class="step-desc">Bila status valid, klik <b>Ya, Import Soal</b>. Seluruh soal otomatis masuk ke ujian.</div>
        </div>
    </div>

    <!-- 2. TIGA LEMBAR KERJA -->
    <div class="section-title">2. Memahami 3 Lembar Kerja (Sheet) yang Tersedia</div>
    <div class="sheet-container">
        <div class="sheet-box sheet-box-blue">
            <span class="sheet-name" style="color: #1d4ed8;">1. Sheet "SOAL" (Utama)</span>
            <span class="sheet-for">1 Baris = 1 Nomor Soal</span>
            <div class="sheet-desc">
                Wajib diisi semua soal. Berisi Kode Soal, nomor urut, jenis soal, teks pertanyaan, dan bobot. Kunci jawaban <b>Benar/Salah</b> dan <b>Isian Singkat</b> ditulis langsung di sheet ini.
            </div>
        </div>
        <div class="sheet-box sheet-box-green">
            <span class="sheet-name" style="color: #15803d;">2. Sheet "OPSI" (Pilihan)</span>
            <span class="sheet-for">1 Baris = 1 Opsi Pilihan</span>
            <div class="sheet-desc">
                Khusus soal <b>Pilihan Ganda</b> & <b>Multi-Jawaban</b>. Tulis pilihan A, B, C, dst. Hubungkan dengan <b>Kode Soal</b>. Tandai <b>YA</b> untuk benar dan <b>TIDAK</b> untuk salah.
            </div>
        </div>
        <div class="sheet-box sheet-box-purple">
            <span class="sheet-name" style="color: #7e22ce;">3. Sheet "PASANGAN"</span>
            <span class="sheet-for">1 Baris = 1 Pasangan Cocok</span>
            <div class="sheet-desc">
                Khusus soal <b>Menjodohkan</b>. Hubungkan dengan <b>Kode Soal</b>. Tulis <b>Item Kiri</b> (pertanyaan) dan <b>Pasangan Kanan</b> (jawaban cocok). Minimal 2 pasang per nomor.
            </div>
        </div>
    </div>

    <!-- 3. MATRIKS TIPE SOAL -->
    <div class="section-title">3. Panduan Pengisian Berdasarkan Jenis Soal</div>
    <table class="matrix-table">
        <thead>
            <tr>
                <th style="width: 20%;">Jenis Soal</th>
                <th style="width: 35%;">Sheet SOAL</th>
                <th style="width: 27%;">Sheet OPSI</th>
                <th style="width: 18%;">Sheet PASANGAN</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td><b>Pilihan Ganda</b><br><span style="font-size:6.8pt; color:#64748b;">(Tepat 1 jawaban benar)</span></td>
                <td>Pilih Tipe: <span class="code-box">Pilihan Ganda</span>.<br>Kolom kunci dikosongkan.</td>
                <td>Tulis opsi A, B, C, D.<br>Beri <span class="code-box">YA</span> pada <b>1 jawaban benar</b>, lainnya <span class="code-box">TIDAK</span>.</td>
                <td style="text-align:center; color:#94a3b8;">Kosongkan</td>
            </tr>
            <tr>
                <td><b>Multi-Jawaban</b><br><span style="font-size:6.8pt; color:#64748b;">(Bisa lebih dari 1 benar)</span></td>
                <td>Pilih Tipe: <span class="code-box">Multi-Jawaban</span>.<br>Kolom kunci dikosongkan.</td>
                <td>Tulis opsi A, B, C, D.<br>Beri <span class="code-box">YA</span> pada <b>semua opsi benar</b> (&ge; 1).</td>
                <td style="text-align:center; color:#94a3b8;">Kosongkan</td>
            </tr>
            <tr>
                <td><b>Benar / Salah</b></td>
                <td>Pilih Tipe: <span class="code-box">Benar/Salah</span>.<br>Kolom Kunci Benar/Salah diisi <span class="code-box">BENAR</span> atau <span class="code-box">SALAH</span>.</td>
                <td style="text-align:center; color:#94a3b8;">Kosongkan</td>
                <td style="text-align:center; color:#94a3b8;">Kosongkan</td>
            </tr>
            <tr>
                <td><b>Isian Singkat</b></td>
                <td>Pilih Tipe: <span class="code-box">Isian Singkat</span>.<br>Tulis kata kunci jawaban di kolom Kunci Isian Singkat.</td>
                <td style="text-align:center; color:#94a3b8;">Kosongkan</td>
                <td style="text-align:center; color:#94a3b8;">Kosongkan</td>
            </tr>
            <tr>
                <td><b>Esai / Uraian</b></td>
                <td>Pilih Tipe: <span class="code-box">Esai</span>.<br>Kedua kolom kunci dikosongkan (penilaian manual oleh Trainer).</td>
                <td style="text-align:center; color:#94a3b8;">Kosongkan</td>
                <td style="text-align:center; color:#94a3b8;">Kosongkan</td>
            </tr>
            <tr>
                <td><b>Menjodohkan</b></td>
                <td>Pilih Tipe: <span class="code-box">Menjodohkan</span>.<br>Kolom kunci dikosongkan.</td>
                <td style="text-align:center; color:#94a3b8;">Kosongkan</td>
                <td>Isi Item Kiri dan Pasangan Kanan (min. 2 pasang).</td>
            </tr>
        </tbody>
    </table>

    <!-- 4. CONTOH PENGISIAN -->
    <div class="section-title">4. Contoh Pengisian Baris Excel</div>
    <table>
        <thead>
            <tr>
                <th style="width: 14%;">Sheet</th>
                <th style="width: 10%;">Kode</th>
                <th style="width: 15%;">Kolom Tipe / Opsi</th>
                <th style="width: 44%;">Isi Teks Soal / Opsi</th>
                <th style="width: 17%;">Kunci / Benar</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td rowspan="3"><b>SOAL</b></td>
                <td><code>Q001</code></td>
                <td>Pilihan Ganda</td>
                <td>Ibu kota negara Indonesia saat ini adalah ...</td>
                <td><i>(Kosongkan)</i></td>
            </tr>
            <tr>
                <td><code>Q002</code></td>
                <td>Benar/Salah</td>
                <td>Air mendidih pada suhu 100°C pada tekanan normal.</td>
                <td><b>BENAR</b></td>
            </tr>
            <tr>
                <td><code>Q003</code></td>
                <td>Menjodohkan</td>
                <td>Pasangkan nama negara dengan ibu kotanya.</td>
                <td><i>(Kosongkan)</i></td>
            </tr>
            <tr>
                <td rowspan="3"><b>OPSI</b><br><span style="font-size:6.5pt;color:#64748b;">(Untuk Q001)</span></td>
                <td><code>Q001</code></td>
                <td>Opsi: <b>A</b></td>
                <td>Bandung</td>
                <td><b>TIDAK</b></td>
            </tr>
            <tr>
                <td><code>Q001</code></td>
                <td>Opsi: <b>B</b></td>
                <td>Jakarta</td>
                <td><b style="color:#16a34a;">YA</b> (Kunci)</td>
            </tr>
            <tr>
                <td><code>Q001</code></td>
                <td>Opsi: <b>C</b></td>
                <td>Surabaya</td>
                <td><b>TIDAK</b></td>
            </tr>
            <tr>
                <td rowspan="2"><b>PASANGAN</b><br><span style="font-size:6.5pt;color:#64748b;">(Untuk Q003)</span></td>
                <td><code>Q003</code></td>
                <td>Pasangan: <b>1</b></td>
                <td>Item Kiri: <i>Indonesia</i> &nbsp;&rarr;&nbsp; Pasangan Kanan: <i>Jakarta</i></td>
                <td>Pasangan Cocok</td>
            </tr>
            <tr>
                <td><code>Q003</code></td>
                <td>Pasangan: <b>2</b></td>
                <td>Item Kiri: <i>Jepang</i> &nbsp;&rarr;&nbsp; Pasangan Kanan: <i>Tokyo</i></td>
                <td>Pasangan Cocok</td>
            </tr>
        </tbody>
    </table>

    <!-- 5. 4 HAL PENTING -->
    <div class="rule-card">
        <h4>⚠️ 4 Aturan Utama Agar File Tidak Ditolak Sistem:</h4>
        <ul class="rule-list">
            <li><b>Gunakan File Resmi (.xlsx):</b> Jangan mengubah nama sheet (<code>SOAL</code>, <code>OPSI</code>, <code>PASANGAN</code>) atau judul kolom.</li>
            <li><b>Urutan Runtut Tanpa Lompat:</b> Nomor urut soal di sheet SOAL harus 1, 2, 3... berurutan tanpa jeda.</li>
            <li><b>Jangan Pakai Rumus / Merge:</b> Dilarang menggabungkan sel (Merge Cell) atau memakai formula (=SUM, dll).</li>
            <li><b>Kode Soal Harus Sesuai:</b> Kode Soal di sheet OPSI dan PASANGAN harus sama persis dengan yang di sheet SOAL.</li>
        </ul>
    </div>

    <!-- FOOTER -->
    <div class="footer">
        <div>LMS Nusamitra &bull; Panduan Resmi Import Soal Excel &bull; Dokumen Ringkas Versi 1.0</div>
        <div>Dapat dicetak (A4) atau dibagikan langsung ke Pembuat Soal</div>
    </div>

</body>
</html>`;

async function generatePdf() {
    const launchOptions = {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
    };
    if (executablePath) {
        launchOptions.executablePath = executablePath;
    }

    const browser = await puppeteer.launch(launchOptions);
    const page = await browser.newPage();
    
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const outputDir = path.resolve('public');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const outputPath = path.resolve(outputDir, 'Panduan_Import_Soal_Excel.pdf');

    await page.pdf({
        path: outputPath,
        format: 'A4',
        printBackground: true,
        margin: {
            top: '8mm',
            right: '10mm',
            bottom: '8mm',
            left: '10mm'
        }
    });

    await browser.close();
    console.log('PDF generated successfully at:', outputPath);
}

generatePdf().catch((err) => {
    console.error('Failed to generate PDF:', err);
    process.exit(1);
});
