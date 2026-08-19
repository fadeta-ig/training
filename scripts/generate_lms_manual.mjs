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

// Constants for styling
const FONT_NAME = 'Times New Roman';
const TITLE_SIZE = 28; // 14pt
const HEADING_SIZE = 28; // 14pt
const BODY_SIZE = 24; // 12pt
const TABLE_SIZE = 22; // 11pt
const SMALL_SIZE = 20; // 10pt

const LINE_SPACING_1_5 = 360; // 1.5 line spacing in twips (240 * 1.5 = 360)
const LINE_SPACING_SINGLE = 240;

const COLOR_PRIMARY = '0F172A'; // Slate-900
const COLOR_MUTED = '475569'; // Slate-600
const COLOR_BORDER = 'CBD5E1'; // Slate-300
const BG_HEADER = 'F1F5F9'; // Slate-100
const BG_CALLOUT = 'F8FAFC'; // Slate-50

// Helper functions for Document elements
function createTitle(text) {
    return new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 360, after: 180, line: LINE_SPACING_1_5 },
        children: [
            new TextRun({
                text: text,
                font: FONT_NAME,
                size: 32, // 16pt for main cover title
                bold: true,
                color: COLOR_PRIMARY,
            }),
        ],
    });
}

function createSubtitle(text) {
    return new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 120, after: 360, line: LINE_SPACING_1_5 },
        children: [
            new TextRun({
                text: text,
                font: FONT_NAME,
                size: HEADING_SIZE, // 14pt
                italics: true,
                color: COLOR_MUTED,
            }),
        ],
    });
}

function createHeading1(text) {
    return new Paragraph({
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.LEFT,
        spacing: { before: 400, after: 180, line: LINE_SPACING_1_5 },
        children: [
            new TextRun({
                text: text,
                font: FONT_NAME,
                size: HEADING_SIZE, // 14pt
                bold: true,
                color: COLOR_PRIMARY,
            }),
        ],
    });
}

function createHeading2(text) {
    return new Paragraph({
        heading: HeadingLevel.HEADING_2,
        alignment: AlignmentType.LEFT,
        spacing: { before: 300, after: 140, line: LINE_SPACING_1_5 },
        children: [
            new TextRun({
                text: text,
                font: FONT_NAME,
                size: HEADING_SIZE, // 14pt
                bold: true,
                color: COLOR_PRIMARY,
            }),
        ],
    });
}

function createHeading3(text) {
    return new Paragraph({
        heading: HeadingLevel.HEADING_3,
        alignment: AlignmentType.LEFT,
        spacing: { before: 240, after: 100, line: LINE_SPACING_1_5 },
        children: [
            new TextRun({
                text: text,
                font: FONT_NAME,
                size: HEADING_SIZE, // 14pt
                bold: true,
                italics: true,
                color: COLOR_PRIMARY,
            }),
        ],
    });
}

function createParagraph(text, options = {}) {
    const isBold = options.bold || false;
    const isItalic = options.italic || false;
    const alignment = options.alignment || AlignmentType.JUSTIFIED;
    const before = options.before !== undefined ? options.before : 120;
    const after = options.after !== undefined ? options.after : 120;

    return new Paragraph({
        alignment: alignment,
        spacing: { before: before, after: after, line: LINE_SPACING_1_5 },
        children: [
            new TextRun({
                text: text,
                font: FONT_NAME,
                size: BODY_SIZE, // 12pt
                bold: isBold,
                italics: isItalic,
                color: COLOR_PRIMARY,
            }),
        ],
    });
}

function createRichParagraph(runs, options = {}) {
    const alignment = options.alignment || AlignmentType.JUSTIFIED;
    const before = options.before !== undefined ? options.before : 120;
    const after = options.after !== undefined ? options.after : 120;

    return new Paragraph({
        alignment: alignment,
        spacing: { before: before, after: after, line: LINE_SPACING_1_5 },
        children: runs.map((r) =>
            new TextRun({
                text: r.text,
                font: FONT_NAME,
                size: r.size || BODY_SIZE, // 12pt
                bold: r.bold || false,
                italics: r.italic || false,
                color: r.color || COLOR_PRIMARY,
            })
        ),
    });
}

function createBulletItem(boldPrefix, normalText) {
    return new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        bullet: { level: 0 },
        spacing: { before: 80, after: 80, line: LINE_SPACING_1_5 },
        children: [
            new TextRun({
                text: boldPrefix ? `${boldPrefix} ` : '',
                font: FONT_NAME,
                size: BODY_SIZE,
                bold: true,
                color: COLOR_PRIMARY,
            }),
            new TextRun({
                text: normalText,
                font: FONT_NAME,
                size: BODY_SIZE,
                color: COLOR_PRIMARY,
            }),
        ],
    });
}

function createNumberedStep(stepNum, title, description) {
    return new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        spacing: { before: 140, after: 100, line: LINE_SPACING_1_5 },
        children: [
            new TextRun({
                text: `Langkah ${stepNum}: ${title} — `,
                font: FONT_NAME,
                size: BODY_SIZE,
                bold: true,
                color: COLOR_PRIMARY,
            }),
            new TextRun({
                text: description,
                font: FONT_NAME,
                size: BODY_SIZE,
                color: COLOR_PRIMARY,
            }),
        ],
    });
}

function createCallout(title, message, type = 'info') {
    let borderColor = '3B82F6'; // Blue
    let icon = '💡 PETUNJUK:';
    if (type === 'warning') {
        borderColor = 'F59E0B'; // Amber
        icon = '⚠️ PERHATIAN PENTING:';
    } else if (type === 'tip') {
        borderColor = '10B981'; // Green
        icon = '📌 TIPS PRAKTIS:';
    } else if (type === 'security') {
        borderColor = '6366F1'; // Indigo
        icon = '🔒 CATATAN KEAMANAN:';
    }

    const table = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
            top: { style: BorderStyle.NONE, size: 0, color: 'auto' },
            right: { style: BorderStyle.NONE, size: 0, color: 'auto' },
            bottom: { style: BorderStyle.NONE, size: 0, color: 'auto' },
            left: { style: BorderStyle.SINGLE, size: 24, color: borderColor },
        },
        rows: [
            new TableRow({
                children: [
                    new TableCell({
                        shading: { fill: BG_CALLOUT, type: ShadingType.CLEAR },
                        margins: { top: 140, bottom: 140, left: 200, right: 180 },
                        children: [
                            new Paragraph({
                                spacing: { before: 40, after: 60, line: LINE_SPACING_1_5 },
                                children: [
                                    new TextRun({
                                        text: `${icon} ${title}`,
                                        font: FONT_NAME,
                                        size: BODY_SIZE,
                                        bold: true,
                                        color: COLOR_PRIMARY,
                                    }),
                                ],
                            }),
                            new Paragraph({
                                alignment: AlignmentType.JUSTIFIED,
                                spacing: { before: 40, after: 40, line: LINE_SPACING_1_5 },
                                children: [
                                    new TextRun({
                                        text: message,
                                        font: FONT_NAME,
                                        size: BODY_SIZE,
                                        color: COLOR_MUTED,
                                    }),
                                ],
                            }),
                        ],
                    }),
                ],
            }),
        ],
    });

    return table;
}

