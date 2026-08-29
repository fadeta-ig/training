import crypto from 'node:crypto';
import ExcelJS from 'exceljs';

export const QUESTION_IMPORT_TEMPLATE_VERSION = '1.0.0';
export const QUESTION_IMPORT_MAX_FILE_BYTES = 5 * 1024 * 1024;
export const QUESTION_IMPORT_MAX_QUESTIONS = 500;
export const QUESTION_IMPORT_MAX_OPTIONS = 10;
export const QUESTION_IMPORT_MAX_CHILD_ROWS = 5_000;
export const QUESTION_IMPORT_MAX_UNCOMPRESSED_BYTES = 25 * 1024 * 1024;
export const QUESTION_IMPORT_MAX_ZIP_ENTRIES = 200;

const INPUT_HEADER_ROW = 4;
const INPUT_FIRST_DATA_ROW = 5;
const QUESTION_HEADERS = [
    'Kode Soal *',
    'Urutan *',
    'Tipe *',
    'Pertanyaan *',
    'Bobot *',
    'Kunci Benar/Salah',
    'Kunci Isian Singkat',
    'Gambar Soal URL',
] as const;
const OPTION_HEADERS = [
    'Kode Soal *',
    'Kode Opsi *',
    'Teks Opsi *',
    'Benar (YA/TIDAK) *',
    'Gambar Opsi URL',
] as const;
const MATCHING_HEADERS = [
    'Kode Soal *',
    'No Pasangan *',
    'Item Kiri *',
    'Pasangan Kanan *',
] as const;

export const QUESTION_IMPORT_TYPE_LABELS = {
    multiple_choice: 'Pilihan Ganda',
    multiple_select: 'Multi-Jawaban',
    true_false: 'Benar/Salah',
    short_answer: 'Isian Singkat',
    essay: 'Esai',
    matching: 'Menjodohkan',
} as const;

export type QuestionImportType = keyof typeof QUESTION_IMPORT_TYPE_LABELS;
export type QuestionImportIssueSeverity = 'error' | 'warning';

export interface QuestionImportIssue {
    severity: QuestionImportIssueSeverity;
    code: string;
    message: string;
    suggestion?: string;
    sheet: string;
    row: number | null;
    column: string | null;
    cell: string | null;
}

export interface QuestionImportInput {
    exam_id: string;
    question_type: QuestionImportType;
    question_text: string;
    question_image?: string | null;
    options?: Array<{ text: string; image: string | null }>;
    correct_option_index?: number;
    correct_option_indices?: number[];
    correct_answer?: string;
    matching_pairs?: Array<{ left: string; right: string }>;
    points: number;
}

export interface CanonicalImportedQuestion {
    source_code: string;
    source_row: number;
    import_order: number;
    input: QuestionImportInput;
}

export interface QuestionImportPreviewRow {
    source_code: string;
    source_row: number;
    import_order: number | null;
    question_type: QuestionImportType | null;
    question_type_label: string;
    question_text: string;
    points: number | null;
}

export interface QuestionImportSummary {
    totalQuestions: number;
    totalPoints: number;
    totalOptions: number;
    totalMatchingPairs: number;
    byType: Record<QuestionImportType, number>;
}

export interface QuestionImportParseResult {
    valid: boolean;
    templateVersion: string | null;
    fileSha256: string;
    questions: CanonicalImportedQuestion[];
    previewRows: QuestionImportPreviewRow[];
    issues: QuestionImportIssue[];
    summary: QuestionImportSummary;
}

interface RawQuestionRow {
    sourceCode: string;
    sourceKey: string;
    sourceRow: number;
    importOrder: number | null;
    questionType: QuestionImportType | null;
    questionTypeLabel: string;
    questionText: string;
    points: number | null;
    trueFalseKey: string;
    shortAnswerKey: string;
    imageUrl: string;
}

interface RawOptionRow {
    sourceCode: string;
    sourceKey: string;
    sourceRow: number;
    optionCode: string;
    optionText: string;
    isCorrect: boolean | null;
    imageUrl: string;
}

interface RawMatchingRow {
    sourceCode: string;
    sourceKey: string;
    sourceRow: number;
    pairNumber: number | null;
    left: string;
    right: string;
}

const TYPE_ALIASES = new Map<string, QuestionImportType>([
    ['pilihan ganda', 'multiple_choice'],
    ['multiple choice', 'multiple_choice'],
    ['multiple_choice', 'multiple_choice'],
    ['multi-jawaban', 'multiple_select'],
    ['multi jawaban', 'multiple_select'],
    ['multiple select', 'multiple_select'],
    ['multiple_select', 'multiple_select'],
    ['benar/salah', 'true_false'],
    ['benar salah', 'true_false'],
    ['true/false', 'true_false'],
    ['true_false', 'true_false'],
    ['isian singkat', 'short_answer'],
    ['short answer', 'short_answer'],
    ['short_answer', 'short_answer'],
    ['esai', 'essay'],
    ['essay', 'essay'],
    ['menjodohkan', 'matching'],
    ['matching', 'matching'],
]);

const OPTION_CODE_ORDER = new Map(
    Array.from({ length: QUESTION_IMPORT_MAX_OPTIONS }, (_, index) => [String.fromCharCode(65 + index), index]),
);

const COLORS = {
    navy: 'FF0F172A',
    slate: 'FF475569',
    lightSlate: 'FFF1F5F9',
    border: 'FFCBD5E1',
    white: 'FFFFFFFF',
    blue: 'FF2563EB',
    blueLight: 'FFEFF6FF',
    green: 'FF047857',
    greenLight: 'FFECFDF5',
    amber: 'FFB45309',
    amberLight: 'FFFFFBEB',
    purple: 'FF7C3AED',
    purpleLight: 'FFF5F3FF',
    red: 'FFB91C1C',
} as const;

function emptyTypeCounts(): Record<QuestionImportType, number> {
    return {
        multiple_choice: 0,
        multiple_select: 0,
        true_false: 0,
        short_answer: 0,
        essay: 0,
        matching: 0,
    };
}

function normalizeComparable(value: string): string {
    return value.trim().normalize('NFC').toLocaleLowerCase('id-ID');
}

function normalizeSourceKey(value: string): string {
    return value.trim().normalize('NFC').toUpperCase();
}

function getColumnLetter(columnNumber: number): string {
    let value = columnNumber;
    let result = '';
    while (value > 0) {
        const remainder = (value - 1) % 26;
        result = String.fromCharCode(65 + remainder) + result;
        value = Math.floor((value - 1) / 26);
    }
    return result;
}

function getCellText(cell: ExcelJS.Cell): string {
    const value = cell.value;
    if (value === null || value === undefined) return '';
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'object') {
        if ('richText' in value) {
            return value.richText.map((part) => part.text).join('').trim();
        }
        if ('text' in value && typeof value.text === 'string') return value.text.trim();
        if ('result' in value && value.result !== null && value.result !== undefined) {
            return String(value.result).trim();
        }
    }
    return String(value).trim();
}

function isFormulaCell(cell: ExcelJS.Cell): boolean {
    const value = cell.value;
    return !!value
        && typeof value === 'object'
        && ('formula' in value || 'sharedFormula' in value);
}

function rowHasValue(row: ExcelJS.Row, maxColumns: number): boolean {
    for (let column = 1; column <= maxColumns; column += 1) {
        if (getCellText(row.getCell(column))) return true;
    }
    return false;
}

function parseStrictInteger(value: string): number | null {
    if (!/^\d+$/.test(value.trim())) return null;
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) ? parsed : null;
}

function parseQuestionType(value: string): QuestionImportType | null {
    return TYPE_ALIASES.get(normalizeComparable(value)) ?? null;
}

function parseYesNo(value: string): boolean | null {
    const normalized = normalizeComparable(value);
    if (['ya', 'yes', 'true', '1'].includes(normalized)) return true;
    if (['tidak', 'no', 'false', '0'].includes(normalized)) return false;
    return null;
}

function parseTrueFalseKey(value: string): number | null {
    const normalized = normalizeComparable(value);
    if (['benar', 'true', 't'].includes(normalized)) return 0;
    if (['salah', 'false', 'f'].includes(normalized)) return 1;
    return null;
}

