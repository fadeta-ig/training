import { executeQuery } from '@/lib/db';

export interface QuestionImportExamUsage {
    examExists: boolean;
    activeSessionCount: number;
    activeAttemptCount: number;
    historicalAnswerCount: number;
}

interface CountRow {
    total: number | string;
}

export async function getQuestionImportExamUsage(examId: string): Promise<QuestionImportExamUsage> {
    const [examRows, activeSessionRows, activeAttemptRows, historicalAnswerRows] = await Promise.all([
        executeQuery<Array<{ id: string }>>(
            'SELECT id FROM exams WHERE id = ? LIMIT 1',
            [examId],
        ),
        executeQuery<CountRow[]>(
            `SELECT COUNT(DISTINCT s.id) AS total
             FROM sessions s
             INNER JOIN module_items mi ON mi.module_id = s.module_id AND mi.item_type = 'exam'
             LEFT JOIN exams parent_exam ON parent_exam.id = mi.item_id
             WHERE (mi.item_id = ? OR parent_exam.remedial_exam_id = ?)
               AND s.start_time <= NOW()
               AND s.end_time >= NOW()`,
            [examId, examId],
        ),
        executeQuery<CountRow[]>(
            `SELECT COUNT(DISTINCT up.id) AS total
             FROM user_progress up
             INNER JOIN module_items mi ON mi.id = up.module_item_id AND mi.item_type = 'exam'
             LEFT JOIN exams parent_exam ON parent_exam.id = mi.item_id
             WHERE (mi.item_id = ? OR parent_exam.remedial_exam_id = ?)
               AND up.status = 'open'
               AND up.last_attempt_start IS NOT NULL`,
            [examId, examId],
        ),
        executeQuery<CountRow[]>(
            'SELECT COUNT(*) AS total FROM exam_answers WHERE exam_id = ?',
            [examId],
        ),
    ]);

    return {
        examExists: examRows.length > 0,
        activeSessionCount: Number(activeSessionRows[0]?.total ?? 0),
        activeAttemptCount: Number(activeAttemptRows[0]?.total ?? 0),
        historicalAnswerCount: Number(historicalAnswerRows[0]?.total ?? 0),
    };
}

export function isQuestionImportBlocked(usage: QuestionImportExamUsage): boolean {
    return usage.activeSessionCount > 0 || usage.activeAttemptCount > 0;
}

export function getQuestionImportBlockedMessage(usage: QuestionImportExamUsage): string {
    if (usage.activeAttemptCount > 0) {
        return `Import diblokir karena terdapat ${usage.activeAttemptCount} attempt ujian yang sedang aktif. Duplikasi ujian terlebih dahulu agar peserta tidak menerima susunan soal yang berubah.`;
    }
    return `Import diblokir karena ujian digunakan oleh ${usage.activeSessionCount} sesi yang sedang berlangsung. Duplikasi ujian terlebih dahulu atau tunggu sesi selesai.`;
}
