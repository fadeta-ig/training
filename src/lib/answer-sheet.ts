import fs from 'fs';
import path from 'path';
import QRCode from 'qrcode';
import JSZip from 'jszip';
import { executeQuery } from '@/lib/db';
import {
    parseOptionsJson,
    normalizeOptions,
    parseIndexSet,
    parseMatchingAnswer,
    type ExamQuestionType,
    type MatchingPair,
} from '@/lib/exam-answer-utils';
import logger from '@/lib/logger';
import { createAnswerSheetDocumentId } from '@/lib/answer-sheet-verification';

export interface AnswerItemDetail {
    question_id: string;
    sequence_order: number;
    question_type: ExamQuestionType;
    question_text: string;
    question_image: string | null;
    points: number;
    awarded_points: number;
    is_correct: boolean;
    grading_status: 'auto' | 'pending' | 'graded';
    selected_option_raw: string;
    participant_answer_lines: string[];
    correct_answer_lines: string[];
    grader_name: string | null;
    graded_at: string | null;
}

export interface AnswerSheetData {
    session: {
        id: string;
        title: string;
        module_title: string;
        start_time: string;
        end_time: string;
    };
    participant: {
        id: string;
        username: string;
        full_name: string;
        nip: string | null;
        id_card_number: string | null;
        institution: string | null;
        batch: string | number;
        graduation_status: 'pending' | 'passed' | 'failed';
        skl_number: string | null;
    };
    exam: {
        id: string;
        title: string;
        passing_grade: number;
        duration_minutes: number;
        attempt_number: number;
        submitted_at: string | null;
    };
    stats: {
        total_questions: number;
        correct_count: number;
        incorrect_count: number;
        unanswered_count: number;
        pending_count: number;
        total_max_points: number;
        earned_points: number;
        original_score: number;
        score_adjustment: number;
        final_score: number;
        adjustment_reason: string | null;
        is_passed: boolean;
    };
    questions: AnswerItemDetail[];
    document_id: string;
    generated_at: string;
}

/**
 * Mengambil dan merangkum seluruh data lembar jawaban peserta untuk ujian tertentu.
 */