function isAllowedImageUrl(value: string): boolean {
    if (!value) return true;
    if (value.startsWith('/uploads/')) {
        return !value.includes('\\') && !value.includes('\0') && !value.includes('..');
    }
    try {
        const url = new URL(value);
        return url.protocol === 'https:' && !!url.hostname;
    } catch {
        return false;
    }
}

function pushIssue(
    issues: QuestionImportIssue[],
    issue: Omit<QuestionImportIssue, 'severity'> & { severity?: QuestionImportIssueSeverity },
): void {
    issues.push({ ...issue, severity: issue.severity ?? 'error' });
}

function cellIssue(
    issues: QuestionImportIssue[],
    params: {
        code: string;
        message: string;
        suggestion?: string;
        sheet: string;
        row: number;
        columnNumber: number;
        severity?: QuestionImportIssueSeverity;
    },
): void {
    const column = getColumnLetter(params.columnNumber);
    pushIssue(issues, {
        severity: params.severity,
        code: params.code,
        message: params.message,
        suggestion: params.suggestion,
        sheet: params.sheet,
        row: params.row,
        column,
        cell: `${column}${params.row}`,
    });
}

function validateSheetHeaders(
    worksheet: ExcelJS.Worksheet,
    expectedHeaders: readonly string[],
    issues: QuestionImportIssue[],
): void {
    const headerRow = worksheet.getRow(INPUT_HEADER_ROW);
    expectedHeaders.forEach((expected, index) => {
        const actual = getCellText(headerRow.getCell(index + 1));
        if (actual !== expected) {
            cellIssue(issues, {
                code: 'HEADER_TIDAK_SESUAI',
                message: `Header harus "${expected}", tetapi ditemukan "${actual || '(kosong)'}".`,
                suggestion: 'Unduh dan gunakan template terbaru tanpa mengubah nama atau urutan kolom.',
                sheet: worksheet.name,
                row: INPUT_HEADER_ROW,
                columnNumber: index + 1,
            });
        }
    });

    for (let column = expectedHeaders.length + 1; column <= worksheet.columnCount; column += 1) {
        const extraHeader = getCellText(headerRow.getCell(column));
        if (extraHeader) {
            cellIssue(issues, {
                code: 'HEADER_TAMBAHAN',
                message: `Kolom tambahan "${extraHeader}" tidak dikenali.`,
                suggestion: 'Hapus kolom tambahan atau pindahkan catatan ke sheet PETUNJUK.',
                sheet: worksheet.name,
                row: INPUT_HEADER_ROW,
                columnNumber: column,
            });
        }
    }
}

function validateInputCellSafety(
    worksheet: ExcelJS.Worksheet,
    maxColumns: number,
    maxDataRows: number,
    issues: QuestionImportIssue[],
): void {
    const lastAllowedRow = INPUT_FIRST_DATA_ROW + maxDataRows - 1;
    const scanLastRow = Math.min(worksheet.rowCount, lastAllowedRow);

    for (let rowNumber = INPUT_FIRST_DATA_ROW; rowNumber <= scanLastRow; rowNumber += 1) {
        const row = worksheet.getRow(rowNumber);
        const hasValue = rowHasValue(row, maxColumns);
        if (!hasValue) continue;

        if (row.hidden) {
            pushIssue(issues, {
                code: 'BARIS_TERSEMBUNYI',
                message: 'Baris input berisi data tidak boleh disembunyikan.',
                suggestion: 'Tampilkan kembali baris ini agar seluruh data dapat ditinjau sebelum import.',
                sheet: worksheet.name,
                row: rowNumber,
                column: null,
                cell: null,
            });
        }

        for (let column = 1; column <= maxColumns; column += 1) {
            const cell = row.getCell(column);
            if (isFormulaCell(cell)) {
                cellIssue(issues, {
                    code: 'FORMULA_TIDAK_DIIZINKAN',
                    message: 'Formula tidak diizinkan pada area input.',
                    suggestion: 'Ganti formula dengan nilai teks atau angka final.',
                    sheet: worksheet.name,
                    row: rowNumber,
                    columnNumber: column,
                });
            }
            if (cell.isMerged) {
                cellIssue(issues, {
                    code: 'MERGED_CELL_TIDAK_DIIZINKAN',
                    message: 'Sel gabungan tidak diizinkan pada area input.',
                    suggestion: 'Pisahkan sel dan isi setiap baris secara mandiri.',
                    sheet: worksheet.name,
                    row: rowNumber,
                    columnNumber: column,
                });
            }
        }
    }

    for (let rowNumber = lastAllowedRow + 1; rowNumber <= worksheet.rowCount; rowNumber += 1) {
        const row = worksheet.getRow(rowNumber);
        if (rowHasValue(row, maxColumns)) {
            pushIssue(issues, {
                code: 'BATAS_BARIS_TERLAMPAUI',
                message: `Data melebihi batas ${maxDataRows} baris pada sheet ${worksheet.name}.`,
                suggestion: 'Kurangi data dalam satu file import.',
                sheet: worksheet.name,
                row: rowNumber,
                column: null,
                cell: null,
            });
            break;
        }
    }
}

function findEndOfCentralDirectory(buffer: Buffer): number {
    const minimumOffset = Math.max(0, buffer.length - 65_557);
    for (let offset = buffer.length - 22; offset >= minimumOffset; offset -= 1) {
        if (buffer.readUInt32LE(offset) === 0x06054b50) return offset;
    }
    return -1;
}

/**
 * Performs bounded ZIP/OpenXML inspection before ExcelJS expands the workbook.
 * This rejects encrypted, ZIP64, path-traversal, macro, and external-link content.
 */
export function inspectQuestionImportArchive(buffer: Buffer): void {
    if (buffer.length < 22 || buffer.readUInt32LE(0) !== 0x04034b50) {
        throw new Error('Isi file bukan arsip XLSX/OpenXML yang valid.');
    }

    const eocdOffset = findEndOfCentralDirectory(buffer);
    if (eocdOffset < 0) throw new Error('Struktur akhir arsip XLSX tidak ditemukan.');

    const totalEntries = buffer.readUInt16LE(eocdOffset + 10);
    const centralDirectorySize = buffer.readUInt32LE(eocdOffset + 12);
    const centralDirectoryOffset = buffer.readUInt32LE(eocdOffset + 16);

    if (totalEntries === 0xffff || centralDirectorySize === 0xffffffff || centralDirectoryOffset === 0xffffffff) {
        throw new Error('Arsip ZIP64 tidak didukung untuk import soal.');
    }
    if (totalEntries < 1 || totalEntries > QUESTION_IMPORT_MAX_ZIP_ENTRIES) {
        throw new Error(`Jumlah komponen XLSX harus antara 1 dan ${QUESTION_IMPORT_MAX_ZIP_ENTRIES}.`);
    }
    if (centralDirectoryOffset + centralDirectorySize > buffer.length) {
        throw new Error('Direktori pusat arsip XLSX tidak valid.');
    }

    let offset = centralDirectoryOffset;
    let totalUncompressed = 0;
    const names = new Set<string>();

    for (let index = 0; index < totalEntries; index += 1) {
        if (offset + 46 > buffer.length || buffer.readUInt32LE(offset) !== 0x02014b50) {
            throw new Error('Komponen arsip XLSX rusak atau tidak lengkap.');
        }

        const flags = buffer.readUInt16LE(offset + 8);
        const uncompressedSize = buffer.readUInt32LE(offset + 24);
        const fileNameLength = buffer.readUInt16LE(offset + 28);
        const extraLength = buffer.readUInt16LE(offset + 30);
        const commentLength = buffer.readUInt16LE(offset + 32);
        const nameStart = offset + 46;
        const nameEnd = nameStart + fileNameLength;

        if ((flags & 0x0001) !== 0) throw new Error('Arsip XLSX terenkripsi tidak didukung.');
        if (uncompressedSize === 0xffffffff) throw new Error('Komponen ZIP64 tidak didukung.');
        if (nameEnd > buffer.length) throw new Error('Nama komponen arsip XLSX tidak valid.');

        const fileName = buffer.subarray(nameStart, nameEnd).toString('utf8').replace(/\\/g, '/');
        const lowerName = fileName.toLowerCase();
        if (!fileName || fileName.startsWith('/') || fileName.includes('../') || fileName.includes('\0')) {
            throw new Error('Arsip XLSX mengandung path komponen yang tidak aman.');
        }
        if (names.has(lowerName)) throw new Error('Arsip XLSX mengandung komponen duplikat.');
        names.add(lowerName);

        if (lowerName.endsWith('vbaproject.bin') || lowerName.includes('/macrosheets/')) {
            throw new Error('Macro tidak diizinkan dalam template import soal.');
        }
        if (lowerName.startsWith('xl/externallinks/')) {
            throw new Error('External workbook link tidak diizinkan dalam template import soal.');
        }
        if (lowerName.startsWith('xl/media/') || lowerName.startsWith('xl/drawings/')) {
            throw new Error('Embedded image atau drawing tidak didukung. Gunakan kolom URL gambar.');
        }
        if (
            lowerName.startsWith('xl/embeddings/')
            || lowerName.startsWith('xl/activex/')
            || lowerName === 'xl/connections.xml'
            || lowerName.startsWith('customui/')
        ) {
            throw new Error('Workbook mengandung objek aktif atau koneksi eksternal yang tidak diizinkan.');
        }

        totalUncompressed += uncompressedSize;
        if (totalUncompressed > QUESTION_IMPORT_MAX_UNCOMPRESSED_BYTES) {
            throw new Error('Ukuran hasil ekstraksi XLSX melebihi batas keamanan 25 MB.');
        }

        offset = nameEnd + extraLength + commentLength;
    }

    if (!names.has('[content_types].xml') || !names.has('xl/workbook.xml')) {
        throw new Error('Komponen wajib workbook XLSX tidak ditemukan.');
    }
}