function createTable(headers, rows, colWidthsPercent = []) {
    const tableRows = [];

    // Header Row
    const headerCells = headers.map((h, i) => {
        return new TableCell({
            shading: { fill: '1E293B', type: ShadingType.CLEAR },
            margins: { top: 120, bottom: 120, left: 140, right: 140 },
            width: colWidthsPercent[i]
                ? { size: colWidthsPercent[i], type: WidthType.PERCENTAGE }
                : undefined,
            children: [
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 40, after: 40, line: LINE_SPACING_SINGLE },
                    children: [
                        new TextRun({
                            text: h,
                            font: FONT_NAME,
                            size: TABLE_SIZE,
                            bold: true,
                            color: 'FFFFFF',
                        }),
                    ],
                }),
            ],
        });
    });

    tableRows.push(new TableRow({ children: headerCells }));

    // Data Rows
    rows.forEach((row, rIdx) => {
        const bg = rIdx % 2 === 0 ? 'FFFFFF' : 'F8FAFC';
        const cells = row.map((cellText, cIdx) => {
            const isCenter = cIdx === 0 || cIdx === row.length - 1;
            return new TableCell({
                shading: { fill: bg, type: ShadingType.CLEAR },
                margins: { top: 100, bottom: 100, left: 140, right: 140 },
                borders: {
                    top: { style: BorderStyle.SINGLE, size: 4, color: COLOR_BORDER },
                    bottom: { style: BorderStyle.SINGLE, size: 4, color: COLOR_BORDER },
                    left: { style: BorderStyle.SINGLE, size: 4, color: COLOR_BORDER },
                    right: { style: BorderStyle.SINGLE, size: 4, color: COLOR_BORDER },
                },
                width: colWidthsPercent[cIdx]
                    ? { size: colWidthsPercent[cIdx], type: WidthType.PERCENTAGE }
                    : undefined,
                children: [
                    new Paragraph({
                        alignment: isCenter ? AlignmentType.CENTER : AlignmentType.JUSTIFIED,
                        spacing: { before: 40, after: 40, line: LINE_SPACING_1_5 },
                        children: [
                            new TextRun({
                                text: String(cellText),
                                font: FONT_NAME,
                                size: TABLE_SIZE,
                                color: COLOR_PRIMARY,
                            }),
                        ],
                    }),
                ],
            });
        });

        tableRows.push(new TableRow({ children: cells }));
    });

    return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: tableRows,
    });
}

function createDivider() {
    return new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 180, after: 180 },
        children: [
            new TextRun({
                text: '• • •',
                font: FONT_NAME,
                size: BODY_SIZE,
                color: COLOR_BORDER,
            }),
        ],
    });
}

// Generate the whole document
console.log('Generating comprehensive LMS Manual...');

const docChildren = [];

// ==========================================
// COVER / TITLE SECTION
// ==========================================
docChildren.push(new Paragraph({ spacing: { before: 800, after: 100 } }));
docChildren.push(createTitle('BUKU PANDUAN PENGGUNA SISTEM LEARNING MANAGEMENT SYSTEM (LMS) NUSAMITRA'));
docChildren.push(createSubtitle('Panduan Komprehensif dan Tutorial Langkah Demi Langkah Pengoperasian Sistem Pelatihan & Ujian Online untuk Administrator, Trainer, dan Peserta'));
docChildren.push(createDivider());

docChildren.push(
    createRichParagraph([
        { text: 'Penerbit / Pengembang: ', bold: true },
        { text: 'Tim Pengembang Sistem LMS Nusamitra\n' },
        { text: 'Target Pembaca: ', bold: true },
        { text: 'Administrator Sistem, Trainer / Instruktur, dan Peserta Pelatihan (Trainee)\n' },
        { text: 'Versi Rilis Dokumen: ', bold: true },
        { text: 'Edisi 2.0 (Terbaru & Lengkap) — Tahun 2026\n' },
        { text: 'Standar Format Dokumen: ', bold: true },
        { text: 'Font Times New Roman, Headings 14pt Bold, Body Text 12pt Justified, Line Spacing 1.5' },
    ], { alignment: AlignmentType.CENTER, before: 200, after: 400 })
);

docChildren.push(createDivider());

// ==========================================
// KATA PENGANTAR
// ==========================================
docChildren.push(createHeading1('KATA PENGANTAR'));
docChildren.push(
    createParagraph(
        'Puji dan syukur kami panjatkan atas terselesaikannya penyusunan Buku Panduan Pengguna Sistem Learning Management System (LMS) Nusamitra. Buku ini disusun sebagai pedoman operasional lengkap yang dirancang khusus untuk memandu seluruh pihak yang terlibat dalam ekosistem pelatihan digital, mulai dari Administrator yang mengelola keseluruhan data dan infrastruktur, Trainer yang memantau proses belajar dan mengevaluasi penilaian, hingga Peserta yang menjalankan pembelajaran materi dan menempuh ujian kompetensi.'
    )
);
docChildren.push(
    createParagraph(
        'Sistem LMS Nusamitra hadir sebagai solusi modern yang menggabungkan fleksibilitas penyampaian materi multimedia, efektivitas bank soal interaktif dengan berbagai jenis soal mutakhir, otomatisasi evaluasi, integrasi keamanan tingkat tinggi melalui Safe Exam Browser (SEB) dan Anti-Cheat, serta pemantauan visual terpusat (Live Proctoring). Seluruh panduan di dalam buku ini disusun dengan bahasa yang komunikatif, terstruktur, runtut, dan mudah dipahami agar setiap pengguna dapat memaksimalkan fitur-fitur yang tersedia tanpa kendala teknis yang berarti.'
    )
);
docChildren.push(
    createParagraph(
        'Semoga buku panduan ini dapat memberikan manfaat nyata, meningkatkan efisiensi operasional pelatihan, serta menjamin terselenggaranya proses evaluasi pembelajaran yang adil, kredibel, dan transparan.'
    )
);

docChildren.push(createDivider());

// ==========================================
// DAFTAR ISI RINGKAS
// ==========================================
docChildren.push(createHeading1('DAFTAR ISI RINGKAS BUKU PANDUAN'));
const tocData = [
    ['BAB I', 'PENDAHULUAN & ARSITEKTUR SISTEM', 'Pengenalan LMS, Keamanan, & Matriks Peran'],
    ['BAB II', 'PANDUAN LENGKAP ROLE ADMINISTRATOR (ADMIN)', 'Overview, Materi, Bank Soal, Sesi, Proctoring, Nilai, & User'],
    ['BAB III', 'PANDUAN LENGKAP ROLE INSTRUKTUR / PENGAJAR (TRAINER)', 'Pemantauan Sesi, Live Proctoring, & Penilaian Manual Esai'],
    ['BAB IV', 'PANDUAN LENGKAP ROLE PESERTA (TRAINEE)', 'Akses Portal, Pembelajaran Materi, Ujian Online, & Riwayat Nilai'],
    ['BAB V', 'FITUR KHUSUS, KEAMANAN, & PANDUAN KENDALA (TROUBLESHOOTING)', 'Safe Exam Browser, Anti-Cheat, Solusi Kendala, & FAQ'],
];
docChildren.push(createTable(['Bagian', 'Judul Bab', 'Cakupan Pembahasan'], tocData, [15, 45, 40]));

docChildren.push(createDivider());

// ==========================================
// BAB I: PENDAHULUAN & ARSITEKTUR SISTEM
// ==========================================
docChildren.push(createHeading1('BAB I: PENDAHULUAN & ARSITEKTUR SISTEM'));

docChildren.push(createHeading2('1.1 Mengenal Sistem LMS Nusamitra'));
docChildren.push(
    createParagraph(
        'LMS Nusamitra adalah sebuah platform Learning Management System berbasis web generasi terbaru yang dirancang untuk mendukung pelatihan korporat, sertifikasi profesi, dan evaluasi pembelajaran secara terpadu. Sistem ini dibangun dengan fokus utama pada keandalan performa, kemudahan navigasi antarmuka, modularitas konten, dan integritas pengujian online.'
    )
);
docChildren.push(
    createParagraph(
        'Dengan mengusung konsep modular learning path, materi pembelajaran (Trainings) dan bank soal ujian (Exams) dapat dikelompokkan secara terstruktur ke dalam modul-modul dinamis. Peserta dapat mempelajari materi secara bertahap dan mengerjakan ujian evaluasi sesuai dengan jadwal dan aturan yang telah ditetapkan oleh tim pengajar.'
    )
);

