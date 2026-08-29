import ExcelJS from 'exceljs';

export interface ParticipantTemplateRow {
    fullName: string;
    email: string;
    gender: 'L' | 'P';
    dateOfBirth: string;
    phoneNumber: string;
    address: string;
    institution: string;
    targetCertificationName?: string;
    batch?: string;
    registrationDate?: string;
}

export interface UserTemplateRow {
    fullName: string;
    email: string;
    role: 'admin' | 'trainer' | string;
    password?: string;
    phoneNumber: string;
    institution: string;
}

export interface SessionExportRow {
    no: number;
    fullName: string;
    nip?: string;
    institution?: string;
    batch?: string;
    username: string;
    status: string;
    score: string | number;
    attempts: string | number;
    lastAccess: string;
}

export interface CredentialExportRow {
    no: number;
    fullName: string;
    nip?: string;
    email: string;
    institution?: string;
    batch?: string;
    registrationDate?: string;
    role?: string;
    password?: string;
    status: string;
}

// Styling Constants
const FONT_FAMILY = 'Segoe UI';
const HEADER_FILL: ExcelJS.Fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E293B' }, // Slate-800
};
const HEADER_FONT: Partial<ExcelJS.Font> = {
    name: FONT_FAMILY,
    size: 11,
    bold: true,
    color: { argb: 'FFFFFFFF' },
};
const BANNER_FILL: ExcelJS.Fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF1F5F9' }, // Slate-100
};
const THIN_BORDER: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
};

/**
 * Generates an elegant, professional Excel workbook for Participant Bulk Import.
 * 10-column layout: Identity fields (left) → Program/Batch fields (right).
 */