function readMetaSheet(sheet: ExcelJS.Worksheet): Map<string, string> {
    const meta = new Map<string, string>();
    for (let rowNumber = 1; rowNumber <= Math.min(sheet.rowCount, 30); rowNumber += 1) {
        const row = sheet.getRow(rowNumber);
        const key = getCellText(row.getCell(1));
        const value = getCellText(row.getCell(2));
        if (key) meta.set(key, value);
    }
    return meta;
}

function parseQuestionRows(sheet: ExcelJS.Worksheet, issues: QuestionImportIssue[]): RawQuestionRow[] {
    const rows: RawQuestionRow[] = [];
    const lastRow = Math.min(sheet.rowCount, INPUT_FIRST_DATA_ROW + QUESTION_IMPORT_MAX_QUESTIONS - 1);

    for (let rowNumber = INPUT_FIRST_DATA_ROW; rowNumber <= lastRow; rowNumber += 1) {
        const row = sheet.getRow(rowNumber);
        if (!rowHasValue(row, QUESTION_HEADERS.length)) continue;

        const sourceCode = getCellText(row.getCell(1));
        const sourceKey = normalizeSourceKey(sourceCode);
        const orderText = getCellText(row.getCell(2));
        const typeText = getCellText(row.getCell(3));
        const questionText = getCellText(row.getCell(4));
        const pointsText = getCellText(row.getCell(5));
        const trueFalseKey = getCellText(row.getCell(6));
        const shortAnswerKey = getCellText(row.getCell(7));
        const imageUrl = getCellText(row.getCell(8));
        const importOrder = parseStrictInteger(orderText);
        const questionType = parseQuestionType(typeText);
        const points = parseStrictInteger(pointsText);

        if (!sourceCode) {
            cellIssue(issues, { code: 'KODE_SOAL_WAJIB', message: 'Kode Soal wajib diisi.', sheet: sheet.name, row: rowNumber, columnNumber: 1 });
        } else if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,49}$/.test(sourceCode)) {
            cellIssue(issues, {
                code: 'KODE_SOAL_TIDAK_VALID',
                message: 'Kode Soal hanya boleh berisi huruf, angka, tanda minus, atau garis bawah; maksimal 50 karakter.',
                suggestion: 'Gunakan format seperti Q001 atau MODUL1_Q01.',
                sheet: sheet.name,
                row: rowNumber,
                columnNumber: 1,
            });
        }
        if (importOrder === null || importOrder < 1) {
            cellIssue(issues, { code: 'URUTAN_TIDAK_VALID', message: 'Urutan harus berupa bilangan bulat positif.', sheet: sheet.name, row: rowNumber, columnNumber: 2 });
        }
        if (!questionType) {
            cellIssue(issues, {
                code: 'TIPE_SOAL_TIDAK_VALID',
                message: `Tipe soal "${typeText || '(kosong)'}" tidak didukung.`,
                suggestion: 'Pilih tipe dari dropdown template.',
                sheet: sheet.name,
                row: rowNumber,
                columnNumber: 3,
            });
        }
        if (questionText.length < 3 || questionText.length > 10_000) {
            cellIssue(issues, { code: 'PERTANYAAN_TIDAK_VALID', message: 'Pertanyaan wajib berisi 3 sampai 10.000 karakter.', sheet: sheet.name, row: rowNumber, columnNumber: 4 });
        }
        if (points === null || points < 1 || points > 100) {
            cellIssue(issues, { code: 'BOBOT_TIDAK_VALID', message: 'Bobot harus berupa bilangan bulat antara 1 dan 100.', sheet: sheet.name, row: rowNumber, columnNumber: 5 });
        }
        if (!isAllowedImageUrl(imageUrl)) {
            cellIssue(issues, {
                code: 'URL_GAMBAR_TIDAK_VALID',
                message: 'URL gambar harus berupa path /uploads/... atau URL HTTPS yang valid.',
                sheet: sheet.name,
                row: rowNumber,
                columnNumber: 8,
            });
        }

        rows.push({
            sourceCode,
            sourceKey,
            sourceRow: rowNumber,
            importOrder,
            questionType,
            questionTypeLabel: questionType ? QUESTION_IMPORT_TYPE_LABELS[questionType] : typeText,
            questionText,
            points,
            trueFalseKey,
            shortAnswerKey,
            imageUrl,
        });
    }

    return rows;
}

function parseOptionRows(sheet: ExcelJS.Worksheet, issues: QuestionImportIssue[]): RawOptionRow[] {
    const rows: RawOptionRow[] = [];
    const lastRow = Math.min(sheet.rowCount, INPUT_FIRST_DATA_ROW + QUESTION_IMPORT_MAX_CHILD_ROWS - 1);

    for (let rowNumber = INPUT_FIRST_DATA_ROW; rowNumber <= lastRow; rowNumber += 1) {
        const row = sheet.getRow(rowNumber);
        if (!rowHasValue(row, OPTION_HEADERS.length)) continue;

        const sourceCode = getCellText(row.getCell(1));
        const optionCode = getCellText(row.getCell(2)).toUpperCase();
        const optionText = getCellText(row.getCell(3));
        const correctText = getCellText(row.getCell(4));
        const imageUrl = getCellText(row.getCell(5));
        const isCorrect = parseYesNo(correctText);

        if (!sourceCode) cellIssue(issues, { code: 'REFERENSI_SOAL_WAJIB', message: 'Kode Soal wajib diisi pada setiap opsi.', sheet: sheet.name, row: rowNumber, columnNumber: 1 });
        if (!OPTION_CODE_ORDER.has(optionCode)) {
            cellIssue(issues, { code: 'KODE_OPSI_TIDAK_VALID', message: 'Kode Opsi harus A sampai J.', sheet: sheet.name, row: rowNumber, columnNumber: 2 });
        }
        if (!optionText || optionText.length > 2_000) {
            cellIssue(issues, { code: 'TEKS_OPSI_TIDAK_VALID', message: 'Teks Opsi wajib diisi dan maksimal 2.000 karakter.', sheet: sheet.name, row: rowNumber, columnNumber: 3 });
        }
        if (isCorrect === null) {
            cellIssue(issues, { code: 'PENANDA_KUNCI_TIDAK_VALID', message: 'Kolom Benar hanya menerima YA atau TIDAK.', sheet: sheet.name, row: rowNumber, columnNumber: 4 });
        }
        if (!isAllowedImageUrl(imageUrl)) {
            cellIssue(issues, { code: 'URL_GAMBAR_OPSI_TIDAK_VALID', message: 'URL gambar opsi harus berupa path /uploads/... atau URL HTTPS yang valid.', sheet: sheet.name, row: rowNumber, columnNumber: 5 });
        }

        rows.push({ sourceCode, sourceKey: normalizeSourceKey(sourceCode), sourceRow: rowNumber, optionCode, optionText, isCorrect, imageUrl });
    }

    return rows;
}

