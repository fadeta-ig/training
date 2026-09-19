import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import pool from '@/lib/db';
import { withAuth, type AuthenticatedUser } from '@/lib/api-auth';
import { logActivity } from '@/lib/audit';
import logger from '@/lib/logger';
import {
    classifyPublishedOutcome,
    findNextRemedialSession,
    getSessionExamMappings,
    getSessionResultContext,
    pickHighestAttempt,
    type ResultOutcome,
} from '@/lib/exam-results';

const publishSchema = z.object({
    confirm: z.literal(true),
    mark_missing_absent: z.boolean().default(false),
});

interface ParticipantRow extends RowDataPacket {
    user_id: string;
    full_name: string | null;
    username: string;
}

interface AttemptRow extends RowDataPacket {
    id: string;
    session_id: string;
    user_id: string;
    source_exam_id: string;
    final_score: number | string | null;
    attempt_number: number | string;
    grading_pending: number | boolean;
    completed_at: string | Date | null;
}

interface PreviewItem {
    user_id: string;
    participant_name: string;
    source_exam_id: string;
    exam_title: string;
    best_attempt_result_id: string | null;
    best_score: number | null;
    passing_grade: number;
    attempts_used: number;
    outcome: ResultOutcome;
    remedial_session_id: string | null;
    remedial_module_item_id: string | null;
    grading_pending: boolean;
    current_cycle_complete: boolean;
}

