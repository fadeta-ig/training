import {
    Document,
    Packer,
    Paragraph,
    TextRun,
    HeadingLevel,
    AlignmentType,
    Table,
    TableRow,
    TableCell,
    BorderStyle,
    WidthType,
    ShadingType,
    Header,
    Footer,
    PageNumber,
    NumberFormat,
} from 'docx';
import fs from 'fs';
import path from 'path';

// Typography & Palette
const FONT_NAME = 'Calibri';
const COLOR_PRIMARY = '1E3A8A'; // Deep Blue
const COLOR_TEXT = '1E293B'; // Slate-800
const COLOR_MUTED = '64748B'; // Slate-500
const COLOR_ACCENT = '0D9488'; // Teal
const COLOR_WARNING = 'B45309'; // Amber-700
const BG_HEADER = 'F1F5F9'; // Slate-100
const BG_CALLOUT = 'F8FAFC'; // Slate-50
const BG_ALERT = 'FEF3C7'; // Amber-100
const COLOR_BORDER = 'CBD5E1';

const LINE_SPACING_1_25 = 300;
const LINE_SPACING_SINGLE = 240;

function createDocHeader() {
    return new Header({
        children: [
            new Paragraph({
                alignment: AlignmentType.RIGHT,
                spacing: { after: 120 },
                children: [
                    new TextRun({
                        text: 'PANDUAN PESERTA UJIAN ONLINE LMS',
                        font: FONT_NAME,
                        size: 18,
                        color: COLOR_MUTED,
                        bold: true,
                    }),
                ],
            }),
        ],
    });
}

function createDocFooter() {
    return new Footer({
        children: [
            new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 120 },
                children: [
                    new TextRun({
                        text: 'Halaman ',
                        font: FONT_NAME,
                        size: 18,
                        color: COLOR_MUTED,
                    }),
                    new TextRun({
                        children: [PageNumber.CURRENT],
                        font: FONT_NAME,
                        size: 18,
                        color: COLOR_MUTED,
                        bold: true,
                    }),
                    new TextRun({
                        text: ' dari ',
                        font: FONT_NAME,
                        size: 18,
                        color: COLOR_MUTED,
                    }),
                    new TextRun({
                        children: [PageNumber.TOTAL_PAGES],
                        font: FONT_NAME,
                        size: 18,
                        color: COLOR_MUTED,
                        bold: true,
                    }),
                ],
            }),
        ],
    });
}

function createTitle(text) {
    return new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 240, after: 120, line: LINE_SPACING_1_25 },
        children: [
            new TextRun({
                text: text,
                font: FONT_NAME,
                size: 36, // 18pt
                bold: true,
                color: COLOR_PRIMARY,
            }),
        ],
    });
}

function createSubtitle(text) {
    return new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 60, after: 360, line: LINE_SPACING_1_25 },
        children: [
            new TextRun({
                text: text,
                font: FONT_NAME,
                size: 24, // 12pt
                italics: true,
                color: COLOR_MUTED,
            }),
        ],
    });
}

function createSectionHeading(text) {
    return new Paragraph({
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 360, after: 140, line: LINE_SPACING_1_25 },
        children: [
            new TextRun({
                text: text,
                font: FONT_NAME,
                size: 28, // 14pt
                bold: true,
                color: COLOR_PRIMARY,
            }),
        ],
    });
}

function createSubSectionHeading(text) {
    return new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 240, after: 100, line: LINE_SPACING_1_25 },
        children: [
            new TextRun({
                text: text,
                font: FONT_NAME,
                size: 24, // 12pt
                bold: true,
                color: COLOR_ACCENT,
            }),
        ],
    });
}

function createParagraph(text, boldPrefix = '') {
    const children = [];
    if (boldPrefix) {
        children.push(
            new TextRun({
                text: boldPrefix + ' ',
                font: FONT_NAME,
                size: 22,
                bold: true,
                color: COLOR_TEXT,
            })
        );
    }
    children.push(
        new TextRun({
            text: text,
            font: FONT_NAME,
            size: 22,
            color: COLOR_TEXT,
        })
    );

    return new Paragraph({
        alignment: AlignmentType.JUSTIFY,
        spacing: { before: 80, after: 80, line: LINE_SPACING_1_25 },
        children,
    });
}

function createBulletItem(boldText, normalText) {
    return new Paragraph({
        bullet: { level: 0 },
        spacing: { before: 60, after: 60, line: LINE_SPACING_1_25 },
        children: [
            new TextRun({
                text: boldText + ': ',
                font: FONT_NAME,
                size: 22,
                bold: true,
                color: COLOR_TEXT,
            }),
            new TextRun({
                text: normalText,
                font: FONT_NAME,
                size: 22,
                color: COLOR_TEXT,
            }),
        ],
    });
}

function createNumberedStep(stepNum, title, description) {
    return new Paragraph({
        spacing: { before: 120, after: 80, line: LINE_SPACING_1_25 },
        children: [
            new TextRun({
                text: `Langkah ${stepNum}. ${title}`,
                font: FONT_NAME,
                size: 22,
                bold: true,
                color: COLOR_PRIMARY,
            }),
            new TextRun({
                text: `\n${description}`,
                font: FONT_NAME,
                size: 22,
                color: COLOR_TEXT,
            }),
        ],
    });
}