export async function getParticipantAnswerSheetData(
    sessionId: string,
    participantId: string,
    examId?: string,
    requestedAttempt?: number
): Promise<AnswerSheetData | null> {
    try {
        // 1. Ambil detail sesi dan modul
        const sessionRows = await executeQuery<any[]>(
            `SELECT s.id, s.title, s.start_time, s.end_time, s.module_id, s.session_type, s.parent_session_id, m.title AS module_title
             FROM sessions s
             LEFT JOIN modules m ON s.module_id = m.id
             WHERE s.id = ?
             LIMIT 1`,
            [sessionId]
        );

        if (!sessionRows || sessionRows.length === 0) return null;
        const session = sessionRows[0];

        // 2. Ambil profil peserta & status pendaftaran sesi
        const participantRows = await executeQuery<any[]>(
            `SELECT u.id, u.username, u.full_name,
                    p.nip, p.id_card_number, p.institution, p.batch,
                    sp.graduation_status, sp.skl_number
             FROM session_participants sp
             JOIN users u ON sp.user_id = u.id
             LEFT JOIN participant_profiles p ON u.id = p.user_id
             WHERE sp.session_id = ? AND sp.user_id = ?
             LIMIT 1`,
            [sessionId, participantId]
        );

        if (!participantRows || participantRows.length === 0) return null;
        const participant = participantRows[0];

        // 3. Cari rekam jawaban aktual peserta di sesi ini
        const answeredSubmissions = await executeQuery<Array<{
            exam_id: string;
            attempt_number: number;
            answer_count: number;
            last_answered: string;
        }>>(
            `SELECT ea.exam_id, ea.attempt_number, COUNT(*) AS answer_count, MAX(ea.answered_at) AS last_answered
             FROM exam_answers ea
             WHERE ea.session_id = ? AND ea.user_id = ?
             GROUP BY ea.exam_id, ea.attempt_number
             ORDER BY last_answered DESC, ea.attempt_number DESC`,
            [sessionId, participantId]
        );

        let targetExamId: string | undefined = undefined;
        let targetAttemptNumber: number | undefined = requestedAttempt;

        if (examId) {
            // Cek apakah ada jawaban langsung dengan examId ini
            const directMatch = answeredSubmissions.filter((s) => s.exam_id === examId);
            if (directMatch.length > 0) {
                targetExamId = examId;
                if (!targetAttemptNumber) {
                    targetAttemptNumber = directMatch[0].attempt_number;
                }
            } else {
                // Cek kemungkinan relasi remedial: apakah examId adalah induk atau paket remedial dari ujian yang dijawab
                const linkedExamRows = await executeQuery<any[]>(
                    `SELECT id, remedial_exam_id FROM exams WHERE id = ? OR remedial_exam_id = ?`,
                    [examId, examId]
                );
                const candidateIds = new Set<string>();
                for (const row of linkedExamRows || []) {
                    candidateIds.add(row.id);
                    if (row.remedial_exam_id) candidateIds.add(row.remedial_exam_id);
                }

                const linkedMatch = answeredSubmissions.find((s) => candidateIds.has(s.exam_id));
                if (linkedMatch) {
                    targetExamId = linkedMatch.exam_id;
                    if (!targetAttemptNumber) {
                        targetAttemptNumber = linkedMatch.attempt_number;
                    }
                } else {
                    targetExamId = examId;
                    targetAttemptNumber = targetAttemptNumber || 1;
                }
            }
        } else {
            // Jika examId tidak ditentukan secara spesifik:
            // Utamakan ujian yang memiliki rekaman jawaban aktual oleh peserta di sesi ini!
            if (answeredSubmissions.length > 0) {
                targetExamId = answeredSubmissions[0].exam_id;
                targetAttemptNumber = targetAttemptNumber || answeredSubmissions[0].attempt_number;
            } else {
                // Fallback ke ujian pertama dalam modul sesi
                const fallbackItem = await executeQuery<any[]>(
                    `SELECT mi.item_id
                     FROM module_items mi
                     WHERE mi.module_id = ? AND mi.item_type = 'exam'
                     ORDER BY mi.sequence_order ASC
                     LIMIT 1`,
                    [session.module_id]
                );
                if (!fallbackItem || fallbackItem.length === 0) return null;
                targetExamId = fallbackItem[0].item_id;
                targetAttemptNumber = targetAttemptNumber || 1;
            }
        }

        if (!targetExamId) return null;
        if (!targetAttemptNumber) targetAttemptNumber = 1;

        // 4. Ambil detail ujian dari master data
        const examRows = await executeQuery<any[]>(
            `SELECT id, title, duration_minutes, passing_grade FROM exams WHERE id = ? LIMIT 1`,
            [targetExamId]
        );
        if (!examRows || examRows.length === 0) return null;
        const exam = examRows[0];

        // 5. Cari module_item terkait untuk mengambil progres (skor, adjustment, dll)
        const moduleItemRows = await executeQuery<any[]>(
            `SELECT mi.id AS module_item_id, mi.sequence_order
             FROM module_items mi
             INNER JOIN exams e ON e.id = mi.item_id
             WHERE (mi.module_id = ? OR mi.module_id = ?)
               AND mi.item_type = 'exam'
               AND (e.id = ? OR e.remedial_exam_id = ?)
             ORDER BY mi.sequence_order ASC
             LIMIT 1`,
            [session.module_id, session.parent_session_id || session.module_id, targetExamId, targetExamId]
        );

        let progress: any = {};
        if (moduleItemRows && moduleItemRows.length > 0) {
            const progressRows = await executeQuery<any[]>(
                `SELECT up.id, up.score, up.original_score, up.score_adjustment, up.adjustment_reason,
                        up.attempts_count, up.updated_at, COALESCE(up.grading_pending, 0) AS grading_pending
                 FROM user_progress up
                 WHERE up.session_id = ? AND up.user_id = ? AND up.module_item_id = ?
                 LIMIT 1`,
                [sessionId, participantId, moduleItemRows[0].module_item_id]
            );
            progress = progressRows?.[0] || {};
        }

        // 6. Ambil butir jawaban yang direkam
        let answerRows = await executeQuery<any[]>(
            `SELECT ea.id, ea.question_id, ea.selected_option, ea.question_snapshot,
                    ea.is_correct, ea.grading_status, ea.awarded_points, ea.attempt_number, ea.answered_at,
                    ea.graded_at, grader.full_name AS grader_name,
                    q.question_type AS current_question_type,
                    q.question_text AS current_question_text,
                    q.question_image AS current_question_image,
                    q.options_json AS current_options_json,
                    q.correct_option_index AS current_correct_option_index,
                    q.correct_answer AS current_correct_answer,
                    q.points AS current_points,
                    q.sequence_order
             FROM exam_answers ea
             LEFT JOIN questions q ON q.id = ea.question_id
             LEFT JOIN users grader ON grader.id = ea.graded_by
             WHERE ea.session_id = ? AND ea.user_id = ? AND ea.exam_id = ? AND ea.attempt_number = ?
             ORDER BY COALESCE(q.sequence_order, 0) ASC, ea.answered_at ASC, ea.id ASC`,
            [sessionId, participantId, targetExamId, targetAttemptNumber]
        );

        // Fallback jika attempt spesifik tidak memiliki baris jawaban tapi peserta memiliki jawaban di attempt lain
        if ((!answerRows || answerRows.length === 0) && answeredSubmissions.length > 0) {
            const fallbackRows = await executeQuery<any[]>(
                `SELECT ea.id, ea.question_id, ea.selected_option, ea.question_snapshot,
                        ea.is_correct, ea.grading_status, ea.awarded_points, ea.attempt_number, ea.answered_at,
                        ea.graded_at, grader.full_name AS grader_name,
                        q.question_type AS current_question_type,
                        q.question_text AS current_question_text,
                        q.question_image AS current_question_image,
                        q.options_json AS current_options_json,
                        q.correct_option_index AS current_correct_option_index,
                        q.correct_answer AS current_correct_answer,
                        q.points AS current_points,
                        q.sequence_order
                 FROM exam_answers ea
                 LEFT JOIN questions q ON q.id = ea.question_id
                 LEFT JOIN users grader ON grader.id = ea.graded_by
                 WHERE ea.session_id = ? AND ea.user_id = ? AND ea.exam_id = ?
                 ORDER BY ea.attempt_number DESC, COALESCE(q.sequence_order, 0) ASC, ea.answered_at ASC, ea.id ASC`,
                [sessionId, participantId, targetExamId]
            );

            if (fallbackRows && fallbackRows.length > 0) {
                targetAttemptNumber = fallbackRows[0].attempt_number;
                answerRows = fallbackRows.filter((r) => r.attempt_number === targetAttemptNumber);
            }
        }

        let totalQuestions = 0;
        let correctCount = 0;
        let incorrectCount = 0;
        let unansweredCount = 0;
        let pendingCount = 0;
        let totalMaxPoints = 0;
        let earnedPoints = 0;
        let submittedAt: string | null = null;

        const questions: AnswerItemDetail[] = [];

        for (let i = 0; i < answerRows.length; i++) {
            const row = answerRows[i];
            totalQuestions++;
            if (row.answered_at) submittedAt = row.answered_at;

            let snapshot: any = null;
            if (row.question_snapshot) {
                try {
                    snapshot = JSON.parse(row.question_snapshot);
                } catch {}
            }

            const questionType: ExamQuestionType = snapshot?.question_type || row.current_question_type || 'multiple_choice';
            const questionText = snapshot?.question_text || row.current_question_text || 'Butir pertanyaan';
            const questionImage = snapshot?.question_image ?? row.current_question_image ?? null;
            const points = Number(snapshot?.points ?? row.current_points ?? 1) || 1;
            const awardedPoints = Number(row.awarded_points || 0);
            const isCorrect = Boolean(row.is_correct);
            const gradingStatus = row.grading_status || 'auto';
            const selectedRaw = row.selected_option ? String(row.selected_option).trim() : '';

            totalMaxPoints += points;
            earnedPoints += awardedPoints;

            if (!selectedRaw) {
                unansweredCount++;
            } else if (gradingStatus === 'pending') {
                pendingCount++;
            } else if (isCorrect) {
                correctCount++;
            } else {
                incorrectCount++;
            }

            // Ekstrak opsi jawaban teks
            const rawOptions = snapshot?.options_json ?? row.current_options_json;
            const parsedOptions = parseOptionsJson(rawOptions);
            const normalizedOpts = normalizeOptions(
                questionType === 'multiple_select' && parsedOptions && typeof parsedOptions === 'object'
                    ? (parsedOptions as any).options
                    : parsedOptions
            ).map((opt) => opt.text);

            let participantLines: string[] = [];
            let correctLines: string[] = [];

            // 1. Jawaban Benar (Kunci)
            if (questionType === 'multiple_choice' || questionType === 'true_false') {
                const cIdx = Number(snapshot?.correct_option_index ?? row.current_correct_option_index);
                if (Number.isInteger(cIdx) && normalizedOpts[cIdx] !== undefined) {
                    correctLines = [`${String.fromCharCode(65 + cIdx)}. ${normalizedOpts[cIdx]}`];
                }
            } else if (questionType === 'multiple_select') {
                let correctIndices: number[] = [];
                if (parsedOptions && typeof parsedOptions === 'object' && Array.isArray((parsedOptions as any).correct_indices)) {
                    correctIndices = (parsedOptions as any).correct_indices;
                }
                correctLines = correctIndices.map(
                    (idx) => `${String.fromCharCode(65 + idx)}. ${normalizedOpts[idx] || ''}`
                ).filter(Boolean);
            } else if (questionType === 'matching') {
                let rawPairs: any[] = [];
                if (parsedOptions && typeof parsedOptions === 'object' && Array.isArray((parsedOptions as any).pairs)) {
                    rawPairs = (parsedOptions as any).pairs;
                }
                correctLines = rawPairs.map((p) => `${p.left} ➔ ${p.right}`);
            } else if (questionType === 'short_answer') {
                const cAns = snapshot?.correct_answer || row.current_correct_answer || '';
                if (cAns) correctLines = [cAns];
            } else if (questionType === 'essay') {
                correctLines = ['Kriteria penilaian manual oleh administrator / asesor penguji.'];
            }

            // 2. Jawaban Peserta
            if (!selectedRaw) {
                participantLines = ['(Tidak Dijawab)'];
            } else if (questionType === 'multiple_choice' || questionType === 'true_false') {
                const sIdx = Number(selectedRaw);
                if (Number.isInteger(sIdx) && normalizedOpts[sIdx] !== undefined) {
                    participantLines = [`${String.fromCharCode(65 + sIdx)}. ${normalizedOpts[sIdx]}`];
                } else {
                    participantLines = [selectedRaw];
                }
            } else if (questionType === 'multiple_select') {
                const indices = parseIndexSet(selectedRaw, normalizedOpts.length) || [];
                participantLines = indices.map(
                    (idx) => `${String.fromCharCode(65 + idx)}. ${normalizedOpts[idx] || ''}`
                ).filter(Boolean);
            } else if (questionType === 'matching') {
                const pairs: MatchingPair[] = parseMatchingAnswer(selectedRaw) || [];
                participantLines = pairs.map((p) => `${p.left} ➔ ${p.right}`);
            } else {
                participantLines = [selectedRaw];
            }

            questions.push({
                question_id: row.question_id,
                sequence_order: row.sequence_order !== null && row.sequence_order !== undefined ? Number(row.sequence_order) : i + 1,
                question_type: questionType,
                question_text: questionText,
                question_image: questionImage,
                points,
                awarded_points: awardedPoints,
                is_correct: isCorrect,
                grading_status: gradingStatus,
                selected_option_raw: selectedRaw,
                participant_answer_lines: participantLines,
                correct_answer_lines: correctLines,
                grader_name: row.grader_name || null,
                graded_at: row.graded_at || null,
            });
        }

        const calculatedScore = totalMaxPoints > 0 ? (earnedPoints / totalMaxPoints) * 100 : 0;
        const originalScore = progress.original_score !== null && progress.original_score !== undefined
            ? Number(progress.original_score)
            : (progress.score !== null && progress.score !== undefined ? Number(progress.score) : calculatedScore);
        const scoreAdjustment = Number(progress.score_adjustment || 0);
        const finalScore = progress.score !== null && progress.score !== undefined
            ? Number(progress.score)
            : Math.min(100, Math.max(0, originalScore + scoreAdjustment));
        const passingGrade = Number(exam.passing_grade ?? 70);
        const isPassed = !Boolean(progress.grading_pending) && pendingCount === 0 && finalScore >= passingGrade;

        const submittedAtValue = submittedAt || progress.updated_at || null;
        const finalAttemptNumber = Number(targetAttemptNumber || 1);
        const docId = createAnswerSheetDocumentId({
            sessionId,
            participantId,
            examId: targetExamId,
            attemptNumber: finalAttemptNumber,
            submittedAt: submittedAtValue,
        });

        return {
            session: {
                id: session.id,
                title: session.title,
                module_title: session.module_title || session.title,
                start_time: session.start_time,
                end_time: session.end_time,
            },
            participant: {
                id: participant.id,
                username: participant.username,
                full_name: participant.full_name || participant.username,
                nip: participant.nip || null,
                id_card_number: participant.id_card_number || null,
                institution: participant.institution || null,
                batch: participant.batch || '1',
                graduation_status: participant.graduation_status || 'pending',
                skl_number: participant.skl_number || null,
            },
            exam: {
                id: exam.id,
                title: exam.title,
                passing_grade: passingGrade,
                duration_minutes: Number(exam.duration_minutes || 60),
                attempt_number: finalAttemptNumber,
                submitted_at: submittedAtValue,
            },
            stats: {
                total_questions: totalQuestions,
                correct_count: correctCount,
                incorrect_count: incorrectCount,
                unanswered_count: unansweredCount,
                pending_count: pendingCount,
                total_max_points: totalMaxPoints,
                earned_points: earnedPoints,
                original_score: Math.round(originalScore * 100) / 100,
                score_adjustment: Math.round(scoreAdjustment * 100) / 100,
                final_score: Math.round(finalScore * 100) / 100,
                adjustment_reason: progress.adjustment_reason || null,
                is_passed: isPassed,
            },
            questions,
            document_id: docId,
            generated_at: new Date().toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' }),
        };
    } catch (error) {
        logger.error('GET_ANSWER_SHEET_DATA', 'Gagal menyusun data lembar jawaban', error);
        return null;
    }
}