function parseMatchingRows(sheet: ExcelJS.Worksheet, issues: QuestionImportIssue[]): RawMatchingRow[] {
    const rows: RawMatchingRow[] = [];
    const lastRow = Math.min(sheet.rowCount, INPUT_FIRST_DATA_ROW + QUESTION_IMPORT_MAX_CHILD_ROWS - 1);

    for (let rowNumber = INPUT_FIRST_DATA_ROW; rowNumber <= lastRow; rowNumber += 1) {
        const row = sheet.getRow(rowNumber);
        if (!rowHasValue(row, MATCHING_HEADERS.length)) continue;

        const sourceCode = getCellText(row.getCell(1));
        const pairText = getCellText(row.getCell(2));
        const left = getCellText(row.getCell(3));
        const right = getCellText(row.getCell(4));
        const pairNumber = parseStrictInteger(pairText);

        if (!sourceCode) cellIssue(issues, { code: 'REFERENSI_SOAL_WAJIB', message: 'Kode Soal wajib diisi pada setiap pasangan.', sheet: sheet.name, row: rowNumber, columnNumber: 1 });
        if (pairNumber === null || pairNumber < 1) cellIssue(issues, { code: 'NOMOR_PASANGAN_TIDAK_VALID', message: 'No Pasangan harus berupa bilangan bulat positif.', sheet: sheet.name, row: rowNumber, columnNumber: 2 });
        if (!left || left.length > 2_000) cellIssue(issues, { code: 'ITEM_KIRI_TIDAK_VALID', message: 'Item Kiri wajib diisi dan maksimal 2.000 karakter.', sheet: sheet.name, row: rowNumber, columnNumber: 3 });
        if (!right || right.length > 2_000) cellIssue(issues, { code: 'PASANGAN_KANAN_TIDAK_VALID', message: 'Pasangan Kanan wajib diisi dan maksimal 2.000 karakter.', sheet: sheet.name, row: rowNumber, columnNumber: 4 });

        rows.push({ sourceCode, sourceKey: normalizeSourceKey(sourceCode), sourceRow: rowNumber, pairNumber, left, right });
    }

    return rows;
}