function createCalloutBox(title, message, isWarning = false) {
    const borderColor = isWarning ? 'F59E0B' : COLOR_PRIMARY;
    const bgColor = isWarning ? BG_ALERT : BG_CALLOUT;
    const titleColor = isWarning ? COLOR_WARNING : COLOR_PRIMARY;

    return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
            new TableRow({
                children: [
                    new TableCell({
                        shading: { fill: bgColor, type: ShadingType.CLEAR },
                        borders: {
                            top: { style: BorderStyle.NONE },
                            right: { style: BorderStyle.NONE },
                            bottom: { style: BorderStyle.NONE },
                            left: { style: BorderStyle.SINGLE, size: 24, color: borderColor },
                        },
                        margins: { top: 140, bottom: 140, left: 200, right: 140 },
                        children: [
                            new Paragraph({
                                spacing: { after: 60 },
                                children: [
                                    new TextRun({
                                        text: (isWarning ? '⚠️ ' : '💡 ') + title,
                                        font: FONT_NAME,
                                        size: 22,
                                        bold: true,
                                        color: titleColor,
                                    }),
                                ],
                            }),
                            new Paragraph({
                                children: [
                                    new TextRun({
                                        text: message,
                                        font: FONT_NAME,
                                        size: 20,
                                        color: COLOR_TEXT,
                                    }),
                                ],
                            }),
                        ],
                    }),
                ],
            }),
        ],
    });
}