docChildren.push(createHeading2('1.2 Teknologi Utama dan Aspek Keamanan'));
docChildren.push(
    createParagraph(
        'Untuk menjamin performa yang responsif, aman, dan dapat diandalkan oleh ribuan pengguna secara bersamaan, platform ini menggunakan kombinasi teknologi modern:'
    )
);
docChildren.push(createBulletItem('Frontend & Server Engine:', 'Menggunakan Next.js App Router dengan React 19 dan Tailwind CSS modern, menghasilkan antarmuka kaca (glassmorphism) yang elegan dan cepat diakses baik pada desktop, tablet, maupun ponsel pintar.'));
docChildren.push(createBulletItem('Database & Data Layer:', 'Didukung oleh MySQL dengan struktur relasional yang terindeks secara optimal untuk menangani penyimpanan jawaban, riwayat progres waktu riil, dan pencatatan audit log secara akurat.'));
docChildren.push(createBulletItem('TipTap Rich Text Engine:', 'Editor konten tingkat lanjut yang mendukung format penulisan kaya, penyisipan gambar, tabel, tautan referensi, dan berkas multimedia secara terintegrasi.'));
docChildren.push(createBulletItem('Safe Exam Browser (SEB) Integration:', 'Dukungan integrasi penuh dengan peramban pengunci layar SEB melalui validasi kunci konfigurasi (SEB Config Key Hash) untuk mencegah peserta membuka aplikasi lain saat ujian.'));
docChildren.push(createBulletItem('Anti-Cheat DOM Protection:', 'Sistem penguncian terintegrasi pada lembar ujian yang menonaktifkan klik kanan (context menu), salin-tempel (copy-paste), pintasan keyboard terlarang, tombol fungsi inspeksi (F12/DevTools), dan pemilihan teks.'));
docChildren.push(createBulletItem('Live Webcam Proctoring:', 'Fitur tangkapan visual berkala yang mengambil foto peserta melalui kamera web secara otomatis selama pengerjaan ujian untuk memastikan keaslian peserta yang mengikuti tes.'));

docChildren.push(createHeading2('1.3 Matriks Peran Pengguna (Role Matrix)'));
docChildren.push(
    createParagraph(
        'Akses ke dalam platform LMS Nusamitra dibagi menjadi 3 (tiga) peran utama yang memiliki wewenang spesifik demi menjaga keamanan dan ketertiban tata kelola pelatihan:'
    )
);

const roleMatrixData = [
    ['Fitur & Menu Sistem', 'Admin', 'Trainer', 'Peserta (Trainee)'],
    ['Dashboard Overview & Statistik', 'Akses Penuh', 'Akses Penuh', 'Akses Khusus Peserta'],
    ['Manajemen Materi (Trainings)', 'Buat, Edit, Hapus', 'Melihat & Membaca', 'Mempelajari Materi'],
    ['Manajemen Bank Soal (Exams)', 'Buat, Edit, Hapus', 'Melihat & Membaca', 'Mengerjakan Ujian'],
    ['Module Builder (Learning Path)', 'Buat, Urutkan, Hapus', 'Melihat Modul', 'Menjalani Modul'],
    ['Session Manager (Jadwal & Sesi)', 'Buat, Edit, Kelola', 'Melihat & Memantau', 'Mengikuti Sesi Terdaftar'],
    ['Live Proctoring Board', 'Akses Penuh', 'Akses Penuh', 'Kamera Wajib Aktif'],
    ['Koreksi Manual Soal Esai', 'Akses Penuh', 'Akses Penuh', 'Melihat Hasil (Jika Dibuka)'],
    ['Override Waktu & Reset Ujian', 'Akses Penuh', 'Akses Penuh', 'Tidak Memiliki Akses'],
    ['Ekspor Laporan Excel (.xlsx)', 'Akses Penuh', 'Akses Penuh', 'Tidak Memiliki Akses'],
    ['Kelola Pengguna (Admin/Trainer)', 'Akses Penuh', 'Tidak Memiliki Akses', 'Tidak Memiliki Akses'],
    ['Kelola Peserta & Import Excel', 'Akses Penuh', 'Melihat Data', 'Edit Profil Sendiri'],
    ['Audit Trail (Log Keamanan)', 'Akses Penuh', 'Tidak Memiliki Akses', 'Tidak Memiliki Akses'],
    ['Riwayat Ujian & Pembahasan', 'Akses Penuh', 'Akses Penuh', 'Melihat Riwayat Pribadi'],
];
docChildren.push(createTable(['Fitur & Menu Sistem', 'Admin', 'Trainer', 'Peserta'], roleMatrixData, [40, 20, 20, 20]));

docChildren.push(createHeading2('1.4 Panduan Navigasi Antarmuka'));
docChildren.push(
    createParagraph(
        'Antarmuka LMS Nusamitra didesain dengan konsep modern, bersih, dan intuitif. Terdapat 3 bagian utama pada layar aplikasi:'
    )
);
docChildren.push(createBulletItem('Sidebar Navigasi (Kiri):', 'Memuat daftar menu utama yang dapat diciutkan (collapse) untuk memperluas area kerja. Pada perangkat mobile, sidebar dapat dibuka-tutup dengan menekan tombol menu pada pojok kiri atas.'));
docChildren.push(createBulletItem('Header Atas (Top Bar):', 'Menampilkan breadcrumb lokasi halaman, ikon lonceng notifikasi interaktif yang menandai pembaruan sistem secara real-time, serta menu profil pengguna beserta tombol keluar (logout).'));
docChildren.push(createBulletItem('Area Konten Utama (Tengah):', 'Menampilkan kartu informasi (glass-cards), tabel data interaktif dengan fitur pencarian instan, filter kategori, serta tombol aksi cepat.'));

docChildren.push(createDivider());

// ==========================================
// BAB II: PANDUAN LENGKAP ROLE ADMINISTRATOR (ADMIN)
// ==========================================
docChildren.push(createHeading1('BAB II: PANDUAN LENGKAP ROLE ADMINISTRATOR (ADMIN)'));
docChildren.push(
    createParagraph(
        'Administrator memegang kendali penuh atas seluruh siklus hidup pembelajaran dan operasional sistem LMS. Bagian ini menjelaskan secara rinci setiap modul kerja yang ada di panel admin.'
    )
);

docChildren.push(createHeading2('2.1 Dashboard Overview & Analitik Sistem'));
docChildren.push(
    createParagraph(
        'Setelah berhasil masuk ke sistem sebagai Admin, Anda akan langsung diarahkan ke halaman Overview (/admin). Halaman ini memberikan pandangan ringkas mengenai status kesehatan sistem:'
    )
);
docChildren.push(createBulletItem('Statistik Total Materi:', 'Menampilkan jumlah materi pelatihan aktif yang siap digunakan di dalam modul.'));
docChildren.push(createBulletItem('Statistik Bank Soal:', 'Menampilkan total bank soal yang telah disusun dan siap diujikan.'));
docChildren.push(createBulletItem('Statistik Sesi Pelatihan:', 'Menampilkan jumlah sesi yang sedang berlangsung, akan datang, maupun yang telah selesai.'));
docChildren.push(createBulletItem('Statistik Total Peserta:', 'Menampilkan jumlah akun peserta yang terdaftar di dalam database.'));
docChildren.push(createBulletItem('Grafik Partisipasi & Kelulusan:', 'Visualisasi tren aktivitas penyelesaian modul dalam 14 hari terakhir serta rasio perbandingan peserta yang lulus versus tidak lulus berdasarkan nilai batas kelulusan (passing grade).'));
docChildren.push(createBulletItem('Daftar Sesi Terkini & Aksi Cepat:', 'Menampilkan 5 sesi terbaru beserta jumlah pesertanya serta pintasan tombol untuk membuat materi, soal, sesi, dan peserta baru dengan satu klik.'));