/**
 * Menghasilkan markup HTML A4 print-ready yang elegan untuk lembar pengerjaan ujian.
 */
export async function renderAnswerSheetHtml(data: AnswerSheetData, baseUrl?: string): Promise<string> {
    // 1. Baca Logo Nusamitra base64
    let logoBase64 = '';
    try {
        const logoPath = path.join(process.cwd(), 'public', 'logo-nusamitra-tr.png');
        if (fs.existsSync(logoPath)) {
            const logoBuf = fs.readFileSync(logoPath);
            logoBase64 = `data:image/png;base64,${logoBuf.toString('base64')}`;
        }
    } catch (e) {
        console.error('Failed reading logo for answer sheet:', e);
    }

    // 2. Generate QR Code Verifikasi
    const verifyOrigin = baseUrl || process.env.NEXT_PUBLIC_APP_URL || 'https://lms.nusamitraconsulting.com';
    const verifyUrl = `${verifyOrigin.replace(/\/+$/, '')}/verify/exam/${data.session.id}/${data.participant.id}?exam=${encodeURIComponent(data.exam.id)}&doc=${encodeURIComponent(data.document_id)}`;
    
    let qrCodeDataUrl = '';
    try {
        qrCodeDataUrl = await QRCode.toDataURL(verifyUrl, {
            errorCorrectionLevel: 'M',
            margin: 1,
            width: 110,
            color: { dark: '#0f172a', light: '#ffffff' },
        });
    } catch (e) {
        console.error('QR code generation failed:', e);
    }

    const typeLabelMap: Record<ExamQuestionType, string> = {
        multiple_choice: 'Pilihan Ganda',
        multiple_select: 'Pilihan Ganda Kompleks',
        true_false: 'Benar / Salah',
        short_answer: 'Isian Singkat',
        essay: 'Esai / Uraian',
        matching: 'Menjodohkan',
    };

    const questionsHtml = data.questions.map((q, idx) => {
        const isUnanswered = !q.selected_option_raw;
        const isPending = q.grading_status === 'pending';
        const isCorrect = q.is_correct;

        const statusBadgeClass = isUnanswered
            ? 'badge-unanswered'
            : isPending
            ? 'badge-pending'
            : isCorrect
            ? 'badge-correct'
            : 'badge-incorrect';

        const statusLabel = isUnanswered
            ? 'KOSONG'
            : isPending
            ? 'MENUNGGU PENILAIAN'
            : isCorrect
            ? 'BENAR'
            : 'SALAH';

        return `
        <div class="question-card">
            <div class="question-header">
                <div class="q-meta">
                    <span class="q-num">Soal #${idx + 1}</span>
                    <span class="q-type">${typeLabelMap[q.question_type] || q.question_type}</span>
                </div>
                <div class="q-badges">
                    <span class="score-pill">${q.awarded_points} / ${q.points} Poin</span>
                    <span class="status-badge ${statusBadgeClass}">${statusLabel}</span>
                </div>
            </div>

            <div class="question-body">
                <div class="q-text">${escapeHtml(q.question_text)}</div>
                ${q.question_image ? `<div class="q-img-wrap"><img src="${escapeHtml(q.question_image)}" class="q-img" alt="Lampiran Soal" /></div>` : ''}

                <div class="answers-comparison">
                    <div class="ans-box participant-ans ${isCorrect ? 'is-correct' : isUnanswered ? 'is-empty' : 'is-wrong'}">
                        <div class="ans-box-title">Jawaban Peserta:</div>
                        <div class="ans-box-content">
                            ${q.participant_answer_lines.map((l) => `<div class="ans-line">${escapeHtml(l)}</div>`).join('')}
                        </div>
                        ${q.grader_name ? `<div class="grader-note">Dinilai oleh: ${escapeHtml(q.grader_name)}</div>` : ''}
                    </div>

                    <div class="ans-box correct-ans">
                        <div class="ans-box-title">Kunci Jawaban Resmi:</div>
                        <div class="ans-box-content">
                            ${q.correct_answer_lines.map((l) => `<div class="ans-line">${escapeHtml(l)}</div>`).join('')}
                        </div>
                    </div>
                </div>
            </div>
        </div>
        `;
    }).join('');

    const formattedSubmittedAt = data.exam.submitted_at
        ? new Date(data.exam.submitted_at).toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'short' })
        : 'Selesai Pengerjaan';

    return `<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Lembar Hasil Pengerjaan - ${escapeHtml(data.participant.full_name)}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;600;700&display=swap" rel="stylesheet">
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
            color: #0f172a;
            background-color: #f1f5f9;
            line-height: 1.5;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }
        .container {
            max-width: 210mm;
            margin: 20px auto;
            background: #ffffff;
            padding: 16mm 18mm;
            border-radius: 12px;
            box-shadow: 0 10px 25px -5px rgba(0,0,0,0.08);
        }
        @media print {
            body { background: none; }
            .container {
                margin: 0;
                padding: 0;
                border-radius: 0;
                box-shadow: none;
                max-width: 100%;
            }
            .no-print { display: none !important; }
            .question-card {
                break-inside: avoid;
                page-break-inside: avoid;
            }
        }

        /* Floating Action Bar */
        .print-bar {
            position: fixed;
            top: 20px;
            right: 20px;
            background: #0f172a;
            color: #ffffff;
            padding: 10px 18px;
            border-radius: 30px;
            display: flex;
            align-items: center;
            gap: 12px;
            box-shadow: 0 8px 20px rgba(0,0,0,0.25);
            z-index: 9999;
        }
        .print-btn {
            background: #2563eb;
            color: #ffffff;
            border: none;
            padding: 7px 15px;
            border-radius: 20px;
            font-weight: 700;
            font-size: 12px;
            cursor: pointer;
            transition: all 0.15s;
        }
        .print-btn:hover { background: #1d4ed8; }

        /* Header / Kop */
        .letterhead {
            display: flex;
            align-items: center;
            justify-content: space-between;
            border-bottom: 2.5px solid #0f172a;
            padding-bottom: 12px;
            margin-bottom: 16px;
        }
        .logo-wrap img {
            height: 48px;
            width: auto;
            object-fit: contain;
        }
        .org-info {
            text-align: right;
            font-size: 10px;
            color: #475569;
            line-height: 1.35;
        }
        .org-info strong {
            font-size: 12px;
            color: #0f172a;
        }

        /* Document Title */
        .doc-title-block {
            text-align: center;
            margin-bottom: 16px;
        }
        .doc-title {
            font-size: 16px;
            font-weight: 800;
            letter-spacing: 0.5px;
            text-transform: uppercase;
            color: #0f172a;
        }
        .doc-subtitle {
            font-size: 11px;
            font-weight: 600;
            color: #2563eb;
            margin-top: 2px;
        }

        /* Info Grid */
        .info-grid {
            display: grid;
            grid-template-columns: 1.2fr 1fr;
            gap: 12px;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 12px 14px;
            margin-bottom: 16px;
            font-size: 11px;
        }
        .info-col {
            display: flex;
            flex-direction: column;
            gap: 5px;
        }
        .info-row {
            display: flex;
            align-items: baseline;
        }
        .info-label {
            width: 120px;
            color: #64748b;
            font-weight: 500;
            flex-shrink: 0;
        }
        .info-value {
            color: #0f172a;
            font-weight: 600;
            word-break: break-word;
        }

        /* Result Summary Banner */
        .summary-banner {
            display: grid;
            grid-template-columns: 140px 1fr;
            border: 1.5px solid ${data.stats.is_passed ? '#10b981' : '#f43f5e'};
            border-radius: 10px;
            overflow: hidden;
            margin-bottom: 20px;
            background: #ffffff;
        }
        .score-box {
            background: ${data.stats.is_passed ? '#ecfdf5' : '#fff1f2'};
            border-right: 1px solid ${data.stats.is_passed ? '#a7f3d0' : '#fecdd3'};
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 12px;
            text-align: center;
        }
        .score-label {
            font-size: 10px;
            font-weight: 700;
            text-transform: uppercase;
            color: #64748b;
            margin-bottom: 2px;
        }
        .score-num {
            font-size: 28px;
            font-weight: 900;
            font-family: 'JetBrains Mono', monospace;
            color: ${data.stats.is_passed ? '#047857' : '#be123c'};
            line-height: 1;
        }
        .verdict-pill {
            margin-top: 6px;
            padding: 2px 10px;
            border-radius: 12px;
            font-size: 10px;
            font-weight: 800;
            text-transform: uppercase;
            background: ${data.stats.is_passed ? '#10b981' : '#f43f5e'};
            color: #ffffff;
            letter-spacing: 0.5px;
        }
        .score-details-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 8px;
            padding: 10px 14px;
            align-items: center;
        }
        .stat-item {
            text-align: center;
        }
        .stat-title {
            font-size: 10px;
            color: #64748b;
            font-weight: 600;
            margin-bottom: 2px;
        }
        .stat-val {
            font-size: 13px;
            font-weight: 800;
            font-family: 'JetBrains Mono', monospace;
            color: #0f172a;
        }
        .stat-adj-note {
            grid-column: 1 / -1;
            font-size: 10px;
            color: #2563eb;
            background: #eff6ff;
            border: 1px dashed #bfdbfe;
            padding: 4px 8px;
            border-radius: 6px;
            margin-top: 4px;
        }

        /* Section Title */
        .section-heading {
            font-size: 12px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #334155;
            margin-bottom: 12px;
            padding-bottom: 4px;
            border-bottom: 1.5px solid #e2e8f0;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }

        /* Question Cards */
        .question-card {
            border: 1px solid #cbd5e1;
            border-radius: 8px;
            padding: 12px 14px;
            margin-bottom: 12px;
            background: #ffffff;
        }
        .question-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 8px;
            border-bottom: 1px solid #f1f5f9;
            padding-bottom: 6px;
        }
        .q-meta {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .q-num {
            font-size: 12px;
            font-weight: 800;
            color: #0f172a;
        }
        .q-type {
            font-size: 10px;
            font-weight: 600;
            padding: 2px 7px;
            border-radius: 4px;
            background: #f1f5f9;
            color: #475569;
        }
        .q-badges {
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .score-pill {
            font-size: 11px;
            font-weight: 700;
            font-family: 'JetBrains Mono', monospace;
            color: #0f172a;
            background: #f8fafc;
            border: 1px solid #cbd5e1;
            padding: 2px 7px;
            border-radius: 4px;
        }
        .status-badge {
            font-size: 10px;
            font-weight: 800;
            padding: 2px 8px;
            border-radius: 4px;
            letter-spacing: 0.3px;
        }
        .badge-correct { background: #dcfce7; color: #15803d; border: 1px solid #86efac; }
        .badge-incorrect { background: #ffe4e6; color: #be123c; border: 1px solid #fca5a5; }
        .badge-unanswered { background: #f1f5f9; color: #64748b; border: 1px solid #cbd5e1; }
        .badge-pending { background: #fef3c7; color: #b45309; border: 1px solid #fde68a; }

        .q-text {
            font-size: 12px;
            font-weight: 600;
            color: #1e293b;
            margin-bottom: 10px;
            line-height: 1.55;
            white-space: pre-wrap;
        }
        .q-img-wrap {
            margin-bottom: 10px;
        }
        .q-img {
            max-width: 100%;
            max-height: 200px;
            border-radius: 6px;
            border: 1px solid #e2e8f0;
        }

        .answers-comparison {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
        }
        .ans-box {
            padding: 8px 10px;
            border-radius: 6px;
            font-size: 11px;
        }
        .ans-box-title {
            font-size: 9.5px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.3px;
            margin-bottom: 4px;
        }
        .ans-line {
            font-weight: 500;
            margin-bottom: 2px;
            line-height: 1.4;
            white-space: pre-wrap;
            word-break: break-word;
        }
        .grader-note {
            margin-top: 4px;
            font-size: 9.5px;
            font-style: italic;
            color: #64748b;
        }

        .participant-ans.is-correct {
            background: #f0fdf4;
            border: 1px solid #bbf7d0;
            color: #166534;
        }
        .participant-ans.is-correct .ans-box-title { color: #15803d; }

        .participant-ans.is-wrong {
            background: #fff1f2;
            border: 1px solid #fecdd3;
            color: #9f1239;
        }
        .participant-ans.is-wrong .ans-box-title { color: #be123c; }

        .participant-ans.is-empty {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            color: #64748b;
        }
        .correct-ans {
            background: #f0fdf4;
            border: 1px solid #86efac;
            color: #14532d;
        }
        .correct-ans .ans-box-title { color: #16a34a; }

        /* Footer & Signatures */
        .doc-footer {
            margin-top: 24px;
            padding-top: 14px;
            border-top: 1.5px dashed #cbd5e1;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
        .verification-block {
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .qr-img {
            width: 72px;
            height: 72px;
            border-radius: 4px;
            border: 1px solid #cbd5e1;
        }
        .verify-text {
            font-size: 9px;
            color: #64748b;
            line-height: 1.35;
        }
        .verify-text strong {
            color: #0f172a;
            font-size: 10px;
        }
        .signatures-block {
            text-align: right;
            font-size: 10px;
            color: #475569;
        }
        .sig-date { margin-bottom: 30px; }
        .sig-name {
            font-weight: 700;
            color: #0f172a;
            text-decoration: underline;
        }
        .sig-title { font-size: 9px; }
    </style>
</head>
<body>
    <div class="print-bar no-print">
        <span style="font-size: 12px; font-weight: 600;">Lembar Pengerjaan Resmi</span>
        <button type="button" onclick="window.print()" class="print-btn">🖨️ Cetak / Simpan PDF</button>
    </div>

    <div class="container">
        <!-- Kop Surat -->
        <div class="letterhead">
            <div class="logo-wrap">
                ${logoBase64 ? `<img src="${logoBase64}" alt="Logo Lembaga" />` : `<strong style="font-size: 18px;">LMS PT NUSAMITRA CONSULTING INDONESIA</strong>`}
            </div>
            <div class="org-info">
                <strong>LEMBAGA PELATIHAN & PENGEMBANGAN PROFESI</strong><br>
                Divisi Sertifikasi, Asesmen & Penjaminan Mutu Kompetensi<br>
                Sistem Evaluasi Komputer Terpadu (Computer-Based Test)
            </div>
        </div>

        <!-- Judul Dokumen -->
        <div class="doc-title-block">
            <h1 class="doc-title">Lembar Hasil Pengerjaan Evaluasi Peserta</h1>
            <p class="doc-subtitle">${escapeHtml(data.session.title)}</p>
        </div>

        <!-- Profil & Metadata -->
        <div class="info-grid">
            <div class="info-col">
                <div class="info-row">
                    <span class="info-label">Nama Peserta</span>
                    <span class="info-value">: ${escapeHtml(data.participant.full_name)}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Username / Akun</span>
                    <span class="info-value">: ${escapeHtml(data.participant.username)}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">NIP / NIK</span>
                    <span class="info-value">: ${escapeHtml(data.participant.nip || data.participant.id_card_number || '-')}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Instansi / Unit Kerja</span>
                    <span class="info-value">: ${escapeHtml(data.participant.institution || '-')}</span>
                </div>
            </div>
            <div class="info-col">
                <div class="info-row">
                    <span class="info-label">Nama Modul Ujian</span>
                    <span class="info-value">: ${escapeHtml(data.exam.title)}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Waktu Selesai</span>
                    <span class="info-value">: ${formattedSubmittedAt}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Percobaan (Attempt)</span>
                    <span class="info-value">: Percobaan ke-${data.exam.attempt_number}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">No. Dokumen Lembar</span>
                    <span class="info-value" style="font-family: 'JetBrains Mono', monospace; font-size: 10px;">: ${data.document_id}</span>
                </div>
            </div>
        </div>

        <!-- Ringkasan Hasil & Nilai Akhir -->
        <div class="summary-banner">
            <div class="score-box">
                <div class="score-label">Nilai Akhir</div>
                <div class="score-num">${data.stats.final_score.toFixed(1)}</div>
                <div class="verdict-pill">${data.stats.is_passed ? 'LULUS' : 'TIDAK LULUS'}</div>
            </div>
            <div class="score-details-grid">
                <div class="stat-item">
                    <div class="stat-title">Nilai Asli Ujian</div>
                    <div class="stat-val">${data.stats.original_score.toFixed(1)}</div>
                </div>
                <div class="stat-item">
                    <div class="stat-title">Penyesuaian</div>
                    <div class="stat-val" style="color: ${data.stats.score_adjustment > 0 ? '#15803d' : data.stats.score_adjustment < 0 ? '#be123c' : '#64748b'};">
                        ${data.stats.score_adjustment > 0 ? `+${data.stats.score_adjustment.toFixed(1)}` : data.stats.score_adjustment.toFixed(1)}
                    </div>
                </div>
                <div class="stat-item">
                    <div class="stat-title">Passing Grade</div>
                    <div class="stat-val">${data.exam.passing_grade}</div>
                </div>
                <div class="stat-item">
                    <div class="stat-title">Statistik Butir</div>
                    <div class="stat-val" style="font-size: 11px;">
                        <span style="color: #15803d;">${data.stats.correct_count}B</span> / 
                        <span style="color: #be123c;">${data.stats.incorrect_count}S</span> / 
                        <span style="color: #64748b;">${data.stats.unanswered_count}K</span>
                    </div>
                </div>
                ${data.stats.score_adjustment !== 0 && data.stats.adjustment_reason ? `
                    <div class="stat-adj-note">
                        <strong>Catatan Penyesuaian Nilai:</strong> ${escapeHtml(data.stats.adjustment_reason)}
                    </div>
                ` : ''}
            </div>
        </div>

        <!-- Daftar Butir Soal & Jawaban -->
        <div class="section-heading">
            <span>Rincian Pengerjaan Butir Soal (${data.questions.length} Butir)</span>
            <span style="font-weight: 600; text-transform: none;">Perolehan: ${data.stats.earned_points} dari ${data.stats.total_max_points} Poin</span>
        </div>

        <div class="questions-list">
            ${questionsHtml}
        </div>

        <!-- Pengesahan / Footer -->
        <div class="doc-footer">
            <div class="verification-block">
                ${qrCodeDataUrl ? `<img src="${qrCodeDataUrl}" class="qr-img" alt="QR Verifikasi" />` : ''}
                <div class="verify-text">
                    <strong>Dokumen Digital Resmi Terverifikasi</strong><br>
                    ID Dokumen: ${data.document_id}<br>
                    Dicetak pada: ${data.generated_at}<br>
                    Keabsahan berkas dapat dipindai melalui barcode di samping.
                </div>
            </div>

            <div class="signatures-block">
                <div class="sig-date">Ditetapkan pada: ${data.generated_at}</div>
                <div class="sig-name">Tim Penilai & Asesor LMS</div>
                <div class="sig-title">PT Nusamitra Consulting Indonesia Examination Committee</div>
            </div>
        </div>
    </div>
</body>
</html>`;
}