function generateParticipantDocx() {
    const doc = new Document({
        styles: {
            default: {
                document: {
                    run: {
                        font: FONT_NAME,
                        size: 22,
                        color: COLOR_TEXT,
                    },
                },
            },
        },
        sections: [
            {
                properties: {
                    page: {
                        margin: {
                            top: 1440, // 1 inch
                            bottom: 1440,
                            left: 1440,
                            right: 1440,
                        },
                    },
                },
                headers: { default: createDocHeader() },
                footers: { default: createDocFooter() },
                children: [
                    createTitle('PANDUAN RINGKAS PESERTA UJIAN ONLINE'),
                    createSubtitle('Petunjuk Instalasi, Tata Cara Pengerjaan Ujian, & Troubleshooting LMS'),

                    createCalloutBox(
                        'PENTING DIBACA SEBELUM UJIAN',
                        'Ujian ini menggunakan sistem keamanan terproteksi (Safe Exam Browser / Aplikasi Ujian Khusus). Pastikan Anda telah menginstal aplikasi pendukung di perangkat Anda sebelum jadwal ujian dimulai.',
                        true
                    ),

                    createSectionHeading('1. Persiapan Perangkat & Akun'),
                    createParagraph('Sebelum memulai ujian, pastikan hal-hal berikut telah siap:'),
                    createBulletItem('Perangkat Ujian', 'Laptop/PC (Windows 10/11 atau macOS) ATAU Smartphone Android dengan baterai minimal 80% / terhubung charger.'),
                    createBulletItem('Koneksi Internet', 'Gunakan koneksi internet (Wi-Fi/Paket Data) yang stabil dan memiliki kuota mencukupi.'),
                    createBulletItem('Akun Peserta', 'Siapkan Email dan Password atau NIP Anda yang telah terdaftar di sistem LMS.'),

                    createSectionHeading('2. Panduan Ujian via Laptop / PC (Safe Exam Browser - SEB)'),
                    createParagraph('Bagi peserta yang menggunakan Laptop atau Komputer, wajib menggunakan aplikasi Safe Exam Browser (SEB v3.7+):'),

                    createNumberedStep(
                        '1',
                        'Instal Safe Exam Browser (SEB)',
                        'Unduh dan instal SEB versi 3.7 (atau terbaru) melalui link resmi yang dibagikan oleh Admin/Pengawas, atau buka website safeexambrowser.org. Lakukan instalasi hingga selesai.'
                    ),
                    createNumberedStep(
                        '2',
                        'Login ke Web LMS',
                        'Buka browser biasa (Chrome/Edge/Firefox) di laptop Anda, akses alamat web LMS, lalu login menggunakan akun peserta Anda.'
                    ),
                    createNumberedStep(
                        '3',
                        'Pilih Sesi Ujian & Unduh File Konfigurasi SEB',
                        'Masuk ke menu Dashboard > pilih Sesi Pelatihan/Ujian Anda > klik tombol "Unduh Konfigurasi SEB". Sebuah file dengan akhiran ".seb" akan terunduh.'
                    ),
                    createNumberedStep(
                        '4',
                        'Buka File Konfigurasi SEB',
                        'Klik ganda (double-click) file .seb yang baru saja diunduh. Layar laptop akan otomatis terkunci dan membuka halaman ujian LMS secara aman.'
                    ),
                    createNumberedStep(
                        '5',
                        'Kerjakan Soal Ujian',
                        'Login kembali jika diminta, lalu mulailah mengerjakan soal. Jawaban tersimpan otomatis setiap kali Anda berpindah nomor soal.'
                    ),
                    createNumberedStep(
                        '6',
                        'Kirim Jawaban & Keluar dari SEB',
                        'Setelah seluruh soal terjawab, klik tombol "Kirim Jawaban Ujian". Setelah selesai, klik tombol "Keluar Aplikasi SEB" atau tekan tombol keyboard Ctrl+Q (Windows) / Cmd+Q (Mac).'
                    ),

                    createCalloutBox(
                        'Tips Laptop / PC',
                        'Jangan mencoba berpindah aplikasi atau menekan tombol pintasan keyboard lain saat SEB aktif karena dapat memicu peringatan keamanan sistem.',
                        false
                    ),

                    createSectionHeading('3. Panduan Ujian via HP Android (File APK Ujian)'),
                    createParagraph('Bagi peserta yang menggunakan Smartphone Android menggunakan file APK yang disediakan:'),

                    createNumberedStep(
                        '1',
                        'Unduh & Pasang File APK',
                        'Unduh file APK yang telah dibagikan panitia melalui WhatsApp/Google Drive. Buka file APK tersebut dan pilih "Install". Jika muncul notifikasi keamanan, aktifkan "Izinkan instalasi dari sumber ini" (Allow from unknown sources).'
                    ),
                    createNumberedStep(
                        '2',
                        'Buka Aplikasi Ujian & Masukkan URL (Jika Diminta)',
                        'Buka aplikasi yang telah terpasang. Jika aplikasi meminta alamat server/URL ujian, masukkan link LMS yang diberikan panitia.'
                    ),
                    createNumberedStep(
                        '3',
                        'Login & Kerjakan Ujian',
                        'Login dengan akun Anda, masuk ke sesi ujian, dan kerjakan soal secara berurutan hingga selesai.'
                    ),
                    createNumberedStep(
                        '4',
                        'Submit Jawaban & Selesai',
                        'Tekan tombol "Kirim / Submit Jawaban" di halaman terakhir. Setelah konfirmasi selesai, Anda dapat menutup aplikasi.'
                    ),

                    createCalloutBox(
                        'Peringatan Pengguna HP',
                        'Dilarang menekan tombol Home, berpindah ke aplikasi pesan (WhatsApp), atau menerima panggilan telepon saat ujian berlangsung, karena aplikasi akan otomatis terkunci.',
                        true
                    ),

                    createSectionHeading('4. Tata Tertib & Ketentuan Ujian'),
                    createBulletItem('Tepat Waktu', 'Masuk ke sistem minimal 15 menit sebelum waktu ujian dimulai untuk persiapan.'),
                    createBulletItem('Integritas & Kejujuran', 'Dilarang membuka catatan, tab browser lain, atau bantuan dari pihak ketiga.'),
                    createBulletItem('Penyimpanan Otomatis', 'Jawaban Anda tersimpan otomatis di server. Jika terjadi kendala jaringan, segera refresh/hubungi admin tanpa panik.'),
                    createBulletItem('Batas Waktu', 'Perhatikan timer hitung mundur di bagian atas layar. Ujian akan tersubmit otomatis jika waktu habis.'),

                    createSectionHeading('5. Solusi Cepat Kendala Teknis (Troubleshooting)'),
                    createParagraph('Jika Anda mengalami kendala saat ujian:', 'Solusi Praktis:'),
                    createBulletItem('Koneksi Terputus / Error Loading', 'Periksa koneksi internet Anda. Muat ulang halaman (Refresh). Jawaban yang sudah dipilih sebelumnya aman tersimpan di server.'),
                    createBulletItem('SEB Tidak Bisa Terbuka Otomatis', 'Pastikan aplikasi SEB sudah terinstal di laptop. Jika double-click file .seb tidak merespons, buka aplikasi SEB terlebih dahulu lalu buka file .seb melalui opsi Open.'),
                    createBulletItem('APK Tidak Bisa Diinstal di Android', 'Buka Pengaturan HP > Keamanan / Privasi > Aktifkan "Instal Aplikasi dari Sumber Tidak Dikenal" untuk browser/file manager Anda.'),
                    createBulletItem('Lupa Password / Akun Tidak Ditemukan', 'Segera hubungi Panitia / Pengawas Ujian melalui WhatsApp pengawas untuk reset password.'),

                    createParagraph('Selamat menempuh ujian. Semoga sukses dan mendapatkan hasil terbaik!'),
                ],
            },
        ],
    });

    return doc;
}

async function main() {
    const doc = generateParticipantDocx();
    const buffer = await Packer.toBuffer(doc);
    const outputPath = path.join(process.cwd(), 'Panduan_Ujian_Peserta_LMS.docx');
    fs.writeFileSync(outputPath, buffer);
    console.log(`[SUCCESS] File panduan berhasil dibuat di: ${outputPath}`);
}

main().catch((err) => {
    console.error('[ERROR] Gagal membuat file panduan:', err);
    process.exit(1);
});
