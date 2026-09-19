import type { PoolConnection, RowDataPacket } from 'mysql2/promise';

export type ResultOutcome = 'passed' | 'remedial_required' | 'remedial_exhausted' | 'absent';

export interface AttemptScore {
    id: string;
    final_score: number | string | null;
    attempt_number: number | string;
    completed_at?: string | Date | null;
}

export interface ExamResultMapping extends RowDataPacket {
    module_item_id: string;
    exam_id: string;
    source_exam_id: string;
    exam_title: string;
    source_exam_title: string;
    passing_grade: number | string;
    allow_remedial: number | boolean;
    remedial_exam_id: string | null;
}

export interface SessionResultContext extends RowDataPacket {
    id: string;
    module_id: string;
    session_type: 'regular' | 'remedial';
    parent_session_id: string | null;
    remedial_cycle: number | string;
    result_state: 'draft' | 'published';
    result_publication_version: number | string;
    root_session_id: string;
}

export function pickHighestAttempt<T extends AttemptScore>(attempts: T[]): T | null {
    return attempts.reduce<T | null>((best, current) => {
        if (current.final_score === null || current.final_score === undefined) return best;
        if (!best) return current;
        const score = Number(current.final_score);
        const bestScore = Number(best.final_score);
        if (score > bestScore) return current;
        if (score < bestScore) return best;
        return Number(current.attempt_number) >= Number(best.attempt_number) ? current : best;
    }, null);
}

export function classifyPublishedOutcome(input: {
    bestScore: number | null;
    passingGrade: number;
    hasNextRemedialSession: boolean;
}): ResultOutcome {
    if (input.bestScore === null || !Number.isFinite(input.bestScore)) return 'absent';
    if (input.bestScore >= input.passingGrade) return 'passed';
    return input.hasNextRemedialSession ? 'remedial_required' : 'remedial_exhausted';
}

export async function getSessionResultContext(
    connection: PoolConnection,
    sessionId: string,
    lock = false,
): Promise<SessionResultContext | null> {
    const [rows] = await connection.execute<SessionResultContext[]>(
        `SELECT s.id, s.module_id, s.session_type, s.parent_session_id, s.remedial_cycle,
                s.result_state, s.result_publication_version,
                CASE WHEN s.session_type = 'remedial' THEN s.parent_session_id ELSE s.id END AS root_session_id
         FROM sessions s
         WHERE s.id = ?
         LIMIT 1${lock ? ' FOR UPDATE' : ''}`,
        [sessionId],
    );
    return rows[0] || null;
}

/**
 * Maps every exam in a session to the regular/source exam whose passing grade
 * governs graduation. A remedial exam must be referenced by exactly one exam
 * in the parent module; ambiguous mappings are rejected by the caller.
 */
export async function getSessionExamMappings(
    connection: PoolConnection,
    context: SessionResultContext,
): Promise<ExamResultMapping[]> {
    if (context.session_type === 'regular') {
        const [rows] = await connection.execute<ExamResultMapping[]>(
            `SELECT mi.id AS module_item_id, e.id AS exam_id, e.id AS source_exam_id,
                    e.title AS exam_title, e.title AS source_exam_title,
                    e.passing_grade, e.allow_remedial, e.remedial_exam_id
             FROM module_items mi
             JOIN exams e ON e.id = mi.item_id
             WHERE mi.module_id = ? AND mi.item_type = 'exam'
             ORDER BY mi.sequence_order ASC`,
            [context.module_id],
        );
        return rows;
    }

    const [rows] = await connection.execute<ExamResultMapping[]>(
        `SELECT remedial_mi.id AS module_item_id,
                remedial_exam.id AS exam_id,
                source_exam.id AS source_exam_id,
                remedial_exam.title AS exam_title,
                source_exam.title AS source_exam_title,
                source_exam.passing_grade,
                source_exam.allow_remedial,
                source_exam.remedial_exam_id
         FROM module_items remedial_mi
         JOIN exams remedial_exam ON remedial_exam.id = remedial_mi.item_id
         JOIN module_items source_mi ON source_mi.module_id = (
             SELECT module_id FROM sessions WHERE id = ?
         )
         JOIN exams source_exam
           ON source_mi.item_type = 'exam'
          AND source_exam.id = source_mi.item_id
          AND source_exam.remedial_exam_id = remedial_exam.id
         WHERE remedial_mi.module_id = ? AND remedial_mi.item_type = 'exam'
         ORDER BY remedial_mi.sequence_order ASC`,
        [context.parent_session_id, context.module_id],
    );
    return rows;
}

