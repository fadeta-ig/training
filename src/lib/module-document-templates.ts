import fs from 'fs';
import path from 'path';

/**
 * Professional, elegant, and print-ready HTML document templates for Module Downloads.
 * Designed with Tahoma typography, text-justify alignment, zero emojis, official Nusamitra logo, and clean corporate layout.
 */

export interface ModuleInfo {
    id: string;
    title: string;
    description: string | null;
    created_at: string;
}

export interface TrainingMaterialInfo {
    id: string;
    title: string;
    content_html: string;
    created_at: string;
}

export interface TrainingMediaInfo {
    id: string;
    training_id: string;
    media_type: string;
    media_url: string;
    original_filename: string | null;
    sequence_order: number;
}

export interface ExamInfo {
    id: string;
    title: string;
    duration_minutes: number;
    passing_grade: number;
    allow_remedial: boolean;
    max_attempts: number;
    remedial_exam_id?: string | null;
    remedial_exam_title?: string | null;
}

export interface QuestionInfo {
    id: string;
    exam_id: string;
    question_type: string;
    question_text: string;
    question_image: string | null;
    options_json: any;
    correct_option_index: number | null;
    correct_answer: string | null;
    points: number;
    sequence_order: number;
}

export interface ModuleItemFull {
    id: string;
    module_id: string;
    item_type: 'training' | 'exam';
    item_id: string;
    sequence_order: number;
    title: string;
    trainingData?: TrainingMaterialInfo;
    mediaData?: TrainingMediaInfo[];
    examData?: ExamInfo;
    questionsData?: QuestionInfo[];
}

let cachedLogoBase64: string | null = null;

/**
 * Reads and caches the Nusamitra logo as a Base64 data URI to guarantee 100% offline rendering.
 */
export function getNusamitraLogoBase64(): string {
    if (cachedLogoBase64) return cachedLogoBase64;
    try {
        const logoPath = path.join(process.cwd(), 'public', 'logo-nusamitra-tr.png');
        if (fs.existsSync(logoPath)) {
            const buffer = fs.readFileSync(logoPath);
            cachedLogoBase64 = `data:image/png;base64,${buffer.toString('base64')}`;
            return cachedLogoBase64;
        }
    } catch {
        // fallback
    }
    return '';
}