docChildren.push(createHeading2('2.2 Manajemen Materi Pelatihan (Trainings)'));
docChildren.push(
    createParagraph(
        'Menu Materi (/admin/content) digunakan untuk membuat, mengedit, dan mengorganisasi bacaan, panduan teoritis, berkas dokumen, maupun video pembelajaran yang nantinya dirangkai ke dalam modul.'
    )
);
docChildren.push(createNumberedStep('1', 'Membuka Menu Materi', 'Klik menu Manajemen Pembelajaran pada sidebar, lalu pilih submenu Trainings (Materi).'));
docChildren.push(createNumberedStep('2', 'Menambah Materi Baru', 'Klik tombol Buat Materi Baru pada pojok kanan atas halaman.'));
docChildren.push(createNumberedStep('3', 'Mengisi Judul Materi', 'Ketikkan judul materi yang jelas dan deskriptif pada kolom Judul Materi Pelatihan.'));
docChildren.push(createNumberedStep('4', 'Menyusun Konten dengan TipTap Editor', 'Tuliskan isi materi pada editor teks kaya yang telah disediakan. Anda dapat menggunakan tombol format teks tebal (bold), miring (italic), garis bawah, perataan paragraf (rata kiri, tengah, kanan, justify), format judul (H1, H2, H3), daftar butir (bullet list/numbered list), serta tautan web (hyperlink).'));
docChildren.push(createNumberedStep('5', 'Mengunggah Lampiran Multimedia', 'Pada bagian Media Pendukung, Anda dapat menyisipkan media pembelajaran seperti video rekaman (tautan streaming / file upload), dokumen modul PDF, atau gambar ilustrasi beresolusi tinggi.'));
docChildren.push(createNumberedStep('6', 'Menyimpan Materi', 'Klik tombol Simpan Materi. Sistem akan memvalidasi data dan materi akan langsung muncul di daftar master data.'));

docChildren.push(
    createCallout(
        'Format Media yang Didukung',
        'Pastikan dokumen PDF berukuran wajar (di bawah 25 MB) agar cepat dibuka oleh peserta pada perangkat seluler. Untuk video dengan durasi panjang, disarankan menggunakan tautan streaming agar hemat bandwidth.',
        'tip'
    )
);

docChildren.push(createHeading2('2.3 Manajemen Bank Soal (Exams) & 6 Tipe Soal'));
docChildren.push(
    createParagraph(
        'Menu Bank Soal (/admin/exams) adalah pusat pembuatan dan perakitan butir soal evaluasi. LMS Nusamitra mendukung 6 (enam) jenis soal modern yang sangat fleksibel:'
    )
);

const questionTypesData = [
    ['Tipe Soal', 'Karakteristik & Mekanisme', 'Metode Penilaian'],
    ['Pilihan Ganda (Single Choice)', 'Peserta memilih 1 (satu) opsi jawaban yang paling benar di antara opsi A, B, C, D, E.', 'Otomatis oleh sistem'],
    ['Pilihan Ganda Kompleks (Multiple Select)', 'Peserta dapat memilih lebih dari satu opsi jawaban benar (checkbox).', 'Otomatis oleh sistem'],
    ['Benar / Salah (True / False)', 'Pernyataan dengan dua opsi keputusan: Benar atau Salah.', 'Otomatis oleh sistem'],
    ['Isian Singkat (Short Answer)', 'Peserta mengetikkan jawaban kata/frasa pendek ke dalam kotak input.', 'Otomatis (string matching)'],
    ['Esai / Uraian (Essay)', 'Peserta menguraikan jawaban secara komprehensif pada area teks panjang.', 'Manual oleh Admin/Trainer'],
    ['Menjodohkan (Matching)', 'Peserta memasangkan premis di sisi kiri dengan respon yang tepat di sisi kanan.', 'Otomatis oleh sistem'],
];
docChildren.push(createTable(['Tipe Soal', 'Karakteristik', 'Metode Penilaian'], questionTypesData, [25, 50, 25]));

docChildren.push(
    createParagraph(
        'Langkah-langkah pembuatan Bank Soal dan butir pertanyaan:'
    )
);
docChildren.push(createNumberedStep('1', 'Membuat Bank Soal Baru', 'Masuk ke menu Exams (Bank Soal), lalu klik Buat Bank Soal. Tentukan Judul Ujian, Durasi Pengerjaan (dalam menit), Nilai Batas Kelulusan (Passing Grade, misal: 75.00), opsi Izinkan Remedial, dan Batas Maksimal Percobaan (Max Attempts). Klik Simpan.'));
docChildren.push(createNumberedStep('2', 'Masuk ke Pengelola Butir Soal', 'Pada daftar ujian, klik tombol Kelola Soal (ikon edit pertanyaan) untuk masuk ke halaman /admin/exams/[id]/questions.'));
docChildren.push(createNumberedStep('3', 'Memilih Jenis Soal', 'Klik tombol Tambah Soal Baru. Pilih salah satu dari 6 tipe soal yang diinginkan pada menu dropdown.'));
docChildren.push(createNumberedStep('4', 'Mengisi Pertanyaan & Bobot Poin', 'Tuliskan teks soal secara jelas. Jika memerlukan gambar peraga, unggah berkas gambar pada kolom Gambar Soal. Tentukan bobot poin soal (misal: 10 poin).'));
docChildren.push(createNumberedStep('5', 'Mengatur Opsi Jawaban & Kunci Jawaban', 'Untuk pilihan ganda, masukkan teks pilihan dan tandai opsi yang menjadi kunci jawaban benar. Untuk soal menjodohkan, tambahkan pasangan premis dan pasangannya. Untuk isian singkat, tuliskan kata kunci jawaban yang presisi.'));
docChildren.push(createNumberedStep('6', 'Menyimpan Soal', 'Klik Simpan Soal. Butir soal akan ditambahkan ke daftar dan total poin ujian akan terkalkulasi secara otomatis.'));

docChildren.push(createHeading2('2.4 Module Builder (Penyusunan Alur Pembelajaran)'));
docChildren.push(
    createParagraph(
        'Modul adalah wadah yang menyatukan beberapa materi pelatihan dan bank soal menjadi satu rangkaian alur belajar (Learning Path) yang berurutan. Peserta diwajibkan menyelesaikan materi pertama sebelum materi/ujian kedua terbuka.'
    )
);
docChildren.push(createNumberedStep('1', 'Membuat Modul Baru', 'Buka menu Module Builder (/admin/modules), lalu klik Buat Modul Baru. Berikan Nama Modul dan Deskripsi Pembelajaran, kemudian klik Simpan.'));
docChildren.push(createNumberedStep('2', 'Menyusun Rangkaian Pembelajaran', 'Klik tombol Edit/Susun pada modul yang bersangkutan. Pada panel yang tersedia, Anda dapat menambahkan Materi (Training) maupun Ujian (Exam) dari master data yang telah dibuat sebelumnya.'));
docChildren.push(createNumberedStep('3', 'Mengatur Urutan (Sequence)', 'Gunakan tombol panah naik/turun atau seret item untuk menentukan urutan logis. Contoh alur ideal: Materi Pengantar -> Materi Inti Bagian 1 -> Kuis 1 -> Materi Bagian 2 -> Ujian Akhir Sertifikasi.'));