export async function findNextRemedialSession(
    connection: PoolConnection,
    rootSessionId: string,
    currentCycle: number,
    sourceExamId: string,
): Promise<{ session_id: string; module_item_id: string; start_time: string | Date; end_time: string | Date } | null> {
    const [rows] = await connection.execute<Array<RowDataPacket & {
        session_id: string;
        module_item_id: string;
        start_time: string | Date;
        end_time: string | Date;
    }>>(
        `SELECT rs.id AS session_id, rmi.id AS module_item_id, rs.start_time, rs.end_time
         FROM sessions rs
         JOIN module_items rmi ON rmi.module_id = rs.module_id AND rmi.item_type = 'exam'
         JOIN exams remedial_exam ON remedial_exam.id = rmi.item_id
         JOIN exams source_exam ON source_exam.id = ? AND source_exam.remedial_exam_id = remedial_exam.id
         WHERE rs.session_type = 'remedial'
           AND rs.parent_session_id = ?
           AND rs.remedial_cycle > ?
         ORDER BY rs.remedial_cycle ASC, rs.start_time ASC
         LIMIT 1`,
        [sourceExamId, rootSessionId, currentCycle],
    );
    return rows[0] || null;
}

export async function validateRemedialSessionConfiguration(
    connection: PoolConnection,
    input: {
        parentSessionId: string;
        moduleId: string;
        remedialCycle: number;
        excludeSessionId?: string;
    },
): Promise<string | null> {
    const [parentRows] = await connection.execute<Array<RowDataPacket & { session_type: string }>>(
        `SELECT session_type FROM sessions WHERE id = ? LIMIT 1`,
        [input.parentSessionId],
    );
    if (!parentRows.length || parentRows[0].session_type !== 'regular') {
        return 'Sesi induk remedial harus berupa sesi reguler yang valid';
    }

    const [mappingRows] = await connection.execute<Array<RowDataPacket & {
        module_item_id: string;
        source_count: number | string;
    }>>(
        `SELECT remedial_mi.id AS module_item_id, COUNT(source_exam.id) AS source_count
         FROM module_items remedial_mi
         JOIN exams remedial_exam ON remedial_exam.id = remedial_mi.item_id
         LEFT JOIN sessions parent ON parent.id = ?
         LEFT JOIN module_items source_mi
           ON source_mi.module_id = parent.module_id AND source_mi.item_type = 'exam'
         LEFT JOIN exams source_exam
           ON source_exam.id = source_mi.item_id
          AND source_exam.remedial_exam_id = remedial_exam.id
         WHERE remedial_mi.module_id = ? AND remedial_mi.item_type = 'exam'
         GROUP BY remedial_mi.id`,
        [input.parentSessionId, input.moduleId],
    );
    if (!mappingRows.length) {
        return 'Modul remedial harus memiliki minimal satu exam';
    }
    if (mappingRows.some((row) => Number(row.source_count) !== 1)) {
        return 'Setiap exam dalam modul remedial harus dipetakan tepat ke satu exam pada sesi induk melalui konfigurasi Remedial Exam';
    }

    const duplicateParams: Array<string | number> = [input.parentSessionId, input.remedialCycle];
    let duplicateWhere = '';
    if (input.excludeSessionId) {
        duplicateWhere = ' AND id <> ?';
        duplicateParams.push(input.excludeSessionId);
    }
    const [duplicateRows] = await connection.execute<Array<RowDataPacket & { id: string }>>(
        `SELECT id FROM sessions
         WHERE parent_session_id = ? AND remedial_cycle = ?${duplicateWhere}
         LIMIT 1`,
        duplicateParams,
    );
    if (duplicateRows.length) {
        return `Siklus remedial ${input.remedialCycle} sudah digunakan untuk sesi induk ini`;
    }

    return null;
}