const BASE_STYLES = `
    @page {
        size: A4;
        margin: 20mm 20mm 20mm 20mm;
    }
    *, *::before, *::after {
        box-sizing: border-box;
    }
    body {
        font-family: Tahoma, 'Segoe UI', Arial, sans-serif;
        font-size: 11pt;
        line-height: 1.6;
        color: #1a1a1a;
        background-color: #ffffff;
        margin: 0;
        padding: 40px;
    }
    .document-container {
        max-width: 800px;
        margin: 0 auto;
    }
    .header-table {
        width: 100%;
        border-bottom: 2px solid #0f172a;
        padding-bottom: 16px;
        margin-bottom: 28px;
    }
    .header-logo {
        height: 52px;
        width: auto;
        max-width: 90px;
        object-fit: contain;
        display: block;
    }
    .org-title {
        font-size: 13pt;
        font-weight: bold;
        letter-spacing: 0.5px;
        color: #0f172a;
        text-transform: uppercase;
        margin: 0;
        line-height: 1.2;
    }
    .org-subtitle {
        font-size: 9pt;
        color: #475569;
        margin: 3px 0 0 0;
    }
    .doc-badge {
        display: inline-block;
        font-size: 8.5pt;
        font-weight: bold;
        text-transform: uppercase;
        letter-spacing: 0.8px;
        padding: 5px 12px;
        border-radius: 4px;
        border: 1px solid #cbd5e1;
        background-color: #f8fafc;
        color: #334155;
        white-space: nowrap;
    }
    .doc-badge-trainer {
        border-color: #0284c7;
        background-color: #f0f9ff;
        color: #0369a1;
    }
    .doc-badge-student {
        border-color: #64748b;
        background-color: #f8fafc;
        color: #334155;
    }
    h1.doc-title {
        font-size: 16pt;
        font-weight: bold;
        color: #0f172a;
        margin: 20px 0 8px 0;
        line-height: 1.3;
    }
    .meta-box {
        background-color: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 6px;
        padding: 14px 18px;
        margin: 18px 0 28px 0;
    }
    .meta-grid {
        display: table;
        width: 100%;
    }
    .meta-row {
        display: table-row;
    }
    .meta-label {
        display: table-cell;
        font-size: 9.5pt;
        font-weight: bold;
        color: #475569;
        padding: 3px 12px 3px 0;
        width: 160px;
    }
    .meta-value {
        display: table-cell;
        font-size: 9.5pt;
        color: #1e293b;
        padding: 3px 0;
    }
    .content-body {
        text-align: justify;
        text-justify: inter-word;
        font-size: 10.5pt;
        line-height: 1.7;
        color: #1e293b;
    }
    .content-body p {
        margin: 0 0 14px 0;
        text-align: justify;
    }
    .content-body ul, .content-body ol {
        margin: 0 0 14px 0;
        padding-left: 24px;
        text-align: justify;
    }
    .content-body li {
        margin-bottom: 6px;
    }
    .content-body h2 {
        font-size: 12.5pt;
        font-weight: bold;
        color: #0f172a;
        margin: 24px 0 10px 0;
        border-bottom: 1px solid #e2e8f0;
        padding-bottom: 6px;
    }
    .content-body h3 {
        font-size: 11.5pt;
        font-weight: bold;
        color: #1e293b;
        margin: 18px 0 8px 0;
    }
    .content-body img {
        max-width: 100%;
        height: auto;
        border-radius: 4px;
        border: 1px solid #e2e8f0;
        margin: 12px 0;
    }
    .content-body table {
        width: 100%;
        border-collapse: collapse;
        margin: 16px 0;
        font-size: 9.5pt;
    }
    .content-body th, .content-body td {
        border: 1px solid #cbd5e1;
        padding: 8px 10px;
        text-align: left;
    }
    .content-body th {
        background-color: #f1f5f9;
        font-weight: bold;
        color: #0f172a;
    }
    .media-attachment-box {
        margin-top: 30px;
        border: 1px solid #cbd5e1;
        border-radius: 6px;
        overflow: hidden;
    }
    .media-attachment-header {
        background-color: #f1f5f9;
        padding: 10px 14px;
        font-size: 10pt;
        font-weight: bold;
        color: #0f172a;
        border-bottom: 1px solid #cbd5e1;
    }
    .media-list {
        padding: 12px 16px;
        margin: 0;
        list-style: none;
    }
    .media-list li {
        font-size: 9pt;
        padding: 6px 0;
        border-bottom: 1px dashed #e2e8f0;
    }
    .media-list li:last-child {
        border-bottom: none;
    }
    .question-card {
        border: 1px solid #cbd5e1;
        border-radius: 6px;
        padding: 16px 18px;
        margin-bottom: 20px;
        page-break-inside: avoid;
        background-color: #ffffff;
    }
    .question-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 10px;
        border-bottom: 1px solid #f1f5f9;
        padding-bottom: 6px;
    }
    .question-number {
        font-weight: bold;
        font-size: 10pt;
        color: #0f172a;
    }
    .question-type-tag {
        font-size: 8pt;
        font-weight: bold;
        text-transform: uppercase;
        color: #475569;
        background-color: #f1f5f9;
        padding: 2px 8px;
        border-radius: 3px;
        border: 1px solid #e2e8f0;
    }
    .question-text {
        font-size: 10.5pt;
        text-align: justify;
        line-height: 1.6;
        margin-bottom: 12px;
        color: #0f172a;
    }
    .option-list {
        margin: 8px 0;
        padding: 0;
        list-style: none;
    }
    .option-item {
        display: flex;
        align-items: flex-start;
        gap: 8px;
        font-size: 10pt;
        padding: 6px 10px;
        border-radius: 4px;
        margin-bottom: 4px;
        border: 1px solid #f1f5f9;
        text-align: justify;
    }
    .option-correct {
        background-color: #f0fdf4;
        border-color: #86efac;
        color: #14532d;
        font-weight: 600;
    }
    .option-key {
        font-weight: bold;
        min-width: 22px;
    }
    .answer-key-box {
        margin-top: 10px;
        padding: 8px 12px;
        background-color: #f0fdf4;
        border: 1px solid #bbf7d0;
        border-radius: 4px;
        font-size: 9.5pt;
        color: #166534;
    }
    .footer-note {
        margin-top: 40px;
        padding-top: 14px;
        border-top: 1px solid #e2e8f0;
        font-size: 8.5pt;
        color: #64748b;
        text-align: center;
    }
    @media print {
        body {
            padding: 0;
            font-size: 10.5pt;
        }
        .question-card {
            page-break-inside: avoid;
        }
    }
`;