docChildren.push(createHeading2('2.5 Session Manager (Jadwal, Pengaturan Keamanan & SEB)'));
docChildren.push(
    createParagraph(
        'Session Manager (/admin/sessions) adalah modul operasional paling krusial. Di sinilah modul pembelajaran diikat dengan jadwal waktu tertentu, peserta didaftarkan, dan protokol keamanan diaktifkan.'
    )
);
docChildren.push(createBulletItem('Penjadwalan Waktu Presisi:', 'Tentukan Tanggal & Jam Mulai (Start Time) serta Tanggal & Jam Berakhir (End Time). Peserta tidak akan bisa mengakses ujian sebelum waktu mulai tiba, dan akses akan ditutup otomatis saat waktu berakhir terlampaui.'));
docChildren.push(createBulletItem('Integrasi Safe Exam Browser (SEB):', 'Jika dicentang Wajib SEB, peserta hanya bisa membuka sesi melalui aplikasi Safe Exam Browser. Masukkan SEB Config Key Hash yang sesuai dengan berkas konfigurasi .seb instansi Anda. Sistem akan menolak peramban biasa seperti Chrome, Edge, atau Firefox.'));
docChildren.push(createBulletItem('Kamera Proctoring Aktif:', 'Jika diaktifkan, peserta diwajibkan memberikan izin akses kamera web sebelum memulai tes. Sistem akan mengambil snapshot visual peserta secara berkala dan otomatis tanpa mengganggu pengerjaan soal.'));
docChildren.push(createBulletItem('Visibilitas Skor (Show Score):', 'Pilihan untuk langsung menampilkan nilai kelulusan kepada peserta sesaat setelah menekan tombol submit, atau menyembunyikan nilai hingga evaluasi selesai dilakukan oleh instruktur.'));
docChildren.push(createBulletItem('Pendaftaran Peserta (Assign Participants):', 'Pilih peserta dari daftar master untuk dimasukkan ke dalam sesi.'));
docChildren.push(createBulletItem('Broadcast Email Pengingat (Blast Email):', 'Tombol untuk mengirimkan notifikasi jadwal sesi beserta instruksi ujian ke seluruh alamat email peserta terdaftar secara otomatis dengan satu kali klik.'));

docChildren.push(
    createCallout(
        'Aturan Waktu Pelaksanaan Sesi',
        'Durasi ujian di dalam bank soal berjalan independen dari durasi sesi. Pastikan rentang waktu sesi (start_time ke end_time) cukup longgar agar peserta yang terlambat login beberapa menit tetap memiliki cukup waktu untuk menyelesaikan durasi ujian mereka.',
        'warning'
    )
);

docChildren.push(createHeading2('2.6 Monitoring Live Proctoring'));
docChildren.push(
    createParagraph(
        'Menu Live Proctoring (/admin/monitoring) menyediakan dinding pengawasan visual langsung selama ujian berlangsung. Pengawas atau Admin dapat:'
    )
);
docChildren.push(createBulletItem('Memilih Sesi Aktif:', 'Pilih sesi ujian yang sedang berjalan dari dropdown filter.'));
docChildren.push(createBulletItem('Melihat Galeri Snapshot Kamera:', 'Melihat tangkapan layar webcam peserta secara real-time. Setiap foto dilengkapi dengan nama peserta, username, serta stempel waktu (timestamp) pengambilan.'));
docChildren.push(createBulletItem('Penyegaran Otomatis (Auto Refresh):', 'Halaman melakukan auto-refresh setiap 30 detik secara otomatis tanpa perlu memuat ulang halaman secara manual, atau dapat ditekan tombol Refresh manual sewaktu-waktu.'));

docChildren.push(createHeading2('2.7 Penilaian, Koreksi Esai Manual, & Override Peserta'));
docChildren.push(
    createParagraph(
        'Pada halaman detail sesi (/admin/sessions/[id]), Admin dapat melihat seluruh daftar peserta beserta status penyelesaiannya (Belum, Mengerjakan, atau Selesai 100%). Admin memiliki wewenang khusus untuk menangani situasi insidental:'
    )
);
docChildren.push(createNumberedStep('1', 'Perpanjangan Waktu Massal (Bulk Time Extension)', 'Pilih beberapa peserta dengan mencentang kotak seleksi, klik Tambah Waktu Massal, masukkan jumlah menit tambahan (contoh: 15 menit), isi alasan perpanjangan (misal: "Gangguan jaringan listrik di lokasi ujian"), lalu klik Terapkan. Waktu pengerjaan peserta akan langsung diperpanjang di sisi server.'));
docChildren.push(createNumberedStep('2', 'Kelola Akses Ujian Perorangan (Override)', 'Klik tombol Detail pada peserta, lalu klik Kelola Akses Ujian pada item ujian. Admin dapat memilih: A) Lanjutkan Ujian (simpan draft lama dan buka kembali ujian yang sempat terkunci) atau B) Ulang Dari Awal / Reset (menghapus draft lama untuk mengizinkan peserta mengulang ujian dari nol).'));
docChildren.push(createNumberedStep('3', 'Koreksi Manual Soal Esai', 'Klik menu Lihat Jawaban (/admin/sessions/[id]/participants/[userId]/answers). Sistem akan menampilkan lembar jawaban peserta berdampingan dengan petunjuk penilaian. Pada soal esai, Admin/Trainer cukup menekan tombol Benar (warna hijau) atau Salah (warna merah). Nilai akhir peserta akan langsung terkalkulasi ulang seketika.'));

docChildren.push(createHeading2('2.8 Manajemen Peserta & Fitur Import Excel Massal'));
docChildren.push(
    createParagraph(
        'Menu Kelola Peserta (/admin/participants) memungkinkan pengelolaan data demografi peserta pelatihan. Untuk mendaftarkan puluhan hingga ratusan peserta sekaligus, gunakan fitur Import Excel:'
    )
);
docChildren.push(createNumberedStep('1', 'Membuka Halaman Import Peserta', 'Masuk ke Kelola Peserta, lalu klik tombol Import Peserta.'));
docChildren.push(createNumberedStep('2', 'Mengunduh Template Resmi', 'Klik tombol Unduh Template Excel (.xlsx). Template ini telah diformat secara khusus dengan drop-down validasi jenis kelamin (L/P) dan instruksi penulisan tanggal lahir (YYYY-MM-DD).'));
docChildren.push(createNumberedStep('3', 'Mengisi Data Peserta', 'Isi data Nama Lengkap, Email Aktif (berfungsi sebagai Username), Nomor WhatsApp, Institusi/Perusahaan, Tanggal Lahir, Jenis Kelamin, dan Alamat Domisili.'));
docChildren.push(createNumberedStep('4', 'Mengunggah Berkas Excel', 'Seret atau pilih berkas Excel yang telah diisi ke kotak unggah sistem. Sistem akan mempratinjau data dan memeriksa adanya duplikasi email.'));
docChildren.push(createNumberedStep('5', 'Eksekusi & Unduh Rekap Kredensial', 'Klik Proses Import. Sistem akan membuat akun peserta secara otomatis, menghasilkan password acak yang aman, dan menyediakan tombol Unduh Rekap Kredensial Akun (Excel) untuk dibagikan kepada masing-masing peserta.'));

docChildren.push(createHeading2('2.9 Manajemen Pengguna (Admin & Trainer)'));
docChildren.push(
    createParagraph(
        'Hanya pengguna dengan peran Administrator yang dapat mengakses menu Kelola Pengguna (/admin/users). Di menu ini, Admin dapat menambah akun pengajar/instruktur baru (Trainer) atau rekan Administrator baru, baik secara manual maupun melalui template Excel khusus pengguna.'
    )
);

docChildren.push(createHeading2('2.10 Audit Trail (Log Keamanan Sistem)'));
docChildren.push(
    createParagraph(
        'Menu Audit Trail (/admin/audit-logs) mencatat setiap aktivitas kritis yang terjadi di dalam sistem untuk menjamin transparansi dan kepatuhan audit. Log mencatat waktu kejadian, pelaku (Admin/Trainer), jenis tindakan (misal: EXTEND_TIME, OVERRIDE_EXAM, GRADE_ESSAY, DELETE_EXAM), dan rincian parameter perubahan dalam format JSON yang transparan.'
    )
);