async function buildPreview(
    connection: PoolConnection,
    sessionId: string,
    markMissingAbsent: boolean,
) {
    const context = await getSessionResultContext(connection, sessionId, false);
    if (!context) throw Object.assign(new Error('Sesi tidak ditemukan'), { statusCode: 404 });

    const rootContext = context.root_session_id === context.id
        ? context
        : await getSessionResultContext(connection, context.root_session_id, false);
    if (!rootContext) throw Object.assign(new Error('Sesi induk tidak ditemukan'), { statusCode: 409 });

    const mappings = await getSessionExamMappings(connection, rootContext);
    if (mappings.length === 0) {
        throw Object.assign(new Error('Sesi tidak memiliki exam yang dapat dipublikasikan'), { statusCode: 409 });
    }

    const [participants] = await connection.execute<ParticipantRow[]>(
        `SELECT sp.user_id, u.full_name, u.username
         FROM session_participants sp
         JOIN users u ON u.id = sp.user_id
         WHERE sp.session_id = ?
         ORDER BY u.full_name ASC, u.username ASC`,
        [context.root_session_id],
    );

    const [attempts] = await connection.execute<AttemptRow[]>(
        `SELECT id, session_id, user_id, source_exam_id, final_score, attempt_number,
                grading_pending, completed_at
         FROM exam_attempt_results
         WHERE root_session_id = ?
         ORDER BY user_id, source_exam_id, final_score DESC, attempt_number DESC`,
        [context.root_session_id],
    );

    const attemptsByKey = new Map<string, AttemptRow[]>();
    for (const attempt of attempts) {
        const key = `${attempt.user_id}:${attempt.source_exam_id}`;
        const list = attemptsByKey.get(key) || [];
        list.push(attempt);
        attemptsByKey.set(key, list);
    }
    const requiredCurrentCycleKeys = new Set<string>();
    if (context.session_type === 'remedial') {
        const [assignmentRows] = await connection.execute<Array<RowDataPacket & { user_id: string; source_exam_id: string }>>(
            `SELECT user_id, source_exam_id
             FROM session_participant_exam_assignments
             WHERE session_id = ?`,
            [context.id],
        );
        for (const assignment of assignmentRows) {
            requiredCurrentCycleKeys.add(`${assignment.user_id}:${assignment.source_exam_id}`);
        }
    }

    const nextRemedialByExam = new Map<string, Awaited<ReturnType<typeof findNextRemedialSession>>>();
    for (const mapping of mappings) {
        if (nextRemedialByExam.has(mapping.source_exam_id)) continue;
        const next = Boolean(mapping.allow_remedial)
            ? await findNextRemedialSession(
                connection,
                context.root_session_id,
                Number(context.remedial_cycle || 0),
                mapping.source_exam_id,
            )
            : null;
        nextRemedialByExam.set(mapping.source_exam_id, next);
    }

    const items: PreviewItem[] = [];
    for (const participant of participants) {
        for (const mapping of mappings) {
            const key = `${participant.user_id}:${mapping.source_exam_id}`;
            const examAttempts = attemptsByKey.get(key) || [];
            const gradingPending = examAttempts.some((attempt) => Boolean(attempt.grading_pending));
            const completedAttempts = examAttempts.filter((attempt) => !Boolean(attempt.grading_pending));
            const best = pickHighestAttempt(completedAttempts);
            const bestScore = best?.final_score === null || best?.final_score === undefined
                ? null
                : Number(best.final_score);
            const currentCycleComplete = !requiredCurrentCycleKeys.has(key)
                || (bestScore !== null && bestScore >= Number(mapping.passing_grade))
                || examAttempts.some((attempt) => attempt.session_id === context.id
                    && !Boolean(attempt.grading_pending)
                    && attempt.final_score !== null
                    && attempt.final_score !== undefined);
            const nextRemedial = nextRemedialByExam.get(mapping.source_exam_id) || null;
            const outcome = classifyPublishedOutcome({
                bestScore,
                passingGrade: Number(mapping.passing_grade),
                hasNextRemedialSession: Boolean(mapping.allow_remedial) && Boolean(nextRemedial),
            });

            items.push({
                user_id: participant.user_id,
                participant_name: participant.full_name || participant.username,
                source_exam_id: mapping.source_exam_id,
                exam_title: mapping.source_exam_title,
                best_attempt_result_id: best?.id || null,
                best_score: bestScore,
                passing_grade: Number(mapping.passing_grade),
                attempts_used: completedAttempts.length,
                outcome,
                remedial_session_id: outcome === 'remedial_required' ? nextRemedial?.session_id || null : null,
                remedial_module_item_id: outcome === 'remedial_required' ? nextRemedial?.module_item_id || null : null,
                grading_pending: gradingPending,
                current_cycle_complete: currentCycleComplete,
            });
        }
    }

    const pendingItems = items.filter((item) => item.grading_pending);
    const missingItems = items.filter((item) => !item.grading_pending && item.best_score === null);
    const incompleteCurrentCycleItems = items.filter(
        (item) => !item.grading_pending && !item.current_cycle_complete,
    );
    const effectiveBlockers = [
        ...pendingItems.map((item) => ({ ...item, reason: 'grading_pending' as const })),
        ...(!markMissingAbsent
            ? missingItems.map((item) => ({ ...item, reason: 'missing_score' as const }))
            : []),
        ...incompleteCurrentCycleItems.map((item) => ({ ...item, reason: 'current_cycle_incomplete' as const })),
    ];

    const participantOutcomes = new Map<string, ResultOutcome[]>();
    for (const item of items) {
        const list = participantOutcomes.get(item.user_id) || [];
        list.push(item.outcome);
        participantOutcomes.set(item.user_id, list);
    }

    const counts = {
        participants: participants.length,
        exams: mappings.length,
        passed: items.filter((item) => item.outcome === 'passed').length,
        remedial_required: items.filter((item) => item.outcome === 'remedial_required').length,
        remedial_exhausted: items.filter((item) => item.outcome === 'remedial_exhausted').length,
        absent: missingItems.length,
        grading_pending: pendingItems.length,
        current_cycle_incomplete: incompleteCurrentCycleItems.length,
        remedial_participants: [...participantOutcomes.values()].filter(
            (outcomes) => outcomes.includes('remedial_required'),
        ).length,
        remedial_exhausted_participants: [...participantOutcomes.values()].filter(
            (outcomes) => !outcomes.includes('remedial_required')
                && outcomes.some((outcome) => outcome === 'remedial_exhausted' || outcome === 'absent'),
        ).length,
        ready_for_graduation: [...participantOutcomes.values()].filter(
            (outcomes) => outcomes.length > 0 && outcomes.every((outcome) => outcome === 'passed'),
        ).length,
    };

    return { context, rootContext, mappings, participants, items, blockers: effectiveBlockers, counts };
}