export async function generateParticipantTemplateXlsx(): Promise<Uint8Array> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'LMS Platform';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Template Peserta', {
        views: [{ showGridLines: true }],
        pageSetup: { orientation: 'landscape', fitToPage: true },
    });

    // 1. Instruction Title / Banner
    sheet.mergeCells('A1:J1');
    const bannerCell = sheet.getCell('A1');
    bannerCell.value = '📋 PANDUAN PENGISIAN TEMPLATE IMPORT PESERTA LMS';
    bannerCell.font = { name: FONT_FAMILY, size: 12, bold: true, color: { argb: 'FF0F172A' } };
    bannerCell.fill = BANNER_FILL;
    bannerCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    sheet.getRow(1).height = 28;

    // 2. Guidelines Notes
    sheet.mergeCells('A2:J2');
    const noteCell = sheet.getCell('A2');
    noteCell.value = '• Kolom bertanda (*) WAJIB diisi. NIP digenerate OTOMATIS oleh sistem. Jenis Kelamin WAJIB: L (Laki-laki) atau P (Perempuan). Batch contoh: CSBA-SEP26. Format Tanggal: YYYY-MM-DD.';
    noteCell.font = { name: FONT_FAMILY, size: 9.5, italic: true, color: { argb: 'FF475569' } };
    noteCell.fill = BANNER_FILL;
    noteCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    sheet.getRow(2).height = 22;

    // Empty separator row
    sheet.getRow(3).height = 10;

    // 3. Table Headers — 10 columns, identity left → program right
    const headers = [
        'Nama Lengkap *',
        'Email Aktif (Username Login) *',
        'Jenis Kelamin (L/P) *',
        'Tanggal Lahir (YYYY-MM-DD) *',
        'No HP / WhatsApp *',
        'Alamat Domisili',
        'Institusi / Unit Kerja *',
        'Program Sertifikasi',
        'Batch Pelatihan',
        'Tanggal Pendaftaran (YYYY-MM-DD)',
    ];

    const headerRow = sheet.getRow(4);
    headerRow.height = 26;
    headers.forEach((h, idx) => {
        const cell = headerRow.getCell(idx + 1);
        cell.value = h;
        cell.font = HEADER_FONT;
        cell.fill = HEADER_FILL;
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = THIN_BORDER;
    });

    // 4. Sample Rows
    const samples: ParticipantTemplateRow[] = [
        {
            fullName: 'Ahmad Dahlan',
            email: 'ahmad.dahlan@example.com',
            gender: 'L',
            dateOfBirth: '1995-05-20',
            phoneNumber: '081234567890',
            address: 'Jl. Merdeka No. 45, Jakarta Pusat',
            institution: 'PT Telkom Indonesia',
            targetCertificationName: 'Certified Strategic Business Analyst',
            batch: 'CSBA-SEP26',
            registrationDate: new Date().toISOString().slice(0, 10),
        },
        {
            fullName: 'Siti Nurhaliza',
            email: 'siti.nurhaliza@example.com',
            gender: 'P',
            dateOfBirth: '1998-11-12',
            phoneNumber: '089876543210',
            address: 'Jl. Mawar No. 12, Surabaya',
            institution: 'RSUD Dr Soetomo',
            targetCertificationName: 'Pelatihan Transformasi Digital & Tata Kelola IT',
            batch: 'TDIT-OKT26',
            registrationDate: new Date().toISOString().slice(0, 10),
        },
    ];

    samples.forEach((sample, sIdx) => {
        const row = sheet.getRow(5 + sIdx);
        row.height = 22;

        const values = [
            sample.fullName,
            sample.email,
            sample.gender,
            sample.dateOfBirth,
            sample.phoneNumber,
            sample.address,
            sample.institution,
            sample.targetCertificationName || '',
            sample.batch || '1',
            sample.registrationDate || '',
        ];

        values.forEach((val, colIdx) => {
            const cell = row.getCell(colIdx + 1);
            cell.value = val;
            cell.font = { name: FONT_FAMILY, size: 10, color: { argb: 'FF1E293B' } };
            cell.border = THIN_BORDER;
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: sIdx % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC' },
            };

            // Formatting specifics based on column position
            if (colIdx === 2 || colIdx === 3 || colIdx === 8 || colIdx === 9) {
                // Gender, DOB, Batch, Registration Date → centered
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
            } else if (colIdx === 4) {
                // Phone number as text format to keep leading zeroes
                cell.numFmt = '@';
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
            } else {
                cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
            }
        });
    });

    // 5. Setup Column Widths
    sheet.columns = [
        { width: 28 }, // A: Nama Lengkap
        { width: 34 }, // B: Email Aktif
        { width: 22 }, // C: Jenis Kelamin
        { width: 28 }, // D: Tanggal Lahir
        { width: 20 }, // E: No HP
        { width: 40 }, // F: Alamat
        { width: 28 }, // G: Institusi
        { width: 34 }, // H: Program Sertifikasi
        { width: 22 }, // I: Batch Pelatihan
        { width: 32 }, // J: Tanggal Pendaftaran
    ];

    // 6. Data Validation for Gender (Column C, rows 5 to 500) — MANDATORY
    for (let r = 5; r <= 500; r++) {
        const genderCell = sheet.getCell(`C${r}`);
        genderCell.dataValidation = {
            type: 'list',
            allowBlank: false,
            formulae: ['"L,P"'],
            showErrorMessage: true,
            errorTitle: 'Jenis Kelamin Wajib Diisi',
            error: 'Pilih "L" untuk Laki-laki atau "P" untuk Perempuan. Kolom ini WAJIB diisi.',
        };
        // Phone number formatting for empty rows (Column E)
        sheet.getCell(`E${r}`).numFmt = '@';
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return new Uint8Array(buffer);
}

/**
 * Generates an elegant Excel workbook for User (Admin/Trainer) Bulk Import
 */