docChildren.push(createHeading2('2.11 Ekspor Laporan Hasil Sesi ke Excel'));
docChildren.push(
    createParagraph(
        'Pada halaman detail sesi apa pun, Admin dapat menekan tombol Export Excel. Sistem akan menghasilkan buku kerja spreadsheet berformat profesional (.xlsx) yang memuat kop laporan resmi, ringkasan persentase kelulusan, skor rata-rata sesi, daftar lengkap seluruh peserta beserta status kelulusan, skor akhir, jumlah percobaan, dan stempel waktu akses terakhir.'
    )
);

docChildren.push(createDivider());

// ==========================================
// BAB III: PANDUAN LENGKAP ROLE INSTRUKTUR / PENGAJAR (TRAINER)
// ==========================================
docChildren.push(createHeading1('BAB III: PANDUAN LENGKAP ROLE INSTRUKTUR / PENGAJAR (TRAINER)'));
docChildren.push(
    createParagraph(
        'Peran Trainer / Instruktur dirancang khusus untuk memfasilitasi proses pengajaran, pengawasan ujian, dan evaluasi hasil belajar tanpa dibebani oleh tugas administratif sistemik seperti pengelolaan database pengguna.'
    )
);

docChildren.push(createHeading2('3.1 Ruang Lingkup & Wewenang Khusus Trainer'));
docChildren.push(
    createParagraph(
        'Trainer memiliki antarmuka khusus (Admin Hub for Trainer) yang memberikan fokus pada:'
    )
);
docChildren.push(createBulletItem('Melihat Materi & Bank Soal:', 'Trainer dapat meninjau seluruh materi bacaan dan daftar butir pertanyaan untuk memastikan materi yang diujikan relevan dengan silabus pengajaran.'));
docChildren.push(createBulletItem('Memantau Jalannya Sesi Pelatihan:', 'Trainer dapat membuka menu Session Manager untuk melihat progres pengerjaan modul oleh peserta didik secara langsung.'));
docChildren.push(createBulletItem('Pengawasan Live Proctoring:', 'Trainer dapat memantau rekaman foto kamera webcam peserta saat ujian berlangsung guna mendeteksi indikasi kecurangan.'));
docChildren.push(createBulletItem('Menilai Soal Esai & Memberikan Tambahan Waktu:', 'Trainer berwenang memberikan nilai koreksi pada jawaban esai peserta dan memberikan perpanjangan durasi waktu pengerjaan jika peserta mengalami kendala teknis.'));
docChildren.push(createBulletItem('Mengunduh Laporan Nilai:', 'Trainer dapat mengunduh laporan rekapitulasi nilai sesi dalam format spreadsheet Excel resmi untuk keperluan arsip nilai akademik.'));

docChildren.push(createHeading2('3.2 Panduan Langkah Demi Langkah Koreksi Soal Esai bagi Trainer'));
docChildren.push(
    createParagraph(
        'Salah satu tugas utama Trainer adalah mengoreksi lembar jawaban uraian/esai yang membutuhkan penilaian profesional manusia:'
    )
);
docChildren.push(createNumberedStep('1', 'Membuka Detail Sesi Pelatihan', 'Masuk ke menu Session Manager, pilih sesi pelatihan yang ingin dikoreksi nilainya.'));
docChildren.push(createNumberedStep('2', 'Memilih Peserta yang Berstatus Selesai', 'Pada tabel peserta, cari peserta yang telah menyelesaikan ujian atau memiliki status Menunggu Nilai Esai.'));
docChildren.push(createNumberedStep('3', 'Membuka Halaman Jawaban Peserta', 'Klik tombol Detail pada baris peserta, lalu klik Lihat Jawaban pada modul ujian yang bersangkutan.'));
docChildren.push(createNumberedStep('4', 'Membaca Jawaban & Petunjuk Penilaian', 'Gulir ke nomor soal esai. Sistem menampilkan soal asli, teks jawaban lengkap yang diketik oleh peserta, serta stempel waktu pengiriman jawaban.'));
docChildren.push(createNumberedStep('5', 'Menentukan Nilai (Benar / Salah)', 'Tekan tombol Benar (warna hijau) jika jawaban memenuhi kriteria penilaian, atau tekan tombol Salah (warna merah) jika tidak sesuai. Sistem akan langsung menyimpan nilai, mencatat nama Trainer sebagai penilai, dan memperbarui nilai total peserta seketika.'));

docChildren.push(createDivider());

// ==========================================
// BAB IV: PANDUAN LENGKAP ROLE PESERTA (TRAINEE)
// ==========================================
docChildren.push(createHeading1('BAB IV: PANDUAN LENGKAP ROLE PESERTA (TRAINEE)'));
docChildren.push(
    createParagraph(
        'Portal Peserta dirancang dengan antarmuka yang bersih, modern, dan sangat mudah digunakan agar peserta dapat sepenuhnya fokus pada proses belajar dan pengerjaan ujian.'
    )
);

docChildren.push(createHeading2('4.1 Login & Pengaturan Kata Sandi Pertama Kali'));
docChildren.push(
    createParagraph(
        'Untuk memulai pembelajaran, ikuti langkah login berikut:'
    )
);
docChildren.push(createNumberedStep('1', 'Mengakses Alamat Portal LMS', 'Buka peramban web dan akses alamat resmi LMS Nusamitra (/auth/login).'));
docChildren.push(createNumberedStep('2', 'Memasukkan Kredensial Akun', 'Ketikkan Email Terdaftar (sebagai Username) dan Kata Sandi Awal yang telah diberikan oleh pihak penyelenggara/Admin.'));
docChildren.push(createNumberedStep('3', 'Masuk ke Portal', 'Klik tombol Masuk Sekarang. Jika kredensial valid, Anda akan langsung diarahkan ke Halaman Dashboard Peserta.'));
docChildren.push(createNumberedStep('4', 'Lupa Kata Sandi', 'Jika Anda lupa kata sandi, klik tautan Lupa Kata Sandi? di bawah form login. Masukkan email terdaftar Anda. Sistem akan mengirimkan tautan reset kata sandi ke kotak masuk email Anda yang berlaku selama 60 menit.'));

docChildren.push(createHeading2('4.2 Menjelajahi Dashboard Peserta'));
docChildren.push(
    createParagraph(
        'Halaman Dashboard Peserta (/dashboard) menyajikan ringkasan aktivitas belajar:'
    )
);
docChildren.push(createBulletItem('Kartu Statistik Pribadi:', 'Menampilkan total sesi pelatihan yang Anda ikuti, jumlah modul yang telah diselesaikan, serta rata-rata skor ujian yang telah diraih.'));
docChildren.push(createBulletItem('Daftar Sesi Pelatihan Aktif:', 'Menampilkan kartu sesi pelatihan yang sedang terbuka lengkap dengan waktu mulai, batas akhir pengerjaan, dan tombol Mulai Belajar / Lanjutkan Belajar.'));
docChildren.push(createBulletItem('Menu Navigasi Peserta:', 'Terdiri dari menu Overview, Sesi Pelatihan, Riwayat Ujian, Profil Saya, dan Notifikasi.'));

docChildren.push(createHeading2('4.3 Mengikuti Pembelajaran Materi (Teks, Dokumen, & Video)'));
docChildren.push(
    createParagraph(
        'Ketika Anda membuka sebuah sesi pelatihan (/dashboard/sesi/[id]), Anda akan melihat daftar alur pembelajaran terstruktur:'
    )
);
docChildren.push(createNumberedStep('1', 'Membuka Materi Terbuka', 'Klik modul materi yang berstatus Terbuka (ikon buku berwarna biru). Item yang masih terkunci (ikon gembok) baru akan terbuka setelah item sebelumnya diselesaikan.'));
docChildren.push(createNumberedStep('2', 'Membaca Teks & Menonton Video', 'Pelajari isi teks materi secara saksama. Jika terdapat video pendukung, tekan tombol play untuk memutar video materi secara langsung di layar.'));
docChildren.push(createNumberedStep('3', 'Membaca & Mengunduh Berkas PDF', 'Jika materi melampirkan berkas dokumen atau PDF, Anda dapat membaca berkas melalui penampil dokumen terintegrasi atau mengunduhnya ke perangkat Anda.'));
docChildren.push(createNumberedStep('4', 'Menandai Selesai', 'Setelah selesai membaca, klik tombol Selesai & Lanjutkan. Sistem akan mencatat progres materi menjadi Selesai 100% dan secara otomatis membuka modul ujian berikutnya.'));

