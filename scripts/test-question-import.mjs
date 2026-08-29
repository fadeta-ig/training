import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import {
    generateQuestionImportTemplateXlsx,
    inspectQuestionImportArchive,
    parseAndValidateQuestionImport,
    QUESTION_IMPORT_MAX_FILE_BYTES,
} from '../src/lib/question-import.ts';

const EXAM_ID = '11111111-1111-4111-8111-111111111111';
const OUTPUT_PATH = path.resolve('outputs/question-import-template/Template_Import_Soal_LMS.xlsx');

async function workbookBuffer(workbook) {
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
}

function populateSixQuestionTypes(workbook) {
    const questions = workbook.getWorksheet('SOAL');
    const options = workbook.getWorksheet('OPSI');
    const matching = workbook.getWorksheet('PASANGAN');
    assert(questions && options && matching, 'Input sheets must exist');

    const questionRows = [
        ['Q001', 1, 'Pilihan Ganda', 'Ibu kota Jepang adalah ...', 2, '', '', ''],
        ['Q002', 2, 'Multi-Jawaban', 'Pilih dua warna primer berikut.', 3, '', '', ''],
        ['Q003', 3, 'Benar/Salah', 'Air membeku pada 0°C pada tekanan normal.', 1, 'BENAR', '', ''],
        ['Q004', 4, 'Isian Singkat', 'Singkatan dari Teknologi Informasi adalah ...', 2, '', 'TI', ''],
        ['Q005', 5, 'Esai', 'Jelaskan dua manfaat transformasi digital.', 5, '', '', ''],
        ['Q006', 6, 'Menjodohkan', 'Pasangkan negara dengan ibu kotanya.', 4, '', '', ''],
    ];
    questionRows.forEach((values, index) => { questions.getRow(5 + index).values = values; });

    const optionRows = [
        ['Q001', 'A', 'Tokyo', 'YA', ''],
        ['Q001', 'B', 'Kyoto', 'TIDAK', ''],
        ['Q001', 'C', 'Osaka', 'TIDAK', ''],
        ['Q002', 'A', 'Merah', 'YA', ''],
        ['Q002', 'B', 'Biru', 'YA', ''],
        ['Q002', 'C', 'Hijau', 'TIDAK', ''],
    ];
    optionRows.forEach((values, index) => { options.getRow(5 + index).values = values; });

    const matchingRows = [
        ['Q006', 1, 'Indonesia', 'Jakarta'],
        ['Q006', 2, 'Jepang', 'Tokyo'],
        ['Q006', 3, 'Thailand', 'Bangkok'],
    ];
    matchingRows.forEach((values, index) => { matching.getRow(5 + index).values = values; });
}

const template = Buffer.from(await generateQuestionImportTemplateXlsx());
assert(template.length < QUESTION_IMPORT_MAX_FILE_BYTES, 'Official template must stay below the upload limit');
inspectQuestionImportArchive(template);

const emptyResult = await parseAndValidateQuestionImport(template, EXAM_ID);
assert.equal(emptyResult.valid, false);
assert(emptyResult.issues.some((issue) => issue.code === 'SOAL_KOSONG'));

const validWorkbook = new ExcelJS.Workbook();
await validWorkbook.xlsx.load(template);
populateSixQuestionTypes(validWorkbook);
const validBuffer = await workbookBuffer(validWorkbook);
inspectQuestionImportArchive(validBuffer);

const validResult = await parseAndValidateQuestionImport(validBuffer, EXAM_ID);
assert.equal(validResult.valid, true, JSON.stringify(validResult.issues, null, 2));
assert.equal(validResult.questions.length, 6);
assert.equal(validResult.summary.totalQuestions, 6);
assert.equal(validResult.summary.totalPoints, 17);
assert.deepEqual(validResult.summary.byType, {
    multiple_choice: 1,
    multiple_select: 1,
    true_false: 1,
    short_answer: 1,
    essay: 1,
    matching: 1,
});
assert.deepEqual(validResult.questions[1].input.correct_option_indices, [0, 1]);
assert.deepEqual(validResult.questions[5].input.matching_pairs, [
    { left: 'Indonesia', right: 'Jakarta' },
    { left: 'Jepang', right: 'Tokyo' },
    { left: 'Thailand', right: 'Bangkok' },
]);

const invalidWorkbook = new ExcelJS.Workbook();
await invalidWorkbook.xlsx.load(validBuffer);
invalidWorkbook.getWorksheet('SOAL').getCell('H5').value = { formula: 'CONCAT("https://example.com/",A5)', result: 'https://example.com/Q001' };
invalidWorkbook.getWorksheet('OPSI').getCell('D6').value = 'YA';
const invalidBuffer = await workbookBuffer(invalidWorkbook);
const invalidResult = await parseAndValidateQuestionImport(invalidBuffer, EXAM_ID);
assert.equal(invalidResult.valid, false);
assert(invalidResult.issues.some((issue) => issue.code === 'FORMULA_TIDAK_DIIZINKAN' && issue.cell === 'H5'));
assert(invalidResult.issues.some((issue) => issue.code === 'KUNCI_PILIHAN_GANDA_TIDAK_VALID'));

const embeddedMediaArchive = await JSZip.loadAsync(validBuffer);
embeddedMediaArchive.file('xl/media/image1.png', Buffer.from([0x89, 0x50, 0x4e, 0x47]));
const embeddedMediaBuffer = await embeddedMediaArchive.generateAsync({ type: 'nodebuffer' });
assert.throws(
    () => inspectQuestionImportArchive(embeddedMediaBuffer),
    /Embedded image atau drawing tidak didukung/,
);

await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
await writeFile(OUTPUT_PATH, template);

console.log(JSON.stringify({
    output: OUTPUT_PATH,
    templateBytes: template.length,
    validWorkbookBytes: validBuffer.length,
    validQuestions: validResult.summary.totalQuestions,
    invalidChecks: invalidResult.issues.map((issue) => issue.code),
    embeddedMediaRejected: true,
}, null, 2));
