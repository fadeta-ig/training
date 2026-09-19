import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { executeQuery } from '@/lib/db';
import pool from '@/lib/db';
import { sessionSchema } from '@/lib/validations/sessionSchema';
import { withAuth } from '@/lib/api-auth';
import logger from '@/lib/logger';
import { normalizeDbDateToIso, toMysqlDatetimeWib } from '@/lib/timezone';
import { pickHighestAttempt, validateRemedialSessionConfiguration } from '@/lib/exam-results';

// GET Detail Sesi & Peserta + Progress Monitoring
async function handleGet(
    request: NextRequest,
    _user: any,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const resolvedParams = await context.params;
        const result = await executeQuery<any[]>(
            `SELECT id, module_id, title, start_time, end_time, session_type, parent_session_id,
                    remedial_cycle, result_state, result_published_at, result_publication_version,
                    require_seb, show_score, enable_proctoring, seb_config_key, created_at
             FROM sessions WHERE id = ?`,
            [resolvedParams.id]
        );

        if (!result || result.length === 0) {
            return NextResponse.json({ success: false, error: 'Session not found' }, { status: 404 });
        }

        const session = result[0];

        // Fetch module items with titles & metadata from trainings and exams
        const moduleItems = await executeQuery<any[]>(
            `SELECT 
                mi.id, 
                mi.item_type, 
                mi.item_id,
                mi.sequence_order,
                CASE mi.item_type
                    WHEN 'training' THEN t.title
                    WHEN 'exam' THEN e.title
                END AS title,
                CASE mi.item_type
                    WHEN 'exam' THEN e.duration_minutes
                    ELSE NULL
                END AS duration,
                CASE mi.item_type
                    WHEN 'exam' THEN e.passing_grade
                    ELSE NULL
                END AS passing_score,
                CASE mi.item_type
                    WHEN 'exam' THEN e.allow_remedial
                    ELSE FALSE
                END AS allow_remedial,
                CASE mi.item_type
                    WHEN 'exam' THEN e.remedial_exam_id
                    ELSE NULL
                END AS remedial_exam_id
             FROM module_items mi
             LEFT JOIN trainings t ON mi.item_type = 'training' AND mi.item_id = t.id
             LEFT JOIN exams e ON mi.item_type = 'exam' AND mi.item_id = e.id
             WHERE mi.module_id = ? 
             ORDER BY mi.sequence_order ASC`,
            [session.module_id]
        );
        const assignmentRows = session.session_type === 'remedial'
            ? await executeQuery<any[]>(
                `SELECT user_id, module_item_id
                 FROM session_participant_exam_assignments
                 WHERE session_id = ?`,
                [resolvedParams.id],
            )
            : [];
        const assignedItemsByUser = new Map<string, Set<string>>();
        for (const assignment of assignmentRows) {
            const assigned = assignedItemsByUser.get(assignment.user_id) || new Set<string>();
            assigned.add(assignment.module_item_id);
            assignedItemsByUser.set(assignment.user_id, assigned);
        }

        // Fetch all progress records for this session to determine real-time participant activity
        const progressRows = await executeQuery<any[]>(
            `SELECT 
                up.user_id,
                up.module_item_id,
                up.status AS item_status,
                up.updated_at,
                up.last_attempt_start,
                mi.item_type,
                mi.sequence_order,
                CASE mi.item_type
                    WHEN 'training' THEN t.title
                    WHEN 'exam' THEN e.title
                END AS item_title
             FROM user_progress up
             JOIN module_items mi ON mi.id = up.module_item_id
             LEFT JOIN trainings t ON mi.item_type = 'training' AND mi.item_id = t.id
             LEFT JOIN exams e ON mi.item_type = 'exam' AND mi.item_id = e.id
             WHERE up.session_id = ?
             ORDER BY up.updated_at DESC`,
            [resolvedParams.id]
        );

        const progressByUser = new Map<string, any[]>();
        for (const pr of progressRows || []) {
            if (!progressByUser.has(pr.user_id)) {
                progressByUser.set(pr.user_id, []);
            }
            progressByUser.get(pr.user_id)!.push(pr);
        }

        // Fetch participants with progress, NIP, graduation verdict, SKL & certificates
        const participants = await executeQuery<any[]>(
            `SELECT sp.id AS session_participant_id,
                    sp.user_id, u.username, u.full_name,
                    p.nip, p.id_card_number, p.institution, p.batch,
                    sp.graduation_status,
                    sp.graduation_decided_at,
                    sp.graduation_notes,
                    sp.skl_number,
                    sp.skl_generated_at,
                    sp.certificate_file_url,
                    sp.certificate_number,
                    sp.certificate_uploaded_at,
                    COUNT(DISTINCT CASE WHEN up.status = 'completed' THEN up.id END) AS completed_items,
                    AVG(CASE WHEN mi.item_type = 'exam' AND up.score IS NOT NULL THEN up.score END) AS exam_avg_score,
                    MAX(CASE WHEN mi.item_type = 'exam' AND up.score IS NOT NULL THEN up.score END) AS exam_max_score,
                    MAX(CASE WHEN mi.item_type = 'exam' AND up.score IS NOT NULL THEN COALESCE(up.original_score, up.score) END) AS exam_original_score,
                    MAX(CASE WHEN mi.item_type = 'exam' AND up.score IS NOT NULL THEN up.score_adjustment END) AS exam_score_adjustment,
                    MAX(CASE WHEN mi.item_type = 'exam' AND up.score IS NOT NULL THEN up.adjustment_reason END) AS exam_adjustment_reason,
                    MAX(CASE WHEN mi.item_type = 'exam' AND up.score IS NOT NULL THEN up.adjusted_at END) AS exam_adjusted_at,
                    MAX(CASE WHEN mi.item_type = 'exam' AND up.score IS NOT NULL THEN up.module_item_id END) AS exam_module_item_id
             FROM session_participants sp
             JOIN users u ON sp.user_id = u.id
             LEFT JOIN participant_profiles p ON sp.user_id = p.user_id
             LEFT JOIN user_progress up ON up.user_id = sp.user_id AND up.session_id = sp.session_id
             LEFT JOIN module_items mi ON mi.id = up.module_item_id
             WHERE sp.session_id = ?
             GROUP BY sp.id, sp.user_id, u.username, u.full_name, p.nip, p.id_card_number, p.institution, p.batch,
                      sp.graduation_status, sp.graduation_decided_at, sp.graduation_notes,
                      sp.skl_number, sp.skl_generated_at, sp.certificate_file_url,
                      sp.certificate_number, sp.certificate_uploaded_at
             ORDER BY completed_items DESC, u.full_name ASC`,
            [resolvedParams.id]
        );

        const participantsWithDetail = participants.map(p => {
            const userItems = progressByUser.get(p.user_id) || [];
            const openItem = userItems.find(ui => ui.item_status === 'open');
            const assignedExamItems = assignedItemsByUser.get(p.user_id) || new Set<string>();
            const participantModuleItems = session.session_type === 'remedial'
                ? (moduleItems || []).filter((item: any) => item.item_type === 'training' || assignedExamItems.has(item.id))
                : (moduleItems || []);
            const participantItemIds = new Set<string>(participantModuleItems.map((item: any) => item.id));
            const participantTotalItems = participantModuleItems.length;
            const completedCount = userItems.filter(
                (item: any) => item.item_status === 'completed' && participantItemIds.has(item.module_item_id),
            ).length;

            let currentActivity = {
                type: 'not_started' as 'exam' | 'training' | 'completed' | 'in_between' | 'not_started',
                title: null as string | null,
                item_type: null as 'exam' | 'training' | null,
                label: 'Belum Memulai',
                last_activity_at: null as string | null,
            };

            if (openItem) {
                const isExam = openItem.item_type === 'exam';
                currentActivity = {
                    type: isExam ? 'exam' : 'training',
                    title: openItem.item_title,
                    item_type: openItem.item_type,
                    label: isExam ? 'Sedang Mengerjakan Ujian' : 'Sedang Membuka Materi',
                    last_activity_at: openItem.updated_at || openItem.last_attempt_start || null,
                };
            } else if (participantTotalItems > 0 && completedCount >= participantTotalItems) {
                currentActivity = {
                    type: 'completed',
                    title: null,
                    item_type: null,
                    label: 'Selesai Semua Modul',
                    last_activity_at: userItems[0]?.updated_at || null,
                };
            } else if (completedCount > 0) {
                const nextItem = participantModuleItems.find((mi: any) => !userItems.some((ui: any) => ui.module_item_id === mi.id && ui.item_status === 'completed'));
                currentActivity = {
                    type: 'in_between',
                    title: nextItem?.title || null,
                    item_type: nextItem?.item_type || null,
                    label: nextItem ? `Menunggu Melanjutkan: ${nextItem.title}` : 'Selesai Sebagian',
                    last_activity_at: userItems[0]?.updated_at || null,
                };
            }

            return {
                id: p.user_id,
                session_participant_id: p.session_participant_id,
                username: p.username,
                full_name: p.full_name || p.username,
                id_card_number: p.id_card_number || null,
                nip: p.nip || null,
                institution: p.institution || null,
                batch: p.batch || '1',
                completed_items: completedCount,
                total_items: participantTotalItems,
                progress: participantTotalItems > 0 ? Math.round((completedCount / participantTotalItems) * 100) : 0,
                current_activity: currentActivity,
                graduation_status: p.graduation_status || 'pending',
                graduation_decided_at: p.graduation_decided_at || null,
                graduation_notes: p.graduation_notes || null,
                skl_number: p.skl_number || null,
                skl_generated_at: p.skl_generated_at || null,
                certificate_file_url: p.certificate_file_url || null,
                certificate_number: p.certificate_number || null,
                certificate_uploaded_at: p.certificate_uploaded_at || null,
                final_score: p.exam_max_score !== null && p.exam_max_score !== undefined ? Number(p.exam_max_score) : null,
                original_score: p.exam_original_score !== null && p.exam_original_score !== undefined
                    ? Number(p.exam_original_score)
                    : (p.exam_max_score !== null && p.exam_max_score !== undefined ? Number(p.exam_max_score) : null),
                score_adjustment: p.exam_score_adjustment !== null && p.exam_score_adjustment !== undefined
                    ? Number(p.exam_score_adjustment)
                    : 0,
                adjustment_reason: p.exam_adjustment_reason || null,
                adjusted_at: p.exam_adjusted_at || null,
                exam_module_item_id: p.exam_module_item_id || null,
                avg_score: p.exam_avg_score !== null && p.exam_avg_score !== undefined ? Number(p.exam_avg_score) : null,
                exam_results: [] as any[],
                evaluation_status: 'draft' as 'draft' | 'grading_pending' | 'remedial_required' | 'remedial_exhausted' | 'ready_for_graduation',
            };
        });

        const rootSessionId = session.session_type === 'remedial' && session.parent_session_id
            ? session.parent_session_id
            : session.id;
        const sourceExamItems = session.session_type === 'remedial' && session.parent_session_id
            ? await executeQuery<any[]>(
                `SELECT mi.id AS module_item_id, e.id AS exam_id, e.title,
                        e.passing_grade, e.allow_remedial, e.remedial_exam_id,
                        mi.sequence_order
                 FROM sessions root
                 JOIN module_items mi ON mi.module_id = root.module_id AND mi.item_type = 'exam'
                 JOIN exams e ON e.id = mi.item_id
                 WHERE root.id = ?
                 ORDER BY mi.sequence_order ASC`,
                [rootSessionId],
            )
            : (moduleItems || [])
                .filter((item: any) => item.item_type === 'exam')
                .map((item: any) => ({
                    module_item_id: item.id,
                    exam_id: item.item_id,
                    title: item.title,
                    passing_grade: item.passing_score,
                    allow_remedial: item.allow_remedial,
                    remedial_exam_id: item.remedial_exam_id,
                    sequence_order: item.sequence_order,
                }));

        const publicationRows = await executeQuery<any[]>(
            `SELECT id, version, session_id, published_at
             FROM session_result_publications
             WHERE root_session_id = ? AND status = 'active'
             ORDER BY version DESC LIMIT 1`,
            [rootSessionId],
        );
        const activePublication = publicationRows?.[0] || null;
        const publicationItems = activePublication
            ? await executeQuery<any[]>(
                `SELECT user_id, source_exam_id, best_attempt_result_id, best_score,
                        passing_grade, outcome, remedial_session_id, attempts_used
                 FROM session_result_publication_items
                 WHERE publication_id = ?`,
                [activePublication.id],
            )
            : [];
        const attemptResults = await executeQuery<any[]>(
            `SELECT id, session_id, user_id, module_item_id, exam_id, source_exam_id,
                    attempt_number, original_score, score_adjustment, final_score,
                    adjustment_reason, adjusted_at, grading_pending, completed_at
             FROM exam_attempt_results
             WHERE root_session_id = ?
             ORDER BY final_score DESC, attempt_number DESC`,
            [rootSessionId],
        );
        const attemptsByKey = new Map<string, any[]>();
        for (const attempt of attemptResults || []) {
            const key = `${attempt.user_id}:${attempt.source_exam_id}`;
            const values = attemptsByKey.get(key) || [];
            values.push(attempt);
            attemptsByKey.set(key, values);
        }
        const publicationByKey = new Map<string, any>();
        for (const item of publicationItems || []) {
            publicationByKey.set(`${item.user_id}:${item.source_exam_id}`, item);
        }
        const moduleItemBySourceExam = new Map<string, string>();
        for (const exam of sourceExamItems || []) {
            if (session.session_type === 'remedial') {
                const remedialItem = (moduleItems || []).find(
                    (item: any) => item.item_type === 'exam' && item.item_id === (exam.remedial_exam_id || exam.source_exam_id || exam.exam_id),
                );
                if (remedialItem) moduleItemBySourceExam.set(exam.exam_id, remedialItem.id);
            } else {
                moduleItemBySourceExam.set(exam.exam_id, exam.module_item_id);
            }
        }

        for (const participant of participantsWithDetail) {
            const examResults = (sourceExamItems || []).map((exam: any) => {
                const key = `${participant.id}:${exam.exam_id}`;
                const examAttempts = attemptsByKey.get(key) || [];
                const bestAttempt = pickHighestAttempt(
                    examAttempts.filter((attempt: any) => !Boolean(attempt.grading_pending)),
                );
                const hasPending = examAttempts.some((attempt: any) => Boolean(attempt.grading_pending));
                const published = publicationByKey.get(key) || null;
                const finalScore = published?.best_score !== null && published?.best_score !== undefined
                    ? Number(published.best_score)
                    : bestAttempt?.final_score !== null && bestAttempt?.final_score !== undefined
                        ? Number(bestAttempt.final_score)
                        : null;
                return {
                    source_exam_id: exam.exam_id,
                    exam_title: exam.title,
                    module_item_id: session.session_type === 'remedial'
                        ? moduleItemBySourceExam.get(exam.exam_id) || null
                        : exam.module_item_id,
                    final_score: finalScore,
                    original_score: bestAttempt?.original_score !== null && bestAttempt?.original_score !== undefined
                        ? Number(bestAttempt.original_score)
                        : finalScore,
                    score_adjustment: Number(bestAttempt?.score_adjustment || 0),
                    adjustment_reason: bestAttempt?.adjustment_reason || null,
                    adjusted_at: bestAttempt?.adjusted_at || null,
                    passing_grade: Number(published?.passing_grade ?? exam.passing_grade ?? 0),
                    outcome: published?.outcome || (hasPending ? 'grading_pending' : 'draft'),
                    remedial_session_id: published?.remedial_session_id || null,
                    attempts_count: examAttempts.filter((attempt: any) => !Boolean(attempt.grading_pending)).length,
                    grading_pending: hasPending,
                    published: Boolean(published),
                };
            });
            const outcomes = examResults.map((result: any) => result.outcome);
            participant.exam_results = examResults;
            participant.evaluation_status = outcomes.includes('grading_pending')
                ? 'grading_pending'
                : !activePublication
                    ? 'draft'
                    : outcomes.includes('remedial_required')
                        ? 'remedial_required'
                        : outcomes.some((outcome: string) => outcome === 'remedial_exhausted' || outcome === 'absent')
                            ? 'remedial_exhausted'
                            : outcomes.length > 0 && outcomes.every((outcome: string) => outcome === 'passed')
                                ? 'ready_for_graduation'
                                : 'draft';
            const numericScores = examResults
                .map((result: any) => result.final_score)
                .filter((score: number | null) => score !== null) as number[];
            participant.final_score = numericScores.length > 0 ? Math.min(...numericScores) : null;
            participant.exam_module_item_id = examResults.length === 1 ? examResults[0].module_item_id : null;
        }

        return NextResponse.json({
            success: true,
            data: {
                ...session,
                start_time: normalizeDbDateToIso(session.start_time),
                end_time: normalizeDbDateToIso(session.end_time),
                require_seb: Boolean(session.require_seb),
                show_score: session.show_score === 1 || session.show_score === true || session.show_score === '1',
                enable_proctoring: session.enable_proctoring === 1 || session.enable_proctoring === true || session.enable_proctoring === '1',
                total_items: moduleItems?.length || 0,
                module_items: moduleItems,
                publication: activePublication ? {
                    id: activePublication.id,
                    version: Number(activePublication.version),
                    session_id: activePublication.session_id,
                    published_at: normalizeDbDateToIso(activePublication.published_at),
                } : null,
                participants: participantsWithDetail,
            }
        });
    } catch (error) {
        logger.error('GET_SESSION_DETAIL', 'Gagal memuat detail sesi', error);
        const message = error instanceof Error ? error.message : 'Internal Server Error';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

// PUT Update Sesi & Sinkronisasi Peserta
async function handlePut(
    request: NextRequest,
    _user: any,
    context: { params: Promise<{ id: string }> }
) {
    let connection;
    try {
        const resolvedParams = await context.params;
        const body = await request.json();
        const parsed = sessionSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { success: false, error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
                { status: 400 }
            );
        }

        const {
            module_id, title, start_time, end_time, session_type, parent_session_id,
            remedial_cycle, require_seb, enable_proctoring, participant_ids,
        } = parsed.data;

        connection = await pool.getConnection();
        await connection.beginTransaction();

        const [currentSessions] = await connection.execute<any[]>(
            `SELECT module_id, session_type, parent_session_id, remedial_cycle,
                    require_seb, show_score, enable_proctoring, seb_config_key
             FROM sessions
             WHERE id = ?
             LIMIT 1
             FOR UPDATE`,
            [resolvedParams.id],
        );
        const currentSession = currentSessions[0];
        if (!currentSession) {
            await connection.rollback();
            connection.release();
            connection = undefined;
            return NextResponse.json({ success: false, error: 'Session not found' }, { status: 404 });
        }

        const changesWorkflowIdentity = String(currentSession.module_id) !== module_id
            || String(currentSession.session_type || 'regular') !== session_type
            || String(currentSession.parent_session_id || '') !== String(session_type === 'remedial' ? parent_session_id || '' : '')
            || Number(currentSession.remedial_cycle || 0) !== Number(session_type === 'remedial' ? remedial_cycle : 0);
        if (changesWorkflowIdentity) {
            const [activityRows] = await connection.execute<Array<{ total: number | string }> & any[]>(
                `SELECT (
                    (SELECT COUNT(*) FROM user_progress WHERE session_id = ?)
                    + (SELECT COUNT(*) FROM exam_answers WHERE session_id = ?)
                    + (SELECT COUNT(*) FROM exam_answer_drafts WHERE session_id = ?)
                    + (SELECT COUNT(*) FROM proctor_snapshots WHERE session_id = ?)
                    + (SELECT COUNT(*) FROM session_participants WHERE session_id = ?)
                ) AS total`,
                [resolvedParams.id, resolvedParams.id, resolvedParams.id, resolvedParams.id, resolvedParams.id],
            );
            if (Number(activityRows[0]?.total || 0) > 0) {
                await connection.rollback();
                connection.release();
                connection = undefined;
                return NextResponse.json(
                    { success: false, error: 'Modul atau relasi remedial tidak dapat diganti setelah ada progres, jawaban, draft, proctoring, atau dokumen resmi peserta' },
                    { status: 409 },
                );
            }
        }
        if (session_type === 'remedial') {
            const configurationError = await validateRemedialSessionConfiguration(connection, {
                parentSessionId: parent_session_id!,
                moduleId: module_id,
                remedialCycle: remedial_cycle,
                excludeSessionId: resolvedParams.id,
            });
            if (configurationError) {
                await connection.rollback();
                connection.release();
                connection = undefined;
                return NextResponse.json({ success: false, error: configurationError }, { status: 409 });
            }
        }
        const keepsSameSebConfig = Boolean(require_seb)
            && Boolean(currentSession?.require_seb)
            && Boolean(enable_proctoring) === Boolean(currentSession?.enable_proctoring);
        // Participant/time/title edits do not alter the generated plist. Preserve
        // its key so an admin operation during a live exam cannot lock everyone out.
        const sebConfigKey = keepsSameSebConfig ? currentSession?.seb_config_key || null : null;

        // Update session with normalized WIB timestamps and strict boolean flags
        await connection.execute(
            `UPDATE sessions
             SET module_id = ?, title = ?, start_time = ?, end_time = ?,
                 session_type = ?, parent_session_id = ?, remedial_cycle = ?,
                 require_seb = ?, enable_proctoring = ?, seb_config_key = ?
             WHERE id = ?`,
            [
                module_id,
                title,
                toMysqlDatetimeWib(start_time),
                toMysqlDatetimeWib(end_time),
                session_type,
                session_type === 'remedial' ? parent_session_id : null,
                session_type === 'remedial' ? remedial_cycle : 0,
                Boolean(require_seb),
                Boolean(enable_proctoring),
                sebConfigKey,
                resolvedParams.id
            ]
        );

        // Remedial enrollment and exam assignment are generated from a published
        // result snapshot. Manual participant synchronization applies to regular sessions only.
        if (session_type === 'regular') {
        // Diff-based synchronization: Preserves graduation_status, SKL, & certificate records
        const [existingRows] = await connection.execute<any[]>(
            `SELECT user_id FROM session_participants WHERE session_id = ?`,
            [resolvedParams.id]
        );
        const existingUserIds = new Set<string>((existingRows || []).map((r: any) => String(r.user_id)));
        const targetUserIds = new Set<string>((participant_ids || []).map((id: string) => String(id)));

        // Remove participants that were unselected
        const userIdsToRemove = Array.from(existingUserIds).filter(id => !targetUserIds.has(id));
        if (userIdsToRemove.length > 0) {
            const placeholders = userIdsToRemove.map(() => '?').join(',');
            const [activityRows] = await connection.execute<Array<{ user_id: string }> & any[]>(
                `SELECT DISTINCT user_id FROM (
                    SELECT user_id FROM user_progress WHERE session_id = ? AND user_id IN (${placeholders})
                    UNION ALL
                    SELECT user_id FROM exam_answers WHERE session_id = ? AND user_id IN (${placeholders})
                    UNION ALL
                    SELECT user_id FROM exam_answer_drafts WHERE session_id = ? AND user_id IN (${placeholders})
                    UNION ALL
                    SELECT user_id FROM proctor_snapshots WHERE session_id = ? AND user_id IN (${placeholders})
                    UNION ALL
                    SELECT user_id FROM session_participants
                    WHERE session_id = ? AND user_id IN (${placeholders})
                      AND (graduation_status <> 'pending' OR skl_number IS NOT NULL OR certificate_file_url IS NOT NULL)
                ) activity`,
                [
                    resolvedParams.id, ...userIdsToRemove,
                    resolvedParams.id, ...userIdsToRemove,
                    resolvedParams.id, ...userIdsToRemove,
                    resolvedParams.id, ...userIdsToRemove,
                    resolvedParams.id, ...userIdsToRemove,
                ],
            );
            if (activityRows.length > 0) {
                await connection.rollback();
                connection.release();
                connection = undefined;
                return NextResponse.json(
                    {
                        success: false,
                        error: 'Peserta yang sudah memiliki progres, jawaban, draft, proctoring, kelulusan, atau dokumen tidak dapat dikeluarkan dari sesi',
                        participant_ids: activityRows.map((row) => row.user_id),
                    },
                    { status: 409 },
                );
            }
            await connection.execute(
                `DELETE FROM session_participants WHERE session_id = ? AND user_id IN (${placeholders})`,
                [resolvedParams.id, ...userIdsToRemove]
            );
        }

        // Add newly selected participants
        const userIdsToAdd = Array.from(targetUserIds).filter(id => !existingUserIds.has(id));
        for (const userId of userIdsToAdd) {
            const participantId = uuidv4();
            await connection.execute(
                `INSERT INTO session_participants (id, session_id, user_id) VALUES (?, ?, ?)`,
                [participantId, resolvedParams.id, userId]
            );
        }
        }

        await connection.commit();
        connection.release();
        connection = undefined;

        return NextResponse.json({ success: true, message: 'Session updated completely' });
    } catch (error) {
        if (connection) {
            await connection.rollback();
            connection.release();
        }
        logger.error('UPDATE_SESSION', 'Gagal memperbarui sesi', error);
        const message = error instanceof Error ? error.message : 'Internal Server Error';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

// DELETE Sesi
async function handleDelete(
    request: NextRequest,
    _user: any,
    context: { params: Promise<{ id: string }> }
) {
    let connection;
    try {
        const resolvedParams = await context.params;

        connection = await pool.getConnection();
        await connection.beginTransaction();
        const [usageRows] = await connection.execute<Array<{ total: number | string }> & any[]>(
            `SELECT (
                (SELECT COUNT(*) FROM user_progress WHERE session_id = ?)
                + (SELECT COUNT(*) FROM exam_answers WHERE session_id = ?)
                + (SELECT COUNT(*) FROM exam_answer_drafts WHERE session_id = ?)
                + (SELECT COUNT(*) FROM proctor_snapshots WHERE session_id = ?)
                + (SELECT COUNT(*) FROM session_participants
                   WHERE session_id = ?
                     AND (graduation_status <> 'pending' OR skl_number IS NOT NULL OR certificate_file_url IS NOT NULL))
            ) AS total`,
            [resolvedParams.id, resolvedParams.id, resolvedParams.id, resolvedParams.id, resolvedParams.id],
        );
        if (Number(usageRows[0]?.total || 0) > 0) {
            await connection.rollback();
            connection.release();
            connection = undefined;
            return NextResponse.json(
                { success: false, error: 'Sesi yang memiliki aktivitas peserta, jawaban, proctoring, kelulusan, atau dokumen resmi tidak dapat dihapus' },
                { status: 409 },
            );
        }
        const [result] = await connection.execute<any>('DELETE FROM sessions WHERE id = ?', [resolvedParams.id]);

        if (result && 'affectedRows' in result && result.affectedRows === 0) {
            await connection.rollback();
            connection.release();
            connection = undefined;
            return NextResponse.json({ success: false, error: 'Session not found' }, { status: 404 });
        }

        await connection.commit();
        connection.release();
        connection = undefined;

        return NextResponse.json({ success: true, message: 'Session deleted' });
    } catch (error) {
        if (connection) {
            await connection.rollback();
            connection.release();
        }
        logger.error('DELETE_SESSION', 'Gagal menghapus sesi', error);
        return NextResponse.json({ success: false, error: 'Gagal menghapus sesi' }, { status: 500 });
    }
}

export const GET = withAuth(handleGet, { allowedRoles: ['admin', 'trainer'] });
export const PUT = withAuth(handlePut, { allowedRoles: ['admin'] });
export const DELETE = withAuth(handleDelete, { allowedRoles: ['admin'] });