function escapeHtml(str: any): string {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function parseOptionsSafely(optionsJson: any): any {
    if (!optionsJson) return null;
    if (typeof optionsJson === 'object') return optionsJson;
    if (typeof optionsJson === 'string') {
        try {
            return JSON.parse(optionsJson);
        } catch {
            return null;
        }
    }
    return null;
}

function renderHeaderTable(badgeText: string, badgeClass: string = 'doc-badge'): string {
    const logoBase64 = getNusamitraLogoBase64();
    const logoTd = logoBase64
        ? `<td style="width: 60px; vertical-align: middle; padding-right: 14px;">
               <img src="${logoBase64}" alt="Logo Nusamitra" class="header-logo" />
           </td>`
        : '';

    return `
        <table class="header-table">
            <tr>
                ${logoTd}
                <td style="vertical-align: middle;">
                    <div class="org-title">LMS NUSAMITRA CONSULTING</div>
                    <div class="org-subtitle">Sistem Manajemen Pembelajaran &amp; Pelatihan Terpadu</div>
                </td>
                <td style="text-align: right; vertical-align: middle;">
                    <span class="${badgeClass}">${badgeText}</span>
                </td>
            </tr>
        </table>
    `;
}

/**
 * Generates the Syllabus and Learning Path Overview HTML Document.
 */
export function generateModuleSyllabusHtml(module: ModuleInfo, items: ModuleItemFull[]): string {
    const totalTrainings = items.filter((i) => i.item_type === 'training').length;
    const totalExams = items.filter((i) => i.item_type === 'exam').length;
    const dateFormatted = new Date(module.created_at || Date.now()).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });

    const itemsRows = items
        .map((item, index) => {
            const typeLabel = item.item_type === 'training' ? 'Materi Pembelajaran' : 'Ujian Evaluasi';
            const details =
                item.item_type === 'training'
                    ? `${item.mediaData?.length || 0} lampiran media`
                    : `${item.examData?.duration_minutes || 60} Menit • Standar Kelulusan ${item.examData?.passing_grade || 70}%`;

            return `
            <tr>
                <td style="text-align: center; font-weight: bold; width: 40px;">${index + 1}</td>
                <td style="font-weight: bold; color: #0f172a;">${escapeHtml(item.title)}</td>
                <td style="width: 160px; color: #334155;">${typeLabel}</td>
                <td style="width: 220px; font-size: 9pt; color: #64748b;">${details}</td>
            </tr>
        `;
        })
        .join('');

    return `<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <title>Silabus & Panduan: ${escapeHtml(module.title)}</title>
    <style>${BASE_STYLES}</style>
</head>
<body>
    <div class="document-container">
        ${renderHeaderTable('Silabus Modul', 'doc-badge')}

        <h1 class="doc-title">${escapeHtml(module.title)}</h1>

        <div class="meta-box">
            <div class="meta-grid">
                <div class="meta-row">
                    <div class="meta-label">Nama Modul</div>
                    <div class="meta-value">${escapeHtml(module.title)}</div>
                </div>
                <div class="meta-row">
                    <div class="meta-label">Deskripsi Modul</div>
                    <div class="meta-value" style="text-align: justify;">${escapeHtml(module.description || 'Tidak ada deskripsi.')}</div>
                </div>
                <div class="meta-row">
                    <div class="meta-label">Total Sesi Pembelajaran</div>
                    <div class="meta-value">${items.length} Sesi (${totalTrainings} Materi, ${totalExams} Evaluasi/Ujian)</div>
                </div>
                <div class="meta-row">
                    <div class="meta-label">Tanggal Dibuat</div>
                    <div class="meta-value">${dateFormatted}</div>
                </div>
            </div>
        </div>

        <div class="content-body">
            <h2>Struktur Alur Pembelajaran</h2>
            <p>
                Berikut adalah susunan kurikulum dan urutan tahapan pembelajaran yang wajib dilalui peserta dalam modul ini:
            </p>

            <table>
                <thead>
                    <tr>
                        <th style="text-align: center;">No.</th>
                        <th>Judul Sesi</th>
                        <th>Kategori</th>
                        <th>Keterangan / Parameter</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsRows || '<tr><td colspan="4" style="text-align: center; color: #94a3b8;">Belum ada sesi yang terdaftar pada modul ini.</td></tr>'}
                </tbody>
            </table>
        </div>

        <div class="footer-note">
            Dokumen Resmi LMS Nusamitra Consulting • Dicetak pada ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
        </div>
    </div>
</body>
</html>`;
}