export async function generateUserTemplateXlsx(): Promise<Uint8Array> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'LMS Platform';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Template Pengguna', {
        views: [{ showGridLines: true }],
        pageSetup: { orientation: 'landscape', fitToPage: true },
    });

    // 1. Instruction Title / Banner
    sheet.mergeCells('A1:F1');
    const bannerCell = sheet.getCell('A1');
    bannerCell.value = '👥 PANDUAN PENGISIAN TEMPLATE IMPORT PENGGUNA (ADMIN & TRAINER)';
    bannerCell.font = { name: FONT_FAMILY, size: 12, bold: true, color: { argb: 'FF0F172A' } };
    bannerCell.fill = BANNER_FILL;
    bannerCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    sheet.getRow(1).height = 28;

    // 2. Guidelines Notes
    sheet.mergeCells('A2:F2');
    const noteCell = sheet.getCell('A2');
    noteCell.value = '• Kolom bertanda (*) WAJIB diisi. Role wajib: "admin" atau "trainer". Password opsional (jika kosong, sistem generate otomatis).';
    noteCell.font = { name: FONT_FAMILY, size: 9.5, italic: true, color: { argb: 'FF475569' } };
    noteCell.fill = BANNER_FILL;
    noteCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    sheet.getRow(2).height = 22;

    // Empty separator row
    sheet.getRow(3).height = 10;

    // 3. Table Headers
    const headers = [
        'Nama Lengkap *',
        'Email Aktif (Username) *',
        'Role (admin/trainer) *',
        'Password (opsional)',
        'No HP',
        'Institusi',
    ];

    const headerRow = sheet.getRow(4);
    headerRow.height = 26;
    headers.forEach((h, idx) => {
        const cell = headerRow.getCell(idx + 1);
        cell.value = h;
        cell.font = HEADER_FONT;
        cell.fill = HEADER_FILL;
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = THIN_BORDER;
    });

    // 4. Sample Rows
    const samples: UserTemplateRow[] = [
        {
            fullName: 'Budi Santoso',
            email: 'budi.admin@example.com',
            role: 'admin',
            password: 'AdminSecure123!',
            phoneNumber: '081234567890',
            institution: 'PT Inovasi Gemilang',
        },
        {
            fullName: 'Siti Aminah',
            email: 'siti.trainer@example.com',
            role: 'trainer',
            password: '',
            phoneNumber: '089876543210',
            institution: 'Akademi Pelatihan Utama',
        },
    ];

    samples.forEach((sample, sIdx) => {
        const row = sheet.getRow(5 + sIdx);
        row.height = 22;

        const values = [
            sample.fullName,
            sample.email,
            sample.role,
            sample.password || '',
            sample.phoneNumber,
            sample.institution,
        ];

        values.forEach((val, colIdx) => {
            const cell = row.getCell(colIdx + 1);
            cell.value = val;
            cell.font = { name: FONT_FAMILY, size: 10, color: { argb: 'FF1E293B' } };
            cell.border = THIN_BORDER;
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: sIdx % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC' },
            };

            if (colIdx === 2 || colIdx === 3) {
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
            } else if (colIdx === 4) {
                cell.numFmt = '@';
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
            } else {
                cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
            }
        });
    });

    // 5. Setup Column Widths
    sheet.columns = [
        { width: 28 }, // Nama Lengkap
        { width: 34 }, // Email Aktif
        { width: 24 }, // Role
        { width: 24 }, // Password
        { width: 20 }, // No HP
        { width: 28 }, // Institusi
    ];

    // 6. Data Validation for Role
    for (let r = 5; r <= 500; r++) {
        const roleCell = sheet.getCell(`C${r}`);
        roleCell.dataValidation = {
            type: 'list',
            allowBlank: false,
            formulae: ['"admin,trainer"'],
            showErrorMessage: true,
            errorTitle: 'Role Tidak Valid',
            error: 'Pilih role antara "admin" atau "trainer".',
        };
        sheet.getCell(`E${r}`).numFmt = '@';
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return new Uint8Array(buffer);
}

/**
 * Generates an executive Session Results Report in Excel (.xlsx)
 */