docChildren.push(createHeading2('4.4 Menjalankan Ujian Online (Exam Player)'));
docChildren.push(
    createParagraph(
        'Ketika Anda memasuki modul Ujian (/dashboard/sesi/[id]/ujian/[examId]), Anda akan memasuki antarmuka pengerjaan ujian khusus:'
    )
);
docChildren.push(createBulletItem('Izin Kamera Web (Webcam):', 'Jika sesi mengaktifkan Proctoring Kamera, klik Izinkan Akses Kamera pada dialog peramban. Pratinjau kamera kecil akan muncul di pojok layar sebagai tanda pengawasan aktif.'));
docChildren.push(createBulletItem('Timer Hitung Mundur Real-Time:', 'Di bagian atas layar terdapat indikator waktu sisa pengerjaan. Jika waktu habis, sistem akan secara otomatis menyimpan seluruh jawaban Anda dan mengirimkannya ke server (Auto Submit).'));
docChildren.push(createBulletItem('Palet Navigasi Nomor Soal:', 'Di sisi kanan layar (atau di bagian bawah pada layar smartphone), terdapat kotak-kotak nomor soal. Nomor yang telah dijawab akan berubah warna menjadi hijau/biru solid, nomor yang belum dijawab berwarna netral, dan nomor yang sedang dibuka ditandai dengan bingkai tebal. Anda dapat melompat ke nomor berapa pun dengan sekali klik.'));
docChildren.push(createBulletItem('Fitur Simpan Otomatis (Auto-Save Draft):', 'Setiap kali Anda memilih opsi jawaban atau mengetik kalimat esai, sistem langsung menyimpan draft jawaban Anda ke database secara otomatis dalam hitungan detik. Indikator "Tersimpan di Cloud" akan menyala hijau di pojok layar. Jika koneksi internet Anda sempat terputus atau peramban tidak sengaja tertutup, jawaban Anda TIDAK AKAN HILANG dan Anda dapat langsung melanjutkan saat terhubung kembali.'));
docChildren.push(createBulletItem('Penguncian Anti-Cheat:', 'Selama ujian berlangsung, fungsi klik kanan, tombol pintas keyboard (Ctrl+C, Ctrl+V, F12), dan pemilihan teks dinonaktifkan demi menjaga kejujuran ujian.'));
docChildren.push(createBulletItem('Konfirmasi Pengiriman Jawaban:', 'Setelah semua soal selesai dijawab, klik tombol Selesai & Kumpulkan Jawaban di soal terakhir atau pada palet navigasi. Sistem akan menampilkan dialog konfirmasi yang memberi tahu apakah masih ada soal yang belum terisi. Klik Ya, Kumpulkan untuk menyelesaikan ujian.'));

docChildren.push(
    createCallout(
        'Tips Mengerjakan Ujian Online',
        'Gunakan palet nomor soal untuk memeriksa kembali apakah masih ada nomor yang berwarna abu-abu (belum terisi). Pastikan indikator Cloud berstatus "Tersimpan" sebelum menekan tombol kumpulkan.',
        'tip'
    )
);

docChildren.push(createHeading2('4.5 Melihat Riwayat Ujian & Pembahasan Soal'));
docChildren.push(
    createParagraph(
        'Pada menu Riwayat Ujian (/dashboard/riwayat), peserta dapat melihat daftar seluruh ujian yang pernah diikuti. Informasi yang ditampilkan meliputi nama sesi, tanggal ujian, skor yang diraih, status kelulusan (Lulus/Belum Lulus), serta tautan untuk melihat pembahasan detail dan perbandingan jawaban apabila diizinkan oleh kebijakan penyelenggara pelatihan.'
    )
);

docChildren.push(createHeading2('4.6 Mengelola Profil Pribadi & Ganti Kata Sandi'));
docChildren.push(
    createParagraph(
        'Peserta dapat memperbarui data pribadi dan menjaga keamanan akun melalui menu Profil (/dashboard/profil):'
    )
);
docChildren.push(createNumberedStep('1', 'Memperbarui Data Diri', 'Ubah Nama Lengkap, Nomor Kontak WhatsApp, Nama Institusi/Perusahaan, Alamat, Tanggal Lahir, atau Jenis Kelamin, lalu klik Simpan Profil.'));
docChildren.push(createNumberedStep('2', 'Mengganti Kata Sandi', 'Pada bagian Ganti Kata Sandi, masukkan Kata Sandi Lama Anda, kemudian ketikkan Kata Sandi Baru (minimal 6 karakter) dan konfirmasi kata sandi baru. Klik Perbarui Kata Sandi.'));

docChildren.push(createDivider());

// ==========================================
// BAB V: FITUR KHUSUS, KEAMANAN, & TROUBLESHOOTING
// ==========================================
docChildren.push(createHeading1('BAB V: FITUR KHUSUS, KEAMANAN, & TROUBLESHOOTING'));

docChildren.push(createHeading2('5.1 Safe Exam Browser (SEB) & Menu Keluar Khusus'));
docChildren.push(
    createParagraph(
        'Safe Exam Browser (SEB) adalah lingkungan peramban khusus yang mengunci komputer peserta menjadi stasiun ujian yang aman. Saat SEB aktif, peserta tidak dapat membuka peramban lain, aplikasi chatting, kalkulator, merekam layar, atau berpindah jendela.'
    )
);
docChildren.push(createBulletItem('Cara Memulai Ujian SEB:', 'Buka berkas konfigurasi .seb yang diberikan oleh Admin. Aplikasi SEB akan terbuka dan otomatis mengarahkan ke halaman login LMS Nusamitra.'));
docChildren.push(createBulletItem('Validasi SEB Config Hash:', 'Server LMS memvalidasi header X-SafeExamBrowser-ConfigKeyHash yang dikirimkan oleh peramban SEB untuk memastikan peserta menggunakan berkas konfigurasi resmi.'));
docChildren.push(createBulletItem('Cara Keluar dari SEB (/quit-seb):', 'Setelah ujian selesai dikumpulkan, tombol Keluar SEB akan muncul di navigasi atas, atau peserta dapat mengklik tautan /quit-seb. SEB akan meminta konfirmasi kata sandi keluar (quit password jika dikonfigurasi) dan menutup aplikasi secara aman.'));

docChildren.push(createHeading2('5.2 Sistem Pencegahan Kecurangan (Anti-Cheat)'));
docChildren.push(
    createParagraph(
        'LMS Nusamitra menerapkan proteksi berlapis pada lembar ujian:'
    )
);
docChildren.push(createBulletItem('Context Menu Disabled:', 'Mencegah menu klik kanan untuk inspect element atau menyalin gambar soal.'));
docChildren.push(createBulletItem('Clipboard Protection:', 'Memblokir tombol salin (Ctrl+C, Ctrl+X), tempel (Ctrl+V), dan pilih semua (Ctrl+A).'));
docChildren.push(createBulletItem('Developer Tools Lock:', 'Memblokir tombol F12, Ctrl+Shift+I, Ctrl+Shift+J, dan Ctrl+U (View Source).'));
docChildren.push(createBulletItem('PrintScreen Block:', 'Memblokir fungsi tangkapan layar keyboard standar.'));

docChildren.push(createHeading2('5.3 Solusi Penanganan Kendala Umum (Troubleshooting)'));