function validateQuestionRelationships(
    questions: RawQuestionRow[],
    options: RawOptionRow[],
    matchingRows: RawMatchingRow[],
    issues: QuestionImportIssue[],
): CanonicalImportedQuestion[] {
    const canonical: CanonicalImportedQuestion[] = [];
    const questionByKey = new Map<string, RawQuestionRow>();
    const orderToRow = new Map<number, number>();

    for (const question of questions) {
        if (question.sourceKey) {
            const duplicate = questionByKey.get(question.sourceKey);
            if (duplicate) {
                cellIssue(issues, {
                    code: 'KODE_SOAL_DUPLIKAT',
                    message: `Kode Soal "${question.sourceCode}" duplikat dengan baris ${duplicate.sourceRow}.`,
                    sheet: 'SOAL',
                    row: question.sourceRow,
                    columnNumber: 1,
                });
            } else {
                questionByKey.set(question.sourceKey, question);
            }
        }
        if (question.importOrder !== null) {
            const duplicateOrderRow = orderToRow.get(question.importOrder);
            if (duplicateOrderRow) {
                cellIssue(issues, {
                    code: 'URUTAN_DUPLIKAT',
                    message: `Urutan ${question.importOrder} sudah digunakan pada baris ${duplicateOrderRow}.`,
                    sheet: 'SOAL',
                    row: question.sourceRow,
                    columnNumber: 2,
                });
            } else {
                orderToRow.set(question.importOrder, question.sourceRow);
            }
        }
    }

    if (questions.length > QUESTION_IMPORT_MAX_QUESTIONS) {
        pushIssue(issues, {
            code: 'JUMLAH_SOAL_TERLAMPAUI',
            message: `Maksimal ${QUESTION_IMPORT_MAX_QUESTIONS} soal dalam satu import.`,
            suggestion: 'Bagi bank soal menjadi beberapa file.',
            sheet: 'SOAL', row: null, column: null, cell: null,
        });
    }

    if (questions.length > 0) {
        const sortedOrders = questions
            .map((question) => question.importOrder)
            .filter((value): value is number => value !== null)
            .sort((a, b) => a - b);
        for (let index = 0; index < sortedOrders.length; index += 1) {
            if (sortedOrders[index] !== index + 1) {
                pushIssue(issues, {
                    code: 'URUTAN_TIDAK_KONTIGU',
                    message: `Urutan soal harus lengkap dari 1 sampai ${questions.length} tanpa loncatan.`,
                    suggestion: 'Perbaiki kolom Urutan pada sheet SOAL.',
                    sheet: 'SOAL', row: null, column: 'B', cell: null,
                });
                break;
            }
        }
    }

    const optionsByQuestion = new Map<string, RawOptionRow[]>();
    for (const option of options) {
        if (!questionByKey.has(option.sourceKey)) {
            cellIssue(issues, {
                code: 'OPSI_TANPA_SOAL',
                message: `Kode Soal "${option.sourceCode || '(kosong)'}" tidak ditemukan di sheet SOAL.`,
                sheet: 'OPSI', row: option.sourceRow, columnNumber: 1,
            });
            continue;
        }
        const group = optionsByQuestion.get(option.sourceKey) ?? [];
        group.push(option);
        optionsByQuestion.set(option.sourceKey, group);
    }

    const matchingByQuestion = new Map<string, RawMatchingRow[]>();
    for (const pair of matchingRows) {
        if (!questionByKey.has(pair.sourceKey)) {
            cellIssue(issues, {
                code: 'PASANGAN_TANPA_SOAL',
                message: `Kode Soal "${pair.sourceCode || '(kosong)'}" tidak ditemukan di sheet SOAL.`,
                sheet: 'PASANGAN', row: pair.sourceRow, columnNumber: 1,
            });
            continue;
        }
        const group = matchingByQuestion.get(pair.sourceKey) ?? [];
        group.push(pair);
        matchingByQuestion.set(pair.sourceKey, group);
    }

    for (const question of questions) {
        if (!question.sourceKey || !question.questionType || question.importOrder === null || question.points === null) continue;

        const questionOptions = (optionsByQuestion.get(question.sourceKey) ?? [])
            .sort((a, b) => (OPTION_CODE_ORDER.get(a.optionCode) ?? 99) - (OPTION_CODE_ORDER.get(b.optionCode) ?? 99));
        const questionPairs = (matchingByQuestion.get(question.sourceKey) ?? [])
            .sort((a, b) => (a.pairNumber ?? Number.MAX_SAFE_INTEGER) - (b.pairNumber ?? Number.MAX_SAFE_INTEGER));
        const baseInput: QuestionImportInput = {
            exam_id: '',
            question_type: question.questionType,
            question_text: question.questionText,
            question_image: question.imageUrl || null,
            points: question.points,
        };

        if (question.questionType !== 'multiple_choice' && question.questionType !== 'multiple_select' && questionOptions.length > 0) {
            cellIssue(issues, {
                code: 'OPSI_TIDAK_SESUAI_TIPE',
                message: `Soal ${question.sourceCode} bertipe ${QUESTION_IMPORT_TYPE_LABELS[question.questionType]} tidak boleh memiliki baris OPSI.`,
                sheet: 'OPSI', row: questionOptions[0].sourceRow, columnNumber: 1,
            });
        }
        if (question.questionType !== 'matching' && questionPairs.length > 0) {
            cellIssue(issues, {
                code: 'PASANGAN_TIDAK_SESUAI_TIPE',
                message: `Soal ${question.sourceCode} bertipe ${QUESTION_IMPORT_TYPE_LABELS[question.questionType]} tidak boleh memiliki baris PASANGAN.`,
                sheet: 'PASANGAN', row: questionPairs[0].sourceRow, columnNumber: 1,
            });
        }

        switch (question.questionType) {
            case 'multiple_choice':
            case 'multiple_select': {
                if (questionOptions.length < 2 || questionOptions.length > QUESTION_IMPORT_MAX_OPTIONS) {
                    cellIssue(issues, {
                        code: 'JUMLAH_OPSI_TIDAK_VALID',
                        message: `${QUESTION_IMPORT_TYPE_LABELS[question.questionType]} membutuhkan 2 sampai ${QUESTION_IMPORT_MAX_OPTIONS} opsi.`,
                        sheet: 'SOAL', row: question.sourceRow, columnNumber: 3,
                    });
                }
                const seenOptionCodes = new Map<string, number>();
                const seenOptionTexts = new Map<string, number>();
                for (const option of questionOptions) {
                    const previousCodeRow = seenOptionCodes.get(option.optionCode);
                    if (previousCodeRow) {
                        cellIssue(issues, { code: 'KODE_OPSI_DUPLIKAT', message: `Kode Opsi ${option.optionCode} duplikat dengan baris ${previousCodeRow}.`, sheet: 'OPSI', row: option.sourceRow, columnNumber: 2 });
                    } else seenOptionCodes.set(option.optionCode, option.sourceRow);

                    const comparableText = normalizeComparable(option.optionText);
                    const previousTextRow = seenOptionTexts.get(comparableText);
                    if (comparableText && previousTextRow) {
                        cellIssue(issues, { code: 'TEKS_OPSI_DUPLIKAT', message: `Teks opsi duplikat dengan baris ${previousTextRow}.`, sheet: 'OPSI', row: option.sourceRow, columnNumber: 3 });
                    } else if (comparableText) seenOptionTexts.set(comparableText, option.sourceRow);
                }
                const correctIndices = questionOptions
                    .map((option, index) => option.isCorrect === true ? index : null)
                    .filter((index): index is number => index !== null);
                if (question.questionType === 'multiple_choice' && correctIndices.length !== 1) {
                    cellIssue(issues, {
                        code: 'KUNCI_PILIHAN_GANDA_TIDAK_VALID',
                        message: `Pilihan Ganda harus memiliki tepat satu opsi YA; ditemukan ${correctIndices.length}.`,
                        sheet: 'SOAL', row: question.sourceRow, columnNumber: 3,
                    });
                }
                if (question.questionType === 'multiple_select' && correctIndices.length < 1) {
                    cellIssue(issues, {
                        code: 'KUNCI_MULTI_JAWABAN_KOSONG',
                        message: 'Multi-Jawaban harus memiliki minimal satu opsi YA.',
                        sheet: 'SOAL', row: question.sourceRow, columnNumber: 3,
                    });
                }
                if (question.trueFalseKey || question.shortAnswerKey) {
                    cellIssue(issues, {
                        code: 'KUNCI_TEKS_TIDAK_SESUAI_TIPE',
                        message: 'Kolom kunci teks harus kosong untuk soal pilihan.',
                        sheet: 'SOAL', row: question.sourceRow, columnNumber: question.trueFalseKey ? 6 : 7,
                    });
                }
                baseInput.options = questionOptions.map((option) => ({ text: option.optionText, image: option.imageUrl || null }));
                if (question.questionType === 'multiple_choice') baseInput.correct_option_index = correctIndices[0];
                else baseInput.correct_option_indices = correctIndices;
                break;
            }
            case 'true_false': {
                const answerIndex = parseTrueFalseKey(question.trueFalseKey);
                if (answerIndex === null) {
                    cellIssue(issues, {
                        code: 'KUNCI_BENAR_SALAH_TIDAK_VALID',
                        message: 'Kunci Benar/Salah wajib berisi BENAR atau SALAH.',
                        sheet: 'SOAL', row: question.sourceRow, columnNumber: 6,
                    });
                } else baseInput.correct_option_index = answerIndex;
                if (question.shortAnswerKey) {
                    cellIssue(issues, { code: 'KUNCI_ISIAN_TIDAK_SESUAI_TIPE', message: 'Kunci Isian Singkat harus kosong untuk soal Benar/Salah.', sheet: 'SOAL', row: question.sourceRow, columnNumber: 7 });
                }
                break;
            }
            case 'short_answer':
                if (!question.shortAnswerKey || question.shortAnswerKey.length > 2_000) {
                    cellIssue(issues, { code: 'KUNCI_ISIAN_TIDAK_VALID', message: 'Kunci Isian Singkat wajib diisi dan maksimal 2.000 karakter.', sheet: 'SOAL', row: question.sourceRow, columnNumber: 7 });
                } else baseInput.correct_answer = question.shortAnswerKey;
                if (question.trueFalseKey) {
                    cellIssue(issues, { code: 'KUNCI_BENAR_SALAH_TIDAK_SESUAI_TIPE', message: 'Kunci Benar/Salah harus kosong untuk Isian Singkat.', sheet: 'SOAL', row: question.sourceRow, columnNumber: 6 });
                }
                break;
            case 'essay':
                if (question.trueFalseKey || question.shortAnswerKey) {
                    cellIssue(issues, { code: 'KUNCI_ESAI_HARUS_KOSONG', message: 'Soal Esai dinilai manual; kedua kolom kunci harus kosong.', sheet: 'SOAL', row: question.sourceRow, columnNumber: question.trueFalseKey ? 6 : 7 });
                }
                break;
            case 'matching': {
                if (questionPairs.length < 2) {
                    cellIssue(issues, { code: 'PASANGAN_KURANG', message: 'Soal Menjodohkan membutuhkan minimal dua pasangan.', sheet: 'SOAL', row: question.sourceRow, columnNumber: 3 });
                }
                const seenNumbers = new Map<number, number>();
                const seenLefts = new Map<string, number>();
                const seenRights = new Map<string, number>();
                for (const pair of questionPairs) {
                    if (pair.pairNumber !== null) {
                        const previous = seenNumbers.get(pair.pairNumber);
                        if (previous) cellIssue(issues, { code: 'NOMOR_PASANGAN_DUPLIKAT', message: `No Pasangan ${pair.pairNumber} duplikat dengan baris ${previous}.`, sheet: 'PASANGAN', row: pair.sourceRow, columnNumber: 2 });
                        else seenNumbers.set(pair.pairNumber, pair.sourceRow);
                    }
                    const leftKey = normalizeComparable(pair.left);
                    const rightKey = normalizeComparable(pair.right);
                    const previousLeft = seenLefts.get(leftKey);
                    const previousRight = seenRights.get(rightKey);
                    if (leftKey && previousLeft) cellIssue(issues, { code: 'ITEM_KIRI_DUPLIKAT', message: `Item Kiri duplikat dengan baris ${previousLeft}.`, sheet: 'PASANGAN', row: pair.sourceRow, columnNumber: 3 });
                    else if (leftKey) seenLefts.set(leftKey, pair.sourceRow);
                    if (rightKey && previousRight) cellIssue(issues, { code: 'PASANGAN_KANAN_DUPLIKAT', message: `Pasangan Kanan duplikat dengan baris ${previousRight}.`, sheet: 'PASANGAN', row: pair.sourceRow, columnNumber: 4 });
                    else if (rightKey) seenRights.set(rightKey, pair.sourceRow);
                }
                const pairNumbers = questionPairs.map((pair) => pair.pairNumber).filter((value): value is number => value !== null).sort((a, b) => a - b);
                for (let index = 0; index < pairNumbers.length; index += 1) {
                    if (pairNumbers[index] !== index + 1) {
                        cellIssue(issues, { code: 'NOMOR_PASANGAN_TIDAK_KONTIGU', message: `No Pasangan untuk ${question.sourceCode} harus lengkap dari 1 sampai ${questionPairs.length}.`, sheet: 'SOAL', row: question.sourceRow, columnNumber: 3 });
                        break;
                    }
                }
                if (question.trueFalseKey || question.shortAnswerKey) {
                    cellIssue(issues, { code: 'KUNCI_TEKS_TIDAK_SESUAI_TIPE', message: 'Kolom kunci teks harus kosong untuk soal Menjodohkan.', sheet: 'SOAL', row: question.sourceRow, columnNumber: question.trueFalseKey ? 6 : 7 });
                }
                baseInput.matching_pairs = questionPairs.map((pair) => ({ left: pair.left, right: pair.right }));
                break;
            }
        }

        canonical.push({
            source_code: question.sourceCode,
            source_row: question.sourceRow,
            import_order: question.importOrder,
            input: baseInput,
        });
    }

    return canonical.sort((a, b) => a.import_order - b.import_order);
}

