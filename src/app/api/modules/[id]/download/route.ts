import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import JSZip from 'jszip';
import { executeQuery } from '@/lib/db';
import { withAuth, AuthenticatedUser } from '@/lib/api-auth';
import { logActivity } from '@/lib/audit';
import logger from '@/lib/logger';
import {
    generateModuleSyllabusHtml,
    generateTrainingMaterialHtml,
    generateExamSheetHtml,
    type ModuleInfo,
    type TrainingMaterialInfo,
    type TrainingMediaInfo,
    type ExamInfo,
    type QuestionInfo,
    type ModuleItemFull,
} from '@/lib/module-document-templates';

function sanitizeFilename(name: string): string {
    return name.replace(/[/\\?%*:|"<>]/g, '_').trim().slice(0, 80) || 'modul';
}

async function handleGet(
    request: NextRequest,
    user: AuthenticatedUser,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const resolvedParams = await context.params;
        const moduleId = resolvedParams.id;

        const { searchParams } = new URL(request.url);
        const format = searchParams.get('format') || 'zip';
        const includeAnswers = searchParams.get('includeAnswers') !== 'false';
        const targetItemId = searchParams.get('itemId');
        const targetItemType = searchParams.get('itemType');

        // Fetch Module
        const modules = await executeQuery<ModuleInfo[]>(
            `SELECT id, title, description, created_at FROM modules WHERE id = ? LIMIT 1`,
            [moduleId]
        );

        const moduleData = Array.isArray(modules) ? modules[0] : null;
        if (!moduleData) {
            return NextResponse.json({ success: false, error: 'Modul tidak ditemukan' }, { status: 404 });
        }

        // Fetch Module Items ordered
        const rawItems = await executeQuery<
            { id: string; module_id: string; item_type: 'training' | 'exam'; item_id: string; sequence_order: number }[]
        >(
            `SELECT id, module_id, item_type, item_id, sequence_order 
             FROM module_items 
             WHERE module_id = ? 
             ORDER BY sequence_order ASC`,
            [moduleId]
        );

        const moduleItems = Array.isArray(rawItems) ? rawItems : [];

        // Build full item metadata
        const fullItems: ModuleItemFull[] = [];

        for (const item of moduleItems) {
            if (item.item_type === 'training') {
                const trainings = await executeQuery<TrainingMaterialInfo[]>(
                    `SELECT id, title, content_html, created_at FROM trainings WHERE id = ? LIMIT 1`,
                    [item.item_id]
                );
                const t = Array.isArray(trainings) && trainings[0] ? trainings[0] : null;
                const mediaList = await executeQuery<TrainingMediaInfo[]>(
                    `SELECT id, training_id, media_type, media_url, original_filename, sequence_order 
                     FROM training_media 
                     WHERE training_id = ? 
                     ORDER BY sequence_order ASC`,
                    [item.item_id]
                );

                fullItems.push({
                    ...item,
                    title: t ? t.title : 'Materi Tanpa Judul',
                    trainingData: t || undefined,
                    mediaData: Array.isArray(mediaList) ? mediaList : [],
                });
            } else if (item.item_type === 'exam') {
                const exams = await executeQuery<ExamInfo[]>(
                    `SELECT id, title, duration_minutes, passing_grade, allow_remedial, max_attempts FROM exams WHERE id = ? LIMIT 1`,
                    [item.item_id]
                );
                const e = Array.isArray(exams) && exams[0] ? exams[0] : null;
                const questions = await executeQuery<QuestionInfo[]>(
                    `SELECT id, exam_id, question_type, question_text, question_image, options_json, correct_option_index, correct_answer, points, sequence_order 
                     FROM questions 
                     WHERE exam_id = ? 
                     ORDER BY sequence_order ASC, id ASC`,
                    [item.item_id]
                );

                fullItems.push({
                    ...item,
                    title: e ? e.title : 'Ujian Evaluasi',
                    examData: e || undefined,
                    questionsData: Array.isArray(questions) ? questions : [],
                });
            }
        }

        const uploadsBaseDir = path.join(process.cwd(), 'public', 'uploads');

        // Handle Individual Item Download
        if (targetItemId && targetItemType) {
            const targetItem = fullItems.find((i) => i.item_id === targetItemId && i.item_type === targetItemType);
            if (!targetItem) {
                return NextResponse.json({ success: false, error: 'Item modul tidak ditemukan dalam modul ini' }, { status: 404 });
            }

            if (targetItem.item_type === 'exam') {
                if (!targetItem.examData) {
                    return NextResponse.json({ success: false, error: 'Data ujian/evaluasi tidak ditemukan atau telah dihapus' }, { status: 404 });
                }

                const examHtml = generateExamSheetHtml(
                    moduleData,
                    targetItem.examData,
                    targetItem.questionsData || [],
                    targetItem.sequence_order,
                    includeAnswers
                );

                const safeExamTitle = sanitizeFilename(targetItem.examData.title);
                const filename = `Soal_${safeExamTitle}_${includeAnswers ? 'DenganKunci' : 'LembarSoal'}.html`;

                await logActivity(user.id, 'DOWNLOAD_MODULE', 'modules', moduleId, {
                    type: 'individual_exam',
                    examId: targetItemId,
                    includeAnswers,
                });

                return new NextResponse(examHtml, {
                    headers: {
                        'Content-Type': 'text/html; charset=utf-8',
                        'Content-Disposition': `attachment; filename="${filename}"`,
                    },
                });
            }

            if (targetItem.item_type === 'training') {
                if (!targetItem.trainingData) {
                    return NextResponse.json({ success: false, error: 'Data materi pembelajaran tidak ditemukan atau telah dihapus' }, { status: 404 });
                }

                const trainingHtml = generateTrainingMaterialHtml(
                    moduleData,
                    targetItem.trainingData,
                    targetItem.mediaData || [],
                    targetItem.sequence_order
                );

                const safeTrainingTitle = sanitizeFilename(targetItem.trainingData.title);

                // If training has media attachments, bundle into a neat single zip
                if (targetItem.mediaData && targetItem.mediaData.length > 0) {
                    const singleZip = new JSZip();
                    singleZip.file(`Materi_${safeTrainingTitle}.html`, trainingHtml);

                    for (const media of targetItem.mediaData) {
                        if (media.media_url.startsWith('/uploads/')) {
                            const filenameOnDisk = media.media_url.replace('/uploads/', '');
                            const resolvedPath = path.resolve(uploadsBaseDir, filenameOnDisk);

                            if (resolvedPath.startsWith(uploadsBaseDir)) {
                                try {
                                    const fileBuffer = await fs.readFile(resolvedPath);
                                    const entryName = media.original_filename || filenameOnDisk;
                                    singleZip.file(`Lampiran/${entryName}`, fileBuffer);
                                } catch (e) {
                                    logger.warn('MODULE_DOWNLOAD', `Lampiran tidak ditemukan di disk: ${resolvedPath}`);
                                }
                            }
                        }
                    }

                    const zipBuffer = await singleZip.generateAsync({ type: 'nodebuffer' });

                    await logActivity(user.id, 'DOWNLOAD_MODULE', 'modules', moduleId, {
                        type: 'individual_training_bundle',
                        trainingId: targetItemId,
                    });

                    return new NextResponse(new Uint8Array(zipBuffer), {
                        headers: {
                            'Content-Type': 'application/zip',
                            'Content-Disposition': `attachment; filename="Materi_${safeTrainingTitle}.zip"`,
                        },
                    });
                }

                // If no media, return clean single HTML document
                await logActivity(user.id, 'DOWNLOAD_MODULE', 'modules', moduleId, {
                    type: 'individual_training_html',
                    trainingId: targetItemId,
                });

                return new NextResponse(trainingHtml, {
                    headers: {
                        'Content-Type': 'text/html; charset=utf-8',
                        'Content-Disposition': `attachment; filename="Materi_${safeTrainingTitle}.html"`,
                    },
                });
            }
        }

        // Handle Full Module ZIP Bundle (Default)
        const zip = new JSZip();

        // 1. Add Syllabus & Overview
        const syllabusHtml = generateModuleSyllabusHtml(moduleData, fullItems);
        zip.file('00_Silabus_Dan_Panduan_Modul.html', syllabusHtml);

        // 2. Add Training Materials & Attachments
        const trainingsFolder = zip.folder('01_Materi_Pembelajaran');
        const examsFolder = zip.folder('02_Bank_Soal_Dan_Evaluasi');

        let trainingSeq = 1;
        let examSeq = 1;

        for (const item of fullItems) {
            if (item.item_type === 'training' && item.trainingData && trainingsFolder) {
                const safeTitle = sanitizeFilename(item.trainingData.title);
                const html = generateTrainingMaterialHtml(
                    moduleData,
                    item.trainingData,
                    item.mediaData || [],
                    item.sequence_order
                );

                const itemPrefix = String(trainingSeq).padStart(2, '0');
                trainingsFolder.file(`${itemPrefix}_${safeTitle}.html`, html);

                // Add physical file attachments if available
                if (item.mediaData && item.mediaData.length > 0) {
                    const mediaSubFolder = trainingsFolder.folder(`${itemPrefix}_Lampiran_${safeTitle}`);
                    for (const media of item.mediaData) {
                        if (media.media_url.startsWith('/uploads/')) {
                            const filenameOnDisk = media.media_url.replace('/uploads/', '');
                            const resolvedPath = path.resolve(uploadsBaseDir, filenameOnDisk);

                            // Path traversal defense
                            if (resolvedPath.startsWith(uploadsBaseDir)) {
                                try {
                                    const fileBuffer = await fs.readFile(resolvedPath);
                                    const entryName = media.original_filename || filenameOnDisk;
                                    if (mediaSubFolder) {
                                        mediaSubFolder.file(entryName, fileBuffer);
                                    }
                                } catch (fileErr) {
                                    logger.warn('MODULE_DOWNLOAD', `File lampiran tidak ditemukan di disk: ${resolvedPath}`);
                                }
                            }
                        }
                    }
                }
                trainingSeq++;
            } else if (item.item_type === 'exam' && item.examData && examsFolder) {
                const safeTitle = sanitizeFilename(item.examData.title);
                const html = generateExamSheetHtml(
                    moduleData,
                    item.examData,
                    item.questionsData || [],
                    item.sequence_order,
                    includeAnswers
                );

                const itemPrefix = String(examSeq).padStart(2, '0');
                const suffix = includeAnswers ? 'DenganKunci' : 'LembarSoal';
                examsFolder.file(`${itemPrefix}_Soal_${safeTitle}_${suffix}.html`, html);
                examSeq++;
            }
        }

        const zipBuffer = await zip.generateAsync({
            type: 'nodebuffer',
            compression: 'DEFLATE',
            compressionOptions: { level: 6 },
        });

        const safeModuleTitle = sanitizeFilename(moduleData.title);
        const zipFilename = `${safeModuleTitle}_Paket_Pelatihan.zip`;

        await logActivity(user.id, 'DOWNLOAD_MODULE', 'modules', moduleId, {
            format: 'zip',
            includeAnswers,
            itemsCount: fullItems.length,
        });

        return new NextResponse(new Uint8Array(zipBuffer), {
            headers: {
                'Content-Type': 'application/zip',
                'Content-Disposition': `attachment; filename="${zipFilename}"`,
            },
        });
    } catch (error) {
        logger.error('MODULE_DOWNLOAD', 'Gagal memproses download modul', error);
        const message = error instanceof Error ? error.message : 'Internal Server Error';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

export const GET = withAuth(handleGet, { allowedRoles: ['admin', 'trainer'] });