/**
 * Generates an Individual Training Material HTML Document.
 */
export function generateTrainingMaterialHtml(
    module: ModuleInfo,
    training: TrainingMaterialInfo,
    mediaList: TrainingMediaInfo[],
    sequenceNumber: number
): string {
    const mediaItems =
        mediaList.length > 0
            ? mediaList
                  .map((m) => {
                      const typeUpper = (m.media_type || 'FILE').toUpperCase();
                      const filename = m.original_filename || m.media_url;
                      return `<li><strong>[${typeUpper}]</strong> ${escapeHtml(filename)}</li>`;
                  })
                  .join('')
            : '<li>Tidak ada lampiran file pada materi ini.</li>';

    return `<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <title>Materi ${sequenceNumber}: ${escapeHtml(training.title)}</title>
    <style>${BASE_STYLES}</style>
</head>
<body>
    <div class="document-container">
        ${renderHeaderTable(`Sesi Materi ${sequenceNumber}`, 'doc-badge')}

        <h1 class="doc-title">${escapeHtml(training.title)}</h1>

        <div class="meta-box">
            <div class="meta-grid">
                <div class="meta-row">
                    <div class="meta-label">Modul Induk</div>
                    <div class="meta-value">${escapeHtml(module.title)}</div>
                </div>
                <div class="meta-row">
                    <div class="meta-label">Judul Materi</div>
                    <div class="meta-value">${escapeHtml(training.title)}</div>
                </div>
                <div class="meta-row">
                    <div class="meta-label">Urutan Sesi</div>
                    <div class="meta-value">Sesi Ke-${sequenceNumber}</div>
                </div>
            </div>
        </div>

        <div class="content-body">
            <h2>Uraian Materi Pembelajaran</h2>
            ${training.content_html || '<p style="color: #64748b; font-style: italic;">Tidak ada naskah materi tertulis.</p>'}
        </div>

        ${
            mediaList.length > 0
                ? `
        <div class="media-attachment-box">
            <div class="media-attachment-header">Daftar Lampiran & Media Pembelajaran (${mediaList.length})</div>
            <ul class="media-list">
                ${mediaItems}
            </ul>
        </div>
        `
                : ''
        }

        <div class="footer-note">
            Dokumen Resmi LMS Nusamitra Consulting • Dicetak pada ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
        </div>
    </div>
</body>
</html>`;
}

/**
 * Generates an Exam and Question Sheet HTML Document.
 * Supports both Trainer Edition (with Answer Key) and Student Practice Edition (without Answer Key).
 */