async function handleGet(
    _request: NextRequest,
    _user: AuthenticatedUser,
    context: { params: Promise<{ id: string }> },
) {
    let connection;
    try {
        const { id } = await context.params;
        connection = await pool.getConnection();
        const preview = await buildPreview(connection, id, false);
        return NextResponse.json({
            success: true,
            data: {
                counts: preview.counts,
                blockers: preview.blockers,
                can_publish: preview.blockers.length === 0,
                session_type: preview.context.session_type,
                current_version: Number(preview.rootContext.result_publication_version || 0),
            },
        });
    } catch (error) {
        const status = Number((error as { statusCode?: number })?.statusCode || 500);
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : 'Gagal membuat preview publikasi' },
            { status },
        );
    } finally {
        connection?.release();
    }
}

async function handlePost(
    request: NextRequest,
    authUser: AuthenticatedUser,
    context: { params: Promise<{ id: string }> },
) {
    let connection;
    try {
        const { id: sessionId } = await context.params;
        const parsed = publishSchema.safeParse(await request.json());
        if (!parsed.success) {
            return NextResponse.json({ success: false, error: 'Konfirmasi publikasi tidak valid' }, { status: 400 });
        }

        connection = await pool.getConnection();
        await connection.beginTransaction();

        const lockedContext = await getSessionResultContext(connection, sessionId, true);
        if (!lockedContext) {
            await connection.rollback();
            return NextResponse.json({ success: false, error: 'Sesi tidak ditemukan' }, { status: 404 });
        }
        if (lockedContext.root_session_id !== lockedContext.id) {
            await getSessionResultContext(connection, lockedContext.root_session_id, true);
        }
        if (lockedContext.result_state === 'published') {
            await connection.rollback();
            return NextResponse.json(
                { success: false, error: 'Hasil sesi masih berstatus published. Gunakan Buka Revisi sebelum menerbitkan versi baru.' },
                { status: 409 },
            );
        }

        const preview = await buildPreview(connection, sessionId, parsed.data.mark_missing_absent);
        if (preview.blockers.length > 0) {
            await connection.rollback();
            return NextResponse.json({
                success: false,
                error: 'Hasil sesi belum siap dipublikasikan',
                blockers: preview.blockers,
                counts: preview.counts,
            }, { status: 409 });
        }

        const rootSessionId = preview.context.root_session_id;
        const [versionRows] = await connection.execute<Array<RowDataPacket & { version: number | string }>>(
            `SELECT COALESCE(MAX(version), 0) AS version
             FROM session_result_publications
             WHERE root_session_id = ?`,
            [rootSessionId],
        );
        const version = Number(versionRows[0]?.version || 0) + 1;
        const publicationId = uuidv4();

        await connection.execute(
            `UPDATE session_result_publications
             SET status = 'superseded', superseded_at = UTC_TIMESTAMP()
             WHERE root_session_id = ? AND status = 'active'`,
            [rootSessionId],
        );
        await connection.execute(
            `INSERT INTO session_result_publications
                (id, session_id, root_session_id, version, status, published_by, published_at)
             VALUES (?, ?, ?, ?, 'active', ?, UTC_TIMESTAMP())`,
            [publicationId, sessionId, rootSessionId, version, authUser.id],
        );

        // Rebuild only unstarted future assignments. Historical assignments
        // with progress are retained as an audit trail.
        await connection.execute(
            `DELETE assignment
             FROM session_participant_exam_assignments assignment
             JOIN sessions remedial_session ON remedial_session.id = assignment.session_id
             WHERE remedial_session.parent_session_id = ?
               AND remedial_session.remedial_cycle > ?
               AND NOT EXISTS (
                   SELECT 1 FROM user_progress progress
                   WHERE progress.session_id = assignment.session_id
                     AND progress.user_id = assignment.user_id
                     AND progress.module_item_id = assignment.module_item_id
               )`,
            [rootSessionId, Number(preview.context.remedial_cycle || 0)],
        );
        await connection.execute(
            `DELETE participant
             FROM session_participants participant
             JOIN sessions remedial_session ON remedial_session.id = participant.session_id
             WHERE remedial_session.parent_session_id = ?
               AND remedial_session.remedial_cycle > ?
               AND NOT EXISTS (
                   SELECT 1 FROM session_participant_exam_assignments assignment
                   WHERE assignment.session_id = participant.session_id
                     AND assignment.user_id = participant.user_id
               )
               AND NOT EXISTS (
                   SELECT 1 FROM user_progress progress
                   WHERE progress.session_id = participant.session_id
                     AND progress.user_id = participant.user_id
               )`,
            [rootSessionId, Number(preview.context.remedial_cycle || 0)],
        );

        for (const item of preview.items) {
            await connection.execute(
                `INSERT INTO session_result_publication_items
                    (id, publication_id, user_id, source_exam_id, best_attempt_result_id,
                     best_score, passing_grade, outcome, remedial_session_id, attempts_used)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    uuidv4(), publicationId, item.user_id, item.source_exam_id,
                    item.best_attempt_result_id, item.best_score, item.passing_grade,
                    item.outcome, item.remedial_session_id, item.attempts_used,
                ],
            );

            if (item.outcome === 'remedial_required' && item.remedial_session_id && item.remedial_module_item_id) {
                await connection.execute(
                    `INSERT IGNORE INTO session_participants (id, session_id, user_id)
                     VALUES (?, ?, ?)`,
                    [uuidv4(), item.remedial_session_id, item.user_id],
                );
                await connection.execute(
                    `INSERT IGNORE INTO session_participant_exam_assignments
                        (id, session_id, user_id, module_item_id, source_exam_id)
                     VALUES (?, ?, ?, ?, ?)`,
                    [uuidv4(), item.remedial_session_id, item.user_id, item.remedial_module_item_id, item.source_exam_id],
                );
            }
        }

        const outcomesByUser = new Map<string, PreviewItem[]>();
        for (const item of preview.items) {
            const list = outcomesByUser.get(item.user_id) || [];
            list.push(item);
            outcomesByUser.set(item.user_id, list);
        }
        for (const participant of preview.participants) {
            const outcomes = outcomesByUser.get(participant.user_id) || [];
            const remedialCount = outcomes.filter((item) => item.outcome === 'remedial_required').length;
            const exhaustedCount = outcomes.filter((item) => item.outcome === 'remedial_exhausted' || item.outcome === 'absent').length;
            const allPassed = outcomes.length > 0 && outcomes.every((item) => item.outcome === 'passed');
            const title = remedialCount > 0
                ? 'Hasil ujian: remedial diperlukan'
                : allPassed
                    ? 'Hasil ujian: tidak perlu remedial'
                    : 'Hasil evaluasi telah dipublikasikan';
            const message = remedialCount > 0
                ? `${remedialCount} ujian belum mencapai passing grade. Buka sesi untuk melihat jadwal remedial.`
                : allPassed
                    ? 'Seluruh ujian telah mencapai passing grade. Keputusan kelulusan resmi masih menunggu administrator.'
                    : `${exhaustedCount} ujian belum memenuhi passing grade dan tidak memiliki jadwal remedial lanjutan.`;
            const type = remedialCount > 0 ? 'warning' : allPassed ? 'success' : 'error';
            await connection.execute(
                `INSERT INTO notifications (id, user_id, title, message, type, link_url)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [uuidv4(), participant.user_id, title, message, type, `/dashboard/sesi/${rootSessionId}`],
            );
        }

        await connection.execute(
            `UPDATE sessions
             SET result_state = 'published', result_published_at = UTC_TIMESTAMP(),
                 result_published_by = ?, result_publication_version = ?, show_score = TRUE
             WHERE id IN (?, ?)`,
            [authUser.id, version, sessionId, rootSessionId],
        );

        await connection.commit();
        connection.release();
        connection = undefined;

        await logActivity(authUser.id, 'TOGGLE_SCORE_VISIBILITY', 'sessions', sessionId, {
            action: 'PUBLISH_SESSION_RESULTS',
            rootSessionId,
            publicationId,
            version,
            counts: preview.counts,
        });

        return NextResponse.json({
            success: true,
            message: `Hasil sesi berhasil dipublikasikan sebagai versi ${version}.`,
            data: { publication_id: publicationId, version, counts: preview.counts },
        });
    } catch (error) {
        if (connection) await connection.rollback().catch(() => {});
        logger.error('PUBLISH_SESSION_RESULTS', 'Gagal mempublikasikan hasil sesi', error, authUser.id);
        const status = Number((error as { statusCode?: number })?.statusCode || 500);
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : 'Gagal mempublikasikan hasil sesi' },
            { status },
        );
    } finally {
        connection?.release();
    }
}

export const GET = withAuth(handleGet, { allowedRoles: ['admin', 'trainer'] });
export const POST = withAuth(handlePost, { allowedRoles: ['admin'] });