export async function parseAndValidateQuestionImport(
    buffer: Buffer,
    examId: string,
): Promise<QuestionImportParseResult> {
    const fileSha256 = crypto.createHash('sha256').update(buffer).digest('hex');
    const issues: QuestionImportIssue[] = [];
    let templateVersion: string | null = null;
    const emptySummary: QuestionImportSummary = {
        totalQuestions: 0,
        totalPoints: 0,
        totalOptions: 0,
        totalMatchingPairs: 0,
        byType: emptyTypeCounts(),
    };

    if (buffer.length > QUESTION_IMPORT_MAX_FILE_BYTES) {
        pushIssue(issues, {
            code: 'FILE_TERLALU_BESAR',
            message: 'Ukuran file melebihi batas 5 MB.',
            suggestion: 'Gunakan template tanpa embedded image dan kurangi jumlah data.',
            sheet: 'FILE', row: null, column: null, cell: null,
        });
        return { valid: false, templateVersion, fileSha256, questions: [], previewRows: [], issues, summary: emptySummary };
    }

    try {
        inspectQuestionImportArchive(buffer);
    } catch (error) {
        pushIssue(issues, {
            code: 'ARSIP_XLSX_TIDAK_VALID',
            message: error instanceof Error ? error.message : 'Arsip XLSX tidak valid.',
            suggestion: 'Unduh ulang template resmi dan simpan sebagai .xlsx.',
            sheet: 'FILE', row: null, column: null, cell: null,
        });
        return { valid: false, templateVersion, fileSha256, questions: [], previewRows: [], issues, summary: emptySummary };
    }

    const workbook = new ExcelJS.Workbook();
    try {
        // @ts-expect-error ExcelJS Buffer type is compatible with Node Buffer at runtime.
        await workbook.xlsx.load(buffer);
    } catch {
        pushIssue(issues, {
            code: 'WORKBOOK_TIDAK_DAPAT_DIBACA',
            message: 'Workbook tidak dapat dibaca atau strukturnya rusak.',
            suggestion: 'Gunakan template resmi dan jangan mengubah format file.',
            sheet: 'FILE', row: null, column: null, cell: null,
        });
        return { valid: false, templateVersion, fileSha256, questions: [], previewRows: [], issues, summary: emptySummary };
    }

    const metaSheet = workbook.getWorksheet('_META');
    const questionSheet = workbook.getWorksheet('SOAL');
    const optionSheet = workbook.getWorksheet('OPSI');
    const matchingSheet = workbook.getWorksheet('PASANGAN');
    const requiredSheets = [
        ['_META', metaSheet],
        ['SOAL', questionSheet],
        ['OPSI', optionSheet],
        ['PASANGAN', matchingSheet],
    ] as const;

    for (const [name, sheet] of requiredSheets) {
        if (!sheet) {
            pushIssue(issues, {
                code: 'SHEET_WAJIB_HILANG',
                message: `Sheet wajib "${name}" tidak ditemukan.`,
                suggestion: 'Gunakan template resmi tanpa mengganti nama sheet.',
                sheet: name, row: null, column: null, cell: null,
            });
        }
    }

    if (!metaSheet || !questionSheet || !optionSheet || !matchingSheet) {
        return { valid: false, templateVersion, fileSha256, questions: [], previewRows: [], issues, summary: emptySummary };
    }

    const meta = readMetaSheet(metaSheet);
    templateVersion = meta.get('template_version') ?? null;
    if (meta.get('template_kind') !== 'exam_questions') {
        pushIssue(issues, {
            code: 'JENIS_TEMPLATE_TIDAK_VALID',
            message: 'File bukan template import soal LMS.',
            suggestion: 'Unduh template melalui halaman Import Soal.',
            sheet: '_META', row: 1, column: 'B', cell: 'B1',
        });
    }
    if (templateVersion !== QUESTION_IMPORT_TEMPLATE_VERSION) {
        pushIssue(issues, {
            code: 'VERSI_TEMPLATE_TIDAK_DIDUKUNG',
            message: `Versi template ${templateVersion || '(tidak ditemukan)'} tidak didukung; versi aktif adalah ${QUESTION_IMPORT_TEMPLATE_VERSION}.`,
            suggestion: 'Unduh template terbaru dari sistem.',
            sheet: '_META', row: 2, column: 'B', cell: 'B2',
        });
    }

    validateSheetHeaders(questionSheet, QUESTION_HEADERS, issues);
    validateSheetHeaders(optionSheet, OPTION_HEADERS, issues);
    validateSheetHeaders(matchingSheet, MATCHING_HEADERS, issues);
    validateInputCellSafety(questionSheet, QUESTION_HEADERS.length, QUESTION_IMPORT_MAX_QUESTIONS, issues);
    validateInputCellSafety(optionSheet, OPTION_HEADERS.length, QUESTION_IMPORT_MAX_CHILD_ROWS, issues);
    validateInputCellSafety(matchingSheet, MATCHING_HEADERS.length, QUESTION_IMPORT_MAX_CHILD_ROWS, issues);

    const questionRows = parseQuestionRows(questionSheet, issues);
    const optionRows = parseOptionRows(optionSheet, issues);
    const matchingRows = parseMatchingRows(matchingSheet, issues);

    if (questionRows.length === 0) {
        pushIssue(issues, {
            code: 'SOAL_KOSONG',
            message: 'Tidak ada soal yang ditemukan pada sheet SOAL.',
            suggestion: 'Isi data mulai baris 5.',
            sheet: 'SOAL', row: INPUT_FIRST_DATA_ROW, column: null, cell: null,
        });
    }
    if (optionRows.length + matchingRows.length > QUESTION_IMPORT_MAX_CHILD_ROWS) {
        pushIssue(issues, {
            code: 'JUMLAH_DETAIL_TERLAMPAUI',
            message: `Total baris OPSI dan PASANGAN melebihi batas ${QUESTION_IMPORT_MAX_CHILD_ROWS}.`,
            suggestion: 'Bagi bank soal menjadi beberapa file.',
            sheet: 'FILE', row: null, column: null, cell: null,
        });
    }

    const canonical = validateQuestionRelationships(questionRows, optionRows, matchingRows, issues);
    canonical.forEach((question) => { question.input.exam_id = examId; });

    const byType = emptyTypeCounts();
    let totalPoints = 0;
    for (const question of questionRows) {
        if (question.questionType) byType[question.questionType] += 1;
        if (question.points !== null && question.points >= 1 && question.points <= 100) totalPoints += question.points;
    }
    const summary: QuestionImportSummary = {
        totalQuestions: questionRows.length,
        totalPoints,
        totalOptions: optionRows.length,
        totalMatchingPairs: matchingRows.length,
        byType,
    };
    const previewRows: QuestionImportPreviewRow[] = questionRows
        .map((question) => ({
            source_code: question.sourceCode,
            source_row: question.sourceRow,
            import_order: question.importOrder,
            question_type: question.questionType,
            question_type_label: question.questionTypeLabel,
            question_text: question.questionText,
            points: question.points,
        }))
        .sort((a, b) => (a.import_order ?? Number.MAX_SAFE_INTEGER) - (b.import_order ?? Number.MAX_SAFE_INTEGER));

    issues.sort((a, b) => {
        if (a.severity !== b.severity) return a.severity === 'error' ? -1 : 1;
        if (a.sheet !== b.sheet) return a.sheet.localeCompare(b.sheet);
        return (a.row ?? 0) - (b.row ?? 0);
    });

    return {
        valid: !issues.some((issue) => issue.severity === 'error'),
        templateVersion,
        fileSha256,
        questions: canonical,
        previewRows,
        issues,
        summary,
    };
}