export function generateExamSheetHtml(
    module: ModuleInfo,
    exam: ExamInfo,
    questions: QuestionInfo[],
    sequenceNumber: number,
    includeAnswers: boolean = true
): string {
    const totalPoints = questions.reduce((acc, q) => acc + (Number(q.points) || 1), 0);
    const badgeText = includeAnswers ? 'EDISI TRAINER (DENGAN KUNCI JAWABAN)' : 'LEMBAR SOAL EVALUASI';
    const badgeClass = includeAnswers ? 'doc-badge doc-badge-trainer' : 'doc-badge doc-badge-student';

    const renderedQuestions = questions
        .map((q, qIndex) => {
            try {
                const num = qIndex + 1;
                const qType = q.question_type || 'multiple_choice';
                const parsed = parseOptionsSafely(q.options_json);

                let questionTypeLabel = 'Pilihan Ganda';
                if (qType === 'multiple_select') questionTypeLabel = 'Pilihan Ganda Kompleks';
                else if (qType === 'true_false') questionTypeLabel = 'Benar / Salah';
                else if (qType === 'short_answer') questionTypeLabel = 'Isian Singkat';
                else if (qType === 'essay') questionTypeLabel = 'Esai / Uraian';
                else if (qType === 'matching') questionTypeLabel = 'Menjodohkan';

                let optionsHtml = '';
                let answerKeyHtml = '';

                if (qType === 'multiple_choice') {
                    const optionsList: any[] = Array.isArray(parsed)
                        ? parsed
                        : Array.isArray(parsed?.options)
                        ? parsed.options
                        : [];

                    if (optionsList.length > 0) {
                        optionsHtml = `
                        <ul class="option-list">
                            ${optionsList
                                .map((opt: any, optIdx: number) => {
                                    const optText = typeof opt === 'string' ? opt : (opt?.text ?? '');
                                    const isCorrect = includeAnswers && q.correct_option_index === optIdx;
                                    const label = String.fromCharCode(65 + optIdx);
                                    return `
                                    <li class="option-item ${isCorrect ? 'option-correct' : ''}">
                                        <span class="option-key">(${label})</span>
                                        <span style="flex: 1;">${escapeHtml(optText)} ${isCorrect ? '<strong style="color: #166534;">[KUNCI JAWABAN BENAR]</strong>' : ''}</span>
                                    </li>
                                `;
                                })
                                .join('')}
                        </ul>
                    `;
                    }
                } else if (qType === 'multiple_select') {
                    const optionsList: any[] = Array.isArray(parsed)
                        ? parsed
                        : Array.isArray(parsed?.options)
                        ? parsed.options
                        : [];

                    const rawIndices = parsed?.correct_indices ?? parsed?.correct_option_indices ?? [];
                    const correctIndices: number[] = Array.isArray(rawIndices) ? rawIndices : [];

                    if (optionsList.length > 0) {
                        optionsHtml = `
                        <ul class="option-list">
                            ${optionsList
                                .map((opt: any, optIdx: number) => {
                                    const optText = typeof opt === 'string' ? opt : (opt?.text ?? '');
                                    const isCorrect = includeAnswers && correctIndices.includes(optIdx);
                                    const label = String.fromCharCode(65 + optIdx);
                                    return `
                                    <li class="option-item ${isCorrect ? 'option-correct' : ''}">
                                        <span class="option-key">[${label}]</span>
                                        <span style="flex: 1;">${escapeHtml(optText)} ${isCorrect ? '<strong style="color: #166534;">[BENAR]</strong>' : ''}</span>
                                    </li>
                                `;
                                })
                                .join('')}
                        </ul>
                    `;
                    }
                } else if (qType === 'true_false') {
                    const isTrue = q.correct_option_index === 0;
                    optionsHtml = `
                    <div style="margin: 8px 0; font-size: 10pt;">
                        <span style="display: inline-block; padding: 4px 12px; border: 1px solid #cbd5e1; border-radius: 4px; margin-right: 8px; ${includeAnswers && isTrue ? 'background-color: #f0fdf4; border-color: #86efac; font-weight: bold; color: #166534;' : ''}">
                            ( ) Benar ${includeAnswers && isTrue ? '[KUNCI]' : ''}
                        </span>
                        <span style="display: inline-block; padding: 4px 12px; border: 1px solid #cbd5e1; border-radius: 4px; ${includeAnswers && !isTrue ? 'background-color: #f0fdf4; border-color: #86efac; font-weight: bold; color: #166534;' : ''}">
                            ( ) Salah ${includeAnswers && !isTrue ? '[KUNCI]' : ''}
                        </span>
                    </div>
                `;
                } else if (qType === 'short_answer') {
                    optionsHtml = `
                    <div style="margin: 10px 0; padding: 8px 12px; border-bottom: 1px dashed #94a3b8; font-size: 9.5pt; color: #64748b;">
                        Jawaban Peserta: ............................................................................................................
                    </div>
                `;
                    if (includeAnswers && q.correct_answer) {
                        answerKeyHtml = `
                        <div class="answer-key-box">
                            <strong>Kunci Jawaban Singkat:</strong> ${escapeHtml(q.correct_answer)}
                        </div>
                    `;
                    }
                } else if (qType === 'essay') {
                    optionsHtml = `
                    <div style="margin: 10px 0; min-height: 80px; border: 1px dashed #cbd5e1; border-radius: 4px; padding: 8px; font-size: 9pt; color: #94a3b8;">
                        (Lembar Uraian / Catatan Jawaban Peserta)
                    </div>
                `;
                    if (includeAnswers) {
                        answerKeyHtml = `
                        <div class="answer-key-box">
                            <strong>Petunjuk Penilaian Trainer:</strong> Evaluasi manual berdasarkan kelengkapan argumen dan pemahaman konsep.
                        </div>
                    `;
                    }
                } else if (qType === 'matching') {
                    const pairsList: any[] = Array.isArray(parsed)
                        ? parsed
                        : Array.isArray(parsed?.pairs)
                        ? parsed.pairs
                        : Array.isArray(parsed?.matching_pairs)
                        ? parsed.matching_pairs
                        : [];

                    if (pairsList.length > 0) {
                        optionsHtml = `
                        <div style="margin: 10px 0;">
                            <table style="width: 100%; font-size: 9.5pt; border-collapse: collapse;">
                                <thead>
                                    <tr style="background-color: #f8fafc;">
                                        <th style="border: 1px solid #cbd5e1; padding: 6px 10px;">Pernyataan / Soal</th>
                                        <th style="border: 1px solid #cbd5e1; padding: 6px 10px;">Pasangan Jawaban</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${pairsList
                                        .map(
                                            (pair: any) => `
                                        <tr>
                                            <td style="border: 1px solid #cbd5e1; padding: 6px 10px;">${escapeHtml(pair?.left ?? '')}</td>
                                            <td style="border: 1px solid #cbd5e1; padding: 6px 10px;">${includeAnswers ? `<strong style="color: #166534;">${escapeHtml(pair?.right ?? '')}</strong>` : '........................................'}</td>
                                        </tr>
                                    `
                                        )
                                        .join('')}
                                </tbody>
                            </table>
                        </div>
                    `;
                    }
                }

                const questionImageHtml = q.question_image
                    ? `<div style="margin: 10px 0;"><img src="${escapeHtml(q.question_image)}" alt="Gambar Soal" style="max-width: 100%; max-height: 280px; object-fit: contain; border-radius: 4px; border: 1px solid #e2e8f0;" /></div>`
                    : '';

                return `
                <div class="question-card">
                    <div class="question-header">
                        <span class="question-number">Soal Nomor ${num}</span>
                        <div>
                            <span class="question-type-tag">${questionTypeLabel}</span>
                            <span style="font-size: 8.5pt; color: #64748b; margin-left: 6px;">${Number(q.points) || 1} Poin</span>
                        </div>
                    </div>
                    <div class="question-text">
                        ${escapeHtml(q.question_text)}
                    </div>
                    ${questionImageHtml}
                    ${optionsHtml}
                    ${answerKeyHtml}
                </div>
            `;
            } catch (renderErr) {
                return `
                <div class="question-card">
                    <div class="question-header">
                        <span class="question-number">Soal Nomor ${qIndex + 1}</span>
                    </div>
                    <div class="question-text">
                        ${escapeHtml(q.question_text)}
                    </div>
                </div>
            `;
            }
        })
        .join('');

    return `<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <title>Bank Soal: ${escapeHtml(exam.title)}</title>
    <style>${BASE_STYLES}</style>
</head>
<body>
    <div class="document-container">
        ${renderHeaderTable(badgeText, badgeClass)}

        <h1 class="doc-title">${escapeHtml(exam.title)}</h1>

        <div class="meta-box">
            <div class="meta-grid">
                <div class="meta-row">
                    <div class="meta-label">Modul Induk</div>
                    <div class="meta-value">${escapeHtml(module.title)}</div>
                </div>
                <div class="meta-row">
                    <div class="meta-label">Durasi Waktu Pengerjaan</div>
                    <div class="meta-value">${exam.duration_minutes || 60} Menit</div>
                </div>
                <div class="meta-row">
                    <div class="meta-label">Standar Kelulusan (Passing Grade)</div>
                    <div class="meta-value">${exam.passing_grade || 0}%</div>
                </div>
                <div class="meta-row">
                    <div class="meta-label">Jumlah Butir Soal</div>
                    <div class="meta-value">${questions.length} Butir Soal (Total Bobot: ${totalPoints} Poin)</div>
                </div>
                <div class="meta-row">
                    <div class="meta-label">Tipe Dokumen</div>
                    <div class="meta-value">${includeAnswers ? 'Pegangan Pelatih (Dilengkapi Kunci Jawaban)' : 'Lembar Evaluasi Soal (Bersih / Tanpa Kunci)'}</div>
                </div>
            </div>
        </div>

        <div class="content-body">
            <h2>Daftar Pertanyaan Evaluasi</h2>
            ${renderedQuestions || '<p style="color: #64748b; font-style: italic;">Belum ada butir soal yang dibuat untuk ujian ini.</p>'}
        </div>

        <div class="footer-note">
            Dokumen Resmi LMS Nusamitra Consulting • Dicetak pada ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
        </div>
    </div>
</body>
</html>`;
}