function escapeHtml(str: string | null | undefined): string {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Merender dokumen PDF dari markup HTML menggunakan headless browser (Puppeteer).
 */
async function launchAnswerSheetBrowser() {
    const puppeteer = (await import('puppeteer')).default;

    const possibleBrowserPaths = [
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Users\\' + (process.env.USERNAME || 'IT WIG') + '\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe',
    ];

    let executablePath: string | undefined = undefined;
    for (const p of possibleBrowserPaths) {
        if (fs.existsSync(/* turbopackIgnore: true */ p)) {
            executablePath = p;
            break;
        }
    }

    const launchOptions: any = {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
    };
    if (executablePath) {
        launchOptions.executablePath = executablePath;
    }

    return puppeteer.launch(launchOptions);
}

type AnswerSheetBrowser = Awaited<ReturnType<typeof launchAnswerSheetBrowser>>;
let sharedBrowserPromise: Promise<AnswerSheetBrowser> | null = null;
let activePdfRenders = 0;
const pdfRenderWaiters: Array<() => void> = [];

async function acquirePdfRenderSlot(): Promise<void> {
    if (activePdfRenders < 2) {
        activePdfRenders += 1;
        return;
    }
    await new Promise<void>((resolve) => pdfRenderWaiters.push(resolve));
    activePdfRenders += 1;
}

function releasePdfRenderSlot(): void {
    activePdfRenders = Math.max(0, activePdfRenders - 1);
    pdfRenderWaiters.shift()?.();
}

async function getSharedAnswerSheetBrowser(): Promise<AnswerSheetBrowser> {
    if (!sharedBrowserPromise) {
        sharedBrowserPromise = launchAnswerSheetBrowser().catch((error) => {
            sharedBrowserPromise = null;
            throw error;
        });
    }
    const browser = await sharedBrowserPromise;
    if (!browser.connected) {
        sharedBrowserPromise = null;
        return getSharedAnswerSheetBrowser();
    }
    return browser;
}

async function renderAnswerSheetPdfWithBrowser(browser: AnswerSheetBrowser, html: string): Promise<Buffer> {
    const page = await browser.newPage();
    try {
        await page.setContent(html, { waitUntil: 'load' });
        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: {
                top: '10mm',
                right: '12mm',
                bottom: '10mm',
                left: '12mm',
            },
        });
        return Buffer.from(pdfBuffer);
    } finally {
        await page.close().catch(() => {});
    }
}