function applyInputSheetLayout(
    sheet: ExcelJS.Worksheet,
    title: string,
    note: string,
    headers: readonly string[],
    widths: number[],
    accent: string,
): void {
    sheet.views = [{ state: 'frozen', ySplit: 4, activeCell: 'A5', showGridLines: false }];
    sheet.mergeCells(1, 1, 1, headers.length);
    const titleCell = sheet.getCell(1, 1);
    titleCell.value = title;
    titleCell.font = { name: 'Aptos Display', size: 15, bold: true, color: { argb: COLORS.white } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: accent } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    sheet.getRow(1).height = 32;

    sheet.mergeCells(2, 1, 2, headers.length);
    const noteCell = sheet.getCell(2, 1);
    noteCell.value = note;
    noteCell.font = { name: 'Aptos', size: 9.5, italic: true, color: { argb: COLORS.slate } };
    noteCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.lightSlate } };
    noteCell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true, indent: 1 };
    sheet.getRow(2).height = 30;
    sheet.getRow(3).height = 8;

    const headerRow = sheet.getRow(INPUT_HEADER_ROW);
    headerRow.values = [...headers];
    headerRow.height = 28;
    headerRow.eachCell((cell) => {
        cell.font = { name: 'Aptos', size: 10, bold: true, color: { argb: COLORS.white } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.navy } };
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        cell.border = {
            top: { style: 'thin', color: { argb: COLORS.navy } },
            bottom: { style: 'thin', color: { argb: COLORS.navy } },
        };
    });
    widths.forEach((width, index) => { sheet.getColumn(index + 1).width = width; });
    sheet.autoFilter = { from: { row: INPUT_HEADER_ROW, column: 1 }, to: { row: INPUT_HEADER_ROW, column: headers.length } };
}

function styleExampleTable(sheet: ExcelJS.Worksheet, rangeStart: number, rangeEnd: number): void {
    const header = sheet.getRow(rangeStart);
    header.eachCell((cell) => {
        cell.font = { name: 'Aptos', size: 10, bold: true, color: { argb: COLORS.white } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.navy } };
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    });
    for (let row = rangeStart + 1; row <= rangeEnd; row += 1) {
        const target = sheet.getRow(row);
        target.eachCell((cell) => {
            cell.font = { name: 'Aptos', size: 9.5, color: { argb: COLORS.navy } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: row % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC' } };
            cell.alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
            cell.border = { bottom: { style: 'hair', color: { argb: COLORS.border } } };
        });
        target.height = 34;
    }
}