export async function generateSessionReportXlsx(params: {
    sessionId: string;
    sessionTitle: string;
    exportedAt: string;
    rows: SessionExportRow[];
}): Promise<Uint8Array> {
    const { sessionId, sessionTitle, exportedAt, rows } = params;

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'LMS Platform';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Laporan Hasil Sesi', {
        views: [{ showGridLines: true }],
        pageSetup: { orientation: 'landscape', fitToPage: true },
    });

    // 1. Title Row
    sheet.mergeCells('A1:J1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = `📊 LAPORAN HASIL SESI: ${sessionTitle.toUpperCase()}`;
    titleCell.font = { name: FONT_FAMILY, size: 14, bold: true, color: { argb: 'FF0F172A' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    sheet.getRow(1).height = 32;

    // 2. Metadata Rows
    sheet.getCell('A2').value = `ID Sesi: ${sessionId}`;
    sheet.getCell('A2').font = { name: FONT_FAMILY, size: 10, color: { argb: 'FF64748B' } };
    sheet.getCell('A3').value = `Diunduh pada: ${exportedAt} | Total Peserta: ${rows.length} orang`;
    sheet.getCell('A3').font = { name: FONT_FAMILY, size: 10, color: { argb: 'FF64748B' } };

    // KPI Summary
    const completedCount = rows.filter((r) => r.status.toUpperCase().includes('SELESAI') || r.status.toUpperCase().includes('LULUS')).length;
    const scores = rows.map((r) => typeof r.score === 'number' ? r.score : parseFloat(String(r.score))).filter((s) => !isNaN(s));
    const avgScore = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : '-';

    sheet.mergeCells('A4:J4');
    const kpiCell = sheet.getCell('A4');
    kpiCell.value = `📈 Ringkasan: Selesai: ${completedCount}/${rows.length} (${rows.length > 0 ? Math.round((completedCount / rows.length) * 100) : 0}%) | Rata-rata Skor: ${avgScore}`;
    kpiCell.font = { name: FONT_FAMILY, size: 10.5, bold: true, color: { argb: 'FF1E3A8A' } };
    kpiCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFEFF6FF' },
    };
    kpiCell.border = THIN_BORDER;
    sheet.getRow(4).height = 24;

    sheet.getRow(5).height = 10; // spacer

    // 3. Table Headers
    const headers = [
        'No',
        'Nama Lengkap',
        'NIP',
        'Institusi',
        'Batch',
        'Username / Email',
        'Status Ujian',
        'Skor Akhir',
        'Jumlah Percobaan',
        'Akses Terakhir',
    ];

    const headerRow = sheet.getRow(6);
    headerRow.height = 26;
    headers.forEach((h, idx) => {
        const cell = headerRow.getCell(idx + 1);
        cell.value = h;
        cell.font = HEADER_FONT;
        cell.fill = HEADER_FILL;
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = THIN_BORDER;
    });

    // 4. Data Rows
    if (rows.length === 0) {
        sheet.mergeCells('A7:J7');
        const emptyCell = sheet.getCell('A7');
        emptyCell.value = 'Belum ada peserta terdaftar pada sesi ini.';
        emptyCell.alignment = { vertical: 'middle', horizontal: 'center' };
        emptyCell.font = { name: FONT_FAMILY, size: 10, italic: true, color: { argb: 'FF94A3B8' } };
        sheet.getRow(7).height = 24;
    } else {
        rows.forEach((row, idx) => {
            const dataRow = sheet.getRow(7 + idx);
            dataRow.height = 22;

            const isCompleted = row.status.toUpperCase().includes('SELESAI') || row.status.toUpperCase().includes('LULUS');
            const isInProgress = row.status.toUpperCase().includes('MENGERJAKAN') || row.status.toUpperCase().includes('OPEN');

            const values = [
                row.no,
                row.fullName,
                row.nip || '-',
                row.institution || '-',
                row.batch || '1',
                row.username,
                row.status,
                row.score,
                row.attempts,
                row.lastAccess,
            ];

            values.forEach((val, colIdx) => {
                const cell = dataRow.getCell(colIdx + 1);
                cell.value = val;
                cell.font = { name: FONT_FAMILY, size: 10, color: { argb: 'FF1E293B' } };
                cell.border = THIN_BORDER;
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: idx % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC' },
                };

                if (colIdx === 0 || colIdx === 2 || colIdx === 4 || colIdx === 7 || colIdx === 8) {
                    cell.alignment = { vertical: 'middle', horizontal: 'center' };
                } else {
                    cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
                }

                if (colIdx === 6) {
                    cell.alignment = { vertical: 'middle', horizontal: 'center' };
                    if (isCompleted) {
                        cell.font = { name: FONT_FAMILY, size: 10, bold: true, color: { argb: 'FF15803D' } };
                    } else if (isInProgress) {
                        cell.font = { name: FONT_FAMILY, size: 10, bold: true, color: { argb: 'FFD97706' } };
                    }
                }
            });
        });
    }

    // 5. Setup Column Widths
    sheet.columns = [
        { width: 8 },  // No
        { width: 28 }, // Nama Lengkap
        { width: 24 }, // NIP
        { width: 26 }, // Institusi
        { width: 12 }, // Batch
        { width: 32 }, // Username / Email
        { width: 22 }, // Status
        { width: 14 }, // Skor Akhir
        { width: 18 }, // Percobaan
        { width: 22 }, // Akses Terakhir
    ];

    const buffer = await workbook.xlsx.writeBuffer();
    return new Uint8Array(buffer);
}