export async function generateAnswerSheetPdf(html: string): Promise<Buffer> {
    await acquirePdfRenderSlot();
    try {
        const browser = await getSharedAnswerSheetBrowser();
        return await renderAnswerSheetPdfWithBrowser(browser, html);
    } finally {
        releasePdfRenderSlot();
    }
}

/**
 * Menghasilkan berkas arsip ZIP yang memuat lembar jawaban seluruh peserta terpilih.
 */
export async function generateBulkAnswerSheetsZip(
    sessionId: string,
    participantIds: string[],
    examId?: string,
    format: 'pdf' | 'html' = 'pdf',
    baseUrl?: string
): Promise<{ buffer: Buffer; filename: string; totalProcessed: number }> {
    const zip = new JSZip();
    let processedCount = 0;
    let browser: AnswerSheetBrowser | null = null;
    if (format === 'pdf') {
        try {
            browser = await launchAnswerSheetBrowser();
        } catch (error) {
            logger.warn('BULK_PDF_BROWSER_UNAVAILABLE', 'Browser PDF tidak tersedia; seluruh dokumen akan memakai fallback HTML', {
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }

    // Ambil detail sesi untuk nama zip
    const sessionRows = await executeQuery<any[]>(
        `SELECT title FROM sessions WHERE id = ? LIMIT 1`,
        [sessionId]
    );
    const sessionTitle = sessionRows?.[0]?.title ? sessionRows[0].title.replace(/[^a-zA-Z0-9_-]/g, '_') : sessionId;

    try {
        for (let i = 0; i < participantIds.length; i++) {
            const pId = participantIds[i];
            const data = await getParticipantAnswerSheetData(sessionId, pId, examId);
            if (!data) continue;

            const html = await renderAnswerSheetHtml(data, baseUrl);
            const padIndex = String(i + 1).padStart(2, '0');
            const safeNipOrUsername = (data.participant.nip || data.participant.username || 'user').replace(/[^a-zA-Z0-9_-]/g, '_');
            const safeName = data.participant.full_name.replace(/[^a-zA-Z0-9_-]/g, '_');

            if (format === 'pdf' && browser) {
                try {
                    const pdfBuffer = await renderAnswerSheetPdfWithBrowser(browser, html);
                    const filename = `${padIndex}_${safeNipOrUsername}_${safeName}_Lembar_Pengerjaan.pdf`;
                    zip.file(filename, pdfBuffer);
                    processedCount++;
                } catch (pdfErr) {
                    // Fallback ke file HTML jika satu halaman gagal dirender.
                    logger.warn('BULK_PDF_FAIL_FALLBACK_HTML', `Fallback ke HTML untuk peserta ${safeName}`, {
                        error: pdfErr instanceof Error ? pdfErr.message : String(pdfErr),
                    });
                    const filename = `${padIndex}_${safeNipOrUsername}_${safeName}_Lembar_Pengerjaan.html`;
                    zip.file(filename, html);
                    processedCount++;
                }
            } else {
                const filename = `${padIndex}_${safeNipOrUsername}_${safeName}_Lembar_Pengerjaan.html`;
                zip.file(filename, html);
                processedCount++;
            }
        }
    } finally {
        await browser?.close().catch(() => {});
    }

    const zipBuffer = await zip.generateAsync({
        type: 'nodebuffer',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
    });

    const dateStr = new Date().toISOString().split('T')[0];
    const zipFilename = `Lembar_Jawaban_${sessionTitle}_${dateStr}.zip`;

    return {
        buffer: zipBuffer,
        filename: zipFilename,
        totalProcessed: processedCount,
    };
}