export async function generateQuestionImportTemplateXlsx(): Promise<Uint8Array> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'LMS Nusamitra';
    workbook.company = 'Nusamitra Consulting';
    workbook.subject = 'Template Import Soal Ujian';
    workbook.title = 'Template Import Soal LMS Nusamitra';
    workbook.description = `Template versi ${QUESTION_IMPORT_TEMPLATE_VERSION} untuk enam tipe soal.`;
    workbook.created = new Date();
    workbook.calcProperties.fullCalcOnLoad = true;

    const guide = workbook.addWorksheet('PETUNJUK', { properties: { tabColor: { argb: COLORS.blue } }, views: [{ showGridLines: false }] });
    guide.columns = [{ width: 4 }, { width: 28 }, { width: 92 }];
    guide.mergeCells('A1:C1');
    guide.getCell('A1').value = 'PANDUAN TEMPLATE IMPORT SOAL LMS NUSAMITRA';
    guide.getCell('A1').font = { name: 'Aptos Display', size: 17, bold: true, color: { argb: COLORS.white } };
    guide.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.navy } };
    guide.getCell('A1').alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    guide.getRow(1).height = 38;
    guide.mergeCells('A2:C2');
    guide.getCell('A2').value = `Versi ${QUESTION_IMPORT_TEMPLATE_VERSION} • XLSX-only • Append-only • Semua data divalidasi sebelum disimpan`;
    guide.getCell('A2').font = { name: 'Aptos', size: 10, italic: true, color: { argb: COLORS.slate } };
    guide.getCell('A2').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.lightSlate } };
    guide.getCell('A2').alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    guide.getRow(2).height = 25;

    const guideRows: Array<[number | string, string, string]> = [
        [1, 'Isi sheet SOAL', 'Satu baris untuk satu soal. Kode Soal harus unik dan Urutan harus lengkap mulai 1 tanpa loncatan.'],
        [2, 'Isi sheet OPSI', 'Hanya untuk Pilihan Ganda dan Multi-Jawaban. Gunakan Kode Opsi A–J dan tandai YA pada jawaban benar.'],
        [3, 'Isi sheet PASANGAN', 'Hanya untuk Menjodohkan. Minimal dua pasangan; Item Kiri dan Pasangan Kanan tidak boleh duplikat.'],
        [4, 'Periksa kunci', 'Benar/Salah menggunakan BENAR atau SALAH. Isian Singkat menerima satu kunci dan dicocokkan tanpa membedakan kapital. Esai dinilai manual.'],
        [5, 'Simpan sebagai XLSX', 'Jangan mengubah nama sheet, nama header, atau menambahkan formula/merged cell pada area input. Embedded image tidak didukung.'],
        [6, 'Upload dan preview', 'Sistem menampilkan jumlah soal, total bobot, serta lokasi setiap error. Tidak ada data yang disimpan selama masih ada error.'],
    ];
    guide.getRow(4).values = ['No', 'Tahap', 'Petunjuk'];
    guide.getRow(4).height = 27;
    guide.getRow(4).eachCell((cell) => {
        cell.font = { name: 'Aptos', size: 10, bold: true, color: { argb: COLORS.white } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.blue } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });
    guideRows.forEach((values, index) => {
        const row = guide.getRow(5 + index);
        row.values = values;
        row.height = 38;
        row.eachCell((cell, columnNumber) => {
            cell.font = { name: 'Aptos', size: 10, color: { argb: COLORS.navy }, bold: columnNumber === 2 };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: index % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC' } };
            cell.alignment = { vertical: 'top', horizontal: columnNumber === 1 ? 'center' : 'left', wrapText: true };
            cell.border = { bottom: { style: 'hair', color: { argb: COLORS.border } } };
        });
    });

    guide.mergeCells('A13:C13');
    guide.getCell('A13').value = 'ATURAN PENILAIAN YANG BERLAKU';
    guide.getCell('A13').font = { name: 'Aptos', size: 11, bold: true, color: { argb: COLORS.amber } };
    guide.getCell('A13').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.amberLight } };
    guide.getCell('A13').alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    guide.getRow(13).height = 26;
    guide.mergeCells('A14:C15');
    guide.getCell('A14').value = 'Multi-Jawaban dan Menjodohkan dinilai all-or-nothing: seluruh pilihan/pasangan harus tepat untuk memperoleh poin. Isian Singkat hanya memiliki satu kunci jawaban. Soal Esai dinilai manual oleh Admin/Trainer.';
    guide.getCell('A14').font = { name: 'Aptos', size: 10, color: { argb: COLORS.navy } };
    guide.getCell('A14').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
    guide.getCell('A14').alignment = { vertical: 'top', horizontal: 'left', wrapText: true, indent: 1 };

    guide.mergeCells('A17:C17');
    guide.getCell('A17').value = 'REFERENSI BEST PRACTICE';
    guide.getCell('A17').font = { name: 'Aptos', size: 11, bold: true, color: { argb: COLORS.green } };
    guide.getCell('A17').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.greenLight } };
    guide.getCell('A17').alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    const sources = [
        'https://www.1edtech.org/standards/qti/index',
        'https://support.microsoft.com/en-US/Excel/get-started/apply-data-validation-to-cells',
        'https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html',
    ];
    sources.forEach((url, index) => {
        guide.mergeCells(18 + index, 1, 18 + index, 3);
        guide.getCell(18 + index, 1).value = url;
        guide.getCell(18 + index, 1).font = { name: 'Aptos', size: 9, color: { argb: COLORS.blue }, underline: true };
        guide.getCell(18 + index, 1).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    });

    const questions = workbook.addWorksheet('SOAL', { properties: { tabColor: { argb: COLORS.blue } } });
    applyInputSheetLayout(
        questions,
        'SOAL — Satu Baris per Pertanyaan',
        'Kolom bertanda * wajib. Gunakan dropdown Tipe. Urutan harus 1, 2, 3, ... tanpa duplikat atau loncatan.',
        QUESTION_HEADERS,
        [20, 12, 22, 58, 12, 24, 30, 42],
        COLORS.blue,
    );
    questions.getColumn(1).numFmt = '@';
    questions.getColumn(2).numFmt = '0';
    questions.getColumn(5).numFmt = '0';

    const options = workbook.addWorksheet('OPSI', { properties: { tabColor: { argb: COLORS.green } } });
    applyInputSheetLayout(
        options,
        'OPSI — Pilihan Ganda dan Multi-Jawaban',
        'Setiap baris adalah satu opsi. Pilihan Ganda harus tepat satu YA; Multi-Jawaban minimal satu YA. Maksimal 10 opsi per soal.',
        OPTION_HEADERS,
        [20, 16, 58, 24, 42],
        COLORS.green,
    );
    options.getColumn(1).numFmt = '@';
    options.getColumn(2).numFmt = '@';

    const matching = workbook.addWorksheet('PASANGAN', { properties: { tabColor: { argb: COLORS.purple } } });
    applyInputSheetLayout(
        matching,
        'PASANGAN — Soal Menjodohkan',
        'Setiap baris adalah satu pasangan. Nomor harus 1, 2, 3, ...; minimal dua pasangan untuk setiap soal.',
        MATCHING_HEADERS,
        [20, 18, 54, 54],
        COLORS.purple,
    );
    matching.getColumn(1).numFmt = '@';
    matching.getColumn(2).numFmt = '0';

    for (let row = INPUT_FIRST_DATA_ROW; row < INPUT_FIRST_DATA_ROW + QUESTION_IMPORT_MAX_QUESTIONS; row += 1) {
        questions.getCell(row, 2).dataValidation = {
            type: 'whole', operator: 'between', allowBlank: false,
            formulae: [1, QUESTION_IMPORT_MAX_QUESTIONS],
            showErrorMessage: true, errorTitle: 'Urutan tidak valid', error: `Masukkan bilangan bulat 1–${QUESTION_IMPORT_MAX_QUESTIONS}.`,
        };
        questions.getCell(row, 3).dataValidation = {
            type: 'list', allowBlank: false, formulae: ["'_REFERENSI'!$A$2:$A$7"],
            showErrorMessage: true, errorTitle: 'Tipe soal tidak valid', error: 'Pilih tipe soal dari dropdown.',
        };
        questions.getCell(row, 5).dataValidation = {
            type: 'whole', operator: 'between', allowBlank: false, formulae: [1, 100],
            showErrorMessage: true, errorTitle: 'Bobot tidak valid', error: 'Bobot harus bilangan bulat 1–100.',
        };
        questions.getCell(row, 6).dataValidation = {
            type: 'list', allowBlank: true, formulae: ["'_REFERENSI'!$B$2:$B$3"],
            showErrorMessage: true, errorTitle: 'Kunci tidak valid', error: 'Pilih BENAR atau SALAH.',
        };
    }
    for (let row = INPUT_FIRST_DATA_ROW; row < INPUT_FIRST_DATA_ROW + QUESTION_IMPORT_MAX_CHILD_ROWS; row += 1) {
        options.getCell(row, 2).dataValidation = {
            type: 'list', allowBlank: false, formulae: ["'_REFERENSI'!$C$2:$C$11"],
            showErrorMessage: true, errorTitle: 'Kode opsi tidak valid', error: 'Pilih kode A sampai J.',
        };
        options.getCell(row, 4).dataValidation = {
            type: 'list', allowBlank: false, formulae: ["'_REFERENSI'!$D$2:$D$3"],
            showErrorMessage: true, errorTitle: 'Penanda kunci tidak valid', error: 'Pilih YA atau TIDAK.',
        };
        matching.getCell(row, 2).dataValidation = {
            type: 'whole', operator: 'between', allowBlank: false, formulae: [1, QUESTION_IMPORT_MAX_CHILD_ROWS],
            showErrorMessage: true, errorTitle: 'Nomor pasangan tidak valid', error: 'Masukkan bilangan bulat positif.',
        };
    }

    const examples = workbook.addWorksheet('CONTOH_6_TIPE', { properties: { tabColor: { argb: COLORS.amber } }, views: [{ showGridLines: false }] });
    examples.columns = [{ width: 16 }, { width: 22 }, { width: 48 }, { width: 50 }, { width: 24 }, { width: 48 }];
    examples.mergeCells('A1:F1');
    examples.getCell('A1').value = 'CONTOH PENGISIAN ENAM TIPE SOAL — JANGAN DIIMPORT';
    examples.getCell('A1').font = { name: 'Aptos Display', size: 15, bold: true, color: { argb: COLORS.white } };
    examples.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.amber } };
    examples.getCell('A1').alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    examples.getRow(1).height = 32;
    examples.getRow(3).values = ['Kode Soal', 'Tipe', 'Pertanyaan', 'Data Detail', 'Kunci', 'Catatan'];
    const exampleRows = [
        ['Q001', 'Pilihan Ganda', 'Ibu kota Indonesia adalah ...', 'OPSI: A=Jakarta (YA), B=Bandung (TIDAK)', 'Ditandai di OPSI', 'Tepat satu opsi YA'],
        ['Q002', 'Multi-Jawaban', 'Pilih warna primer.', 'OPSI: A=Merah (YA), B=Biru (YA), C=Hijau (TIDAK)', 'Ditandai di OPSI', 'Minimal satu opsi YA; dinilai all-or-nothing'],
        ['Q003', 'Benar/Salah', 'Air membeku pada 0°C pada tekanan normal.', '-', 'BENAR', 'Tidak perlu baris OPSI'],
        ['Q004', 'Isian Singkat', 'Singkatan dari Teknologi Informasi adalah ...', '-', 'TI', 'Satu kunci; kapital diabaikan'],
        ['Q005', 'Esai', 'Jelaskan manfaat transformasi digital.', '-', '-', 'Dinilai manual oleh Admin/Trainer'],
        ['Q006', 'Menjodohkan', 'Pasangkan negara dan ibu kotanya.', 'PASANGAN: Indonesia→Jakarta; Jepang→Tokyo', 'Ditandai di PASANGAN', 'Minimal dua pasangan; all-or-nothing'],
    ];
    exampleRows.forEach((values, index) => { examples.getRow(4 + index).values = values; });
    styleExampleTable(examples, 3, 9);
    examples.views = [{ state: 'frozen', ySplit: 3, showGridLines: false }];

    const meta = workbook.addWorksheet('_META');
    meta.addRows([
        ['template_kind', 'exam_questions'],
        ['template_version', QUESTION_IMPORT_TEMPLATE_VERSION],
        ['locale', 'id-ID'],
        ['scoring_mode', 'all_or_nothing'],
        ['max_questions', QUESTION_IMPORT_MAX_QUESTIONS],
        ['max_options', QUESTION_IMPORT_MAX_OPTIONS],
        ['generated_at', new Date().toISOString()],
    ]);
    meta.state = 'veryHidden';

    const reference = workbook.addWorksheet('_REFERENSI');
    reference.getRow(1).values = ['Tipe Soal', 'Benar/Salah', 'Kode Opsi', 'YA/TIDAK', 'Enum Internal'];
    Object.entries(QUESTION_IMPORT_TYPE_LABELS).forEach(([enumValue, label], index) => {
        reference.getCell(index + 2, 1).value = label;
        reference.getCell(index + 2, 5).value = enumValue;
    });
    ['BENAR', 'SALAH'].forEach((value, index) => { reference.getCell(index + 2, 2).value = value; });
    Array.from({ length: QUESTION_IMPORT_MAX_OPTIONS }, (_, index) => String.fromCharCode(65 + index))
        .forEach((value, index) => { reference.getCell(index + 2, 3).value = value; });
    ['YA', 'TIDAK'].forEach((value, index) => { reference.getCell(index + 2, 4).value = value; });
    reference.state = 'veryHidden';

    await guide.protect('lms-question-template', { selectLockedCells: true, selectUnlockedCells: true });
    await examples.protect('lms-question-template', { selectLockedCells: true, selectUnlockedCells: true });
    await meta.protect('lms-question-template', { selectLockedCells: true });
    await reference.protect('lms-question-template', { selectLockedCells: true });

    const buffer = await workbook.xlsx.writeBuffer();
    return new Uint8Array(buffer);
}