/**
 * Generates an Excel report for Credentials recap after import
 */
export async function generateCredentialsReportXlsx(params: {
    title: string;
    date: string;
    rows: CredentialExportRow[];
}): Promise<Uint8Array> {
    const { title, date, rows } = params;

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'LMS Platform';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Rekap Kredensial', {
        views: [{ showGridLines: true }],
    });

    // Title
    sheet.mergeCells('A1:H1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = `🔐 ${title.toUpperCase()}`;
    titleCell.font = { name: FONT_FAMILY, size: 13, bold: true, color: { argb: 'FF0F172A' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    sheet.getRow(1).height = 30;

    sheet.getCell('A2').value = `Dibuat pada: ${date} | Total Akun: ${rows.length}`;
    sheet.getCell('A2').font = { name: FONT_FAMILY, size: 9.5, color: { argb: 'FF64748B' } };
    sheet.getRow(3).height = 10;

    // Headers
    const headers = [
        'No',
        'Nama Lengkap',
        'NIP',
        'Email / Username',
        'Institusi',
        'Batch',
        'Tanggal Daftar',
        'Password Awal',
        'Status',
    ];
    const headerRow = sheet.getRow(4);
    headerRow.height = 26;
    headers.forEach((h, idx) => {
        const cell = headerRow.getCell(idx + 1);
        cell.value = h;
        cell.font = HEADER_FONT;
        cell.fill = HEADER_FILL;
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = THIN_BORDER;
    });

    // Rows
    rows.forEach((row, idx) => {
        const dataRow = sheet.getRow(5 + idx);
        dataRow.height = 22;

        const values = [
            row.no,
            row.fullName,
            row.nip || '-',
            row.email,
            row.institution || '-',
            row.batch || '1',
            row.registrationDate || '-',
            row.password || '******',
            row.status,
        ];

        values.forEach((val, colIdx) => {
            const cell = dataRow.getCell(colIdx + 1);
            cell.value = val;
            cell.font = { name: FONT_FAMILY, size: 10, color: { argb: 'FF1E293B' } };
            cell.border = THIN_BORDER;
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: idx % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC' },
            };

            if (colIdx === 0 || colIdx === 2 || colIdx === 5 || colIdx === 6 || colIdx === 8) {
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
                if (colIdx === 8) {
                    cell.font = { name: FONT_FAMILY, size: 10, bold: true, color: { argb: 'FF15803D' } };
                }
            } else if (colIdx === 7) {
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
                cell.font = { name: FONT_FAMILY, size: 10, bold: true, color: { argb: 'FF0F172A' } };
            } else {
                cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
            }
        });
    });

    sheet.columns = [
        { width: 8 },  // No
        { width: 28 }, // Nama Lengkap
        { width: 24 }, // NIP
        { width: 32 }, // Email
        { width: 26 }, // Institusi
        { width: 12 }, // Batch
        { width: 18 }, // Tanggal Daftar
        { width: 22 }, // Password
        { width: 18 }, // Status
    ];

    const buffer = await workbook.xlsx.writeBuffer();
    return new Uint8Array(buffer);
}

/**
 * Universal client/server function to parse Spreadsheet (XLSX, XLS) or raw rows into JSON objects
 */
export async function parseSpreadsheetBuffer(buffer: ArrayBuffer | Uint8Array): Promise<Record<string, string>[]> {
    const workbook = new ExcelJS.Workbook();
    // @ts-expect-error exceljs Buffer compatibility
    await workbook.xlsx.load(buffer);

    const worksheet = workbook.worksheets[0];
    if (!worksheet || worksheet.rowCount === 0) {
        return [];
    }

    // Find header row: scan first 10 rows for a row containing 'nama' or 'email' or multiple text cells
    let headerRowNumber = 1;
    for (let r = 1; r <= Math.min(10, worksheet.rowCount); r++) {
        const row = worksheet.getRow(r);
        const cellValues = row.values as Array<unknown>;
        if (Array.isArray(cellValues)) {
            const rowText = cellValues.map((v) => (v ? String(v).toLowerCase() : '')).join(' ');
            if (rowText.includes('nama') || rowText.includes('email')) {
                headerRowNumber = r;
                break;
            }
        }
    }

    const headerRow = worksheet.getRow(headerRowNumber);
    const headers: string[] = [];
    headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        let val = '';
        if (cell.value !== null && cell.value !== undefined) {
            if (typeof cell.value === 'object' && 'richText' in (cell.value as object)) {
                val = ((cell.value as { richText: Array<{ text: string }> }).richText || []).map((t) => t.text).join('');
            } else {
                val = String(cell.value);
            }
        }
        val = val.replace(/\*/g, '').trim(); // Remove asterisk markers from headers
        headers[colNumber] = val;
    });

    const results: Record<string, string>[] = [];

    for (let r = headerRowNumber + 1; r <= worksheet.rowCount; r++) {
        const row = worksheet.getRow(r);
        const rowObject: Record<string, string> = {};
        let hasValue = false;

        headers.forEach((headerKey, colNumber) => {
            if (!headerKey) return;
            const cell = row.getCell(colNumber);
            let cellText = '';

            if (cell.value !== null && cell.value !== undefined) {
                if (typeof cell.value === 'object') {
                    if ('result' in (cell.value as object)) {
                        cellText = String((cell.value as { result: unknown }).result || '');
                    } else if ('richText' in (cell.value as object)) {
                        cellText = ((cell.value as { richText: Array<{ text: string }> }).richText || []).map((t) => t.text).join('');
                    } else if (cell.value instanceof Date) {
                        cellText = cell.value.toISOString().split('T')[0];
                    } else if ('text' in (cell.value as object)) {
                        cellText = String((cell.value as { text: unknown }).text || '');
                    } else {
                        cellText = String(cell.value);
                    }
                } else {
                    cellText = String(cell.value);
                }
            }

            cellText = cellText.trim();
            if (cellText) hasValue = true;
            rowObject[headerKey] = cellText;
        });

        if (hasValue) {
            results.push(rowObject);
        }
    }

    return results;
}