const troubleshootingData = [
    ['Kendala yang Dialami', 'Penyebab Utama', 'Langkah Solusi Praktis'],
    [
        'Sesi Ujian Masih Terkunci',
        'Waktu mulai sesi belum tiba, atau modul materi prasyarat belum diselesaikan.',
        'Periksa jam mulai sesi di dashboard. Pastikan semua materi bacaan sebelumnya telah berstatus "Selesai 100%".'
    ],
    [
        'Koneksi Internet Terputus Saat Ujian',
        'Gangguan sinyal Wi-Fi atau data seluler di lokasi peserta.',
        'Tenang dan jangan panik. Jawaban Anda tersimpan otomatis di cloud. Sambungkan kembali internet Anda dan muat ulang halaman untuk melanjutkan.'
    ],
    [
        'Kamera Webcam Tidak Terbuka',
        'Izin akses kamera diblokir oleh peramban web.',
        'Klik ikon gembok/kamera di sebelah kiri bilah alamat URL peramban, ubah izin Kamera menjadi "Allow" (Izinkan), lalu muat ulang halaman.'
    ],
    [
        'Ditolak Masuk: "Wajib Menggunakan SEB"',
        'Peserta mencoba membuka ujian dengan peramban biasa (Chrome/Edge) pada sesi yang mewajibkan SEB.',
        'Unduh dan instal Safe Exam Browser di komputer Anda, lalu buka ujian menggunakan berkas konfigurasi .seb yang diberikan panitia.'
    ],
    [
        'Waktu Ujian Tiba-tiba Habis',
        'Durasi pengerjaan telah mencapai 00:00.',
        'Sistem otomatis menyimpan dan mengumpulkan jawaban terakhir Anda. Hubungi Admin/Trainer jika memerlukan perpanjangan waktu karena kendala teknis.'
    ],
    [
        'Token Reset Password Tidak Valid / Kedaluwarsa',
        'Tautan reset password telah melewati batas waktu 60 menit sejak dikirim.',
        'Buka kembali halaman /auth/forgot-password dan kirimkan ulang permintaan reset kata sandi yang baru.'
    ],
];
docChildren.push(createTable(['Kendala', 'Penyebab', 'Langkah Solusi'], troubleshootingData, [25, 30, 45]));

docChildren.push(createHeading2('5.4 Frequently Asked Questions (FAQ)'));
docChildren.push(
    createRichParagraph([
        { text: 'T: Apakah peserta dapat mengerjakan ujian menggunakan smartphone?\n', bold: true },
        { text: 'J: Ya, antarmuka LMS Nusamitra didesain responsif dan dapat diakses dengan baik melalui smartphone atau tablet. Namun, jika sesi pelatihan mewajibkan Safe Exam Browser (SEB) dengan konfigurasi desktop khusus, disarankan menggunakan laptop atau PC komputer.' }
    ], { before: 100, after: 100 })
);
docChildren.push(
    createRichParagraph([
        { text: 'T: Bagaimana jika listrik padam di tengah-tengah pengerjaan ujian?\n', bold: true },
        { text: 'J: Sistem telah dilengkapi mekanisme autosave draft real-time ke database. Seluruh jawaban yang telah dipilih tetap aman. Begitu perangkat dinyalakan kembali dan terhubung, peserta dapat melanjutkan sisa waktu ujian. Admin atau Trainer juga dapat memberikan tambahan waktu melalui fitur Override Waktu di panel admin.' }
    ], { before: 100, after: 100 })
);
docChildren.push(
    createRichParagraph([
        { text: 'T: Apakah nilai ujian esai langsung keluar sesaat setelah submit?\n', bold: true },
        { text: 'J: Soal pilihan ganda dinilai seketika oleh sistem. Namun, jika bank soal memuat soal esai/uraian, nilai akhir akan berstatus "Menunggu Nilai" sampai Trainer atau Admin selesai mengoreksi dan memberikan penilaian manual pada lembar jawaban.' }
    ], { before: 100, after: 100 })
);
docChildren.push(
    createRichParagraph([
        { text: 'T: Bagaimana cara mengunduh laporan nilai seluruh peserta sesi?\n', bold: true },
        { text: 'J: Masuk ke menu Session Manager sebagai Admin atau Trainer, buka sesi yang diinginkan, lalu klik tombol "Export Excel" pada pojok kanan atas. Berkas spreadsheet (.xlsx) resmi akan langsung terunduh ke komputer Anda.' }
    ], { before: 100, after: 100 })
);

docChildren.push(createDivider());

// ==========================================
// PENUTUP
// ==========================================
docChildren.push(createHeading1('PENUTUP'));
docChildren.push(
    createParagraph(
        'Buku Panduan Sistem LMS Nusamitra ini disusun sebagai pedoman baku dalam pengoperasian seluruh modul dan fitur yang ada pada platform. Dengan pemahaman yang baik mengenai alur kerja setiap peran, diharapkan proses pelatihan dan evaluasi kompetensi dapat berjalan dengan lancar, tertib, dan mencapai standar mutu pembelajaran yang diharapkan.'
    )
);
docChildren.push(
    createParagraph(
        'Untuk pertanyaan teknis lebih lanjut, integrasi sistem, atau bantuan operasional, silakan menghubungi Tim Dukungan Teknis Administrator LMS Nusamitra.'
    )
);

// Create Document Object
const doc = new Document({
    styles: {
        default: {
            document: {
                run: {
                    font: FONT_NAME,
                    size: BODY_SIZE, // 12pt default
                    color: COLOR_PRIMARY,
                },
                paragraph: {
                    spacing: { line: LINE_SPACING_1_5 },
                },
            },
        },
    },
    sections: [
        {
            properties: {
                page: {
                    margin: {
                        top: 1440, // 1 inch (72 pt * 20 = 1440 twips)
                        bottom: 1440,
                        left: 1440,
                        right: 1440,
                    },
                },
            },
            headers: {
                default: new Header({
                    children: [
                        new Paragraph({
                            alignment: AlignmentType.RIGHT,
                            spacing: { before: 0, after: 120 },
                            children: [
                                new TextRun({
                                    text: 'Buku Panduan Pengguna — LMS Nusamitra',
                                    font: FONT_NAME,
                                    size: SMALL_SIZE, // 10pt
                                    italics: true,
                                    color: COLOR_MUTED,
                                }),
                            ],
                        }),
                    ],
                }),
            },
            footers: {
                default: new Footer({
                    children: [
                        new Paragraph({
                            alignment: AlignmentType.CENTER,
                            spacing: { before: 120, after: 0 },
                            children: [
                                new TextRun({
                                    text: 'Halaman ',
                                    font: FONT_NAME,
                                    size: SMALL_SIZE, // 10pt
                                    color: COLOR_MUTED,
                                }),
                                new TextRun({
                                    children: [PageNumber.CURRENT],
                                    font: FONT_NAME,
                                    size: SMALL_SIZE,
                                    color: COLOR_MUTED,
                                }),
                                new TextRun({
                                    text: ' dari ',
                                    font: FONT_NAME,
                                    size: SMALL_SIZE,
                                    color: COLOR_MUTED,
                                }),
                                new TextRun({
                                    children: [PageNumber.TOTAL_PAGES],
                                    font: FONT_NAME,
                                    size: SMALL_SIZE,
                                    color: COLOR_MUTED,
                                }),
                            ],
                        }),
                    ],
                }),
            },
            children: docChildren,
        },
    ],
});

// Write to Word file
const outputPath = path.resolve('Buku_Panduan_LMS_Nusamitra.docx');
Packer.toBuffer(doc)
    .then((buffer) => {
        fs.writeFileSync(outputPath, buffer);
        console.log(`\n======================================================`);
        console.log(`SUCCESS! Word Document generated at: ${outputPath}`);
        console.log(`Total bytes: ${buffer.length}`);
        console.log(`======================================================\n`);
    })
    .catch((err) => {
        console.error('Error generating document:', err);
    });
