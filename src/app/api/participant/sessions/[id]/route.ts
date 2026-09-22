import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import { withAuth, AuthenticatedUser } from '@/lib/api-auth';
import { verifyEnrollment, validateSessionTiming, ParticipantError } from '@/lib/participant-helpers';
import { normalizeDbDateToIso } from '@/lib/timezone';

/**
 * GET /api/participant/sessions/[id]
 * Returns session detail with module items (trainings + exams) for the enrolled trainee.
 */
async function handleGet(
    _request: NextRequest,
    user: AuthenticatedUser,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id: sessionId } = await context.params;

        // Shared helpers handle 404s/403s internally by throwing ParticipantError
        if (user.role === 'trainee') {
            await verifyEnrollment(sessionId, user.id);
        }
        const { session, isActive, isEnded, serverTime } = await validateSessionTiming(sessionId, user.id);

        const moduleRows = await executeQuery<{ title: string }[]>(
            `SELECT title FROM modules WHERE id = ? LIMIT 1`,
            [session.module_id]
        );
        const moduleTitle = moduleRows?.[0]?.title || '';

        const userRows = await executeQuery<{ full_name: string }[]>(
            `SELECT full_name FROM users WHERE id = ? LIMIT 1`,
            [user.id]
        );
        const participantName = userRows?.[0]?.full_name || user.username;
        const rootSessionId = session.session_type === 'remedial' && session.parent_session_id
            ? session.parent_session_id
            : sessionId;
        const publicationRows = await executeQuery<any[]>(
            `SELECT id, session_id, version, published_at
             FROM session_result_publications
             WHERE root_session_id = ? AND status = 'active'
             ORDER BY version DESC LIMIT 1`,
            [rootSessionId],
        );
        const activePublication = publicationRows?.[0] || null;
        const publishedItems = activePublication
            ? await executeQuery<any[]>(
                `SELECT pi.source_exam_id, pi.best_score, pi.passing_grade, pi.outcome,
                        pi.remedial_session_id, pi.attempts_used, e.title AS source_exam_title
                 FROM session_result_publication_items pi
                 JOIN exams e ON e.id = pi.source_exam_id
                 WHERE pi.publication_id = ? AND pi.user_id = ?`,
                [activePublication.id, user.id],
            )
            : [];
        const publishedByExam = new Map<string, any>(
            publishedItems.map((item: any) => [item.source_exam_id, item]),
        );
        const remedialSourceRows = session.session_type === 'remedial' && session.parent_session_id
            ? await executeQuery<any[]>(
                `SELECT remedial_exam.id AS remedial_exam_id, source_exam.id AS source_exam_id
                 FROM sessions parent_session
                 JOIN module_items source_mi ON source_mi.module_id = parent_session.module_id
                                              AND source_mi.item_type = 'exam'
                 JOIN exams source_exam ON source_exam.id = source_mi.item_id
                 JOIN exams remedial_exam ON (remedial_exam.id = source_exam.id OR remedial_exam.id = source_exam.remedial_exam_id)
                 WHERE parent_session.id = ?`,
                [session.parent_session_id],
            )
            : [];
        const remedialSourceByExam = new Map<string, string>(
            remedialSourceRows.map((row: any) => [row.remedial_exam_id, row.source_exam_id]),
        );

        // Fetch module items with progress
        const items = await executeQuery<any[]>(
            `SELECT
                mi.id AS module_item_id,
                mi.item_type,
                mi.item_id,
                mi.sequence_order,
                CASE mi.item_type
                    WHEN 'training' THEN t.title
                    WHEN 'exam' THEN e.title
                END AS item_title,
                CASE mi.item_type
                    WHEN 'exam' THEN e.duration_minutes
                    ELSE NULL
                END AS duration_minutes,
                CASE mi.item_type
                    WHEN 'exam' THEN e.allow_remedial
                    ELSE FALSE
                END AS allow_remedial,
                CASE mi.item_type
                    WHEN 'exam' THEN e.max_attempts
                    ELSE 1
                END AS max_attempts,
                CASE mi.item_type
                    WHEN 'exam' THEN e.passing_grade
                    ELSE NULL
                END AS passing_grade,
                up.status AS raw_progress_status,
                up.score,
                up.attempts_count
            FROM module_items mi
            LEFT JOIN trainings t ON mi.item_type = 'training' AND mi.item_id = t.id
            LEFT JOIN exams e ON mi.item_type = 'exam' AND mi.item_id = e.id
            LEFT JOIN user_progress up ON up.module_item_id = mi.id AND up.user_id = ? AND up.session_id = ?
            WHERE mi.module_id = ?
              AND (
                  ? <> 'remedial'
                  OR mi.item_type = 'training'
                  OR EXISTS (
                      SELECT 1 FROM session_participant_exam_assignments sea
                      WHERE sea.session_id = ? AND sea.user_id = ? AND sea.module_item_id = mi.id
                  )
              )
            ORDER BY mi.sequence_order ASC`,
            [user.id, sessionId, session.module_id, session.session_type || 'regular', sessionId, user.id]
        );

        // Apply phase unlock based on session timing and module flow configuration
        const enforceSequence = Boolean(session.enforce_sequence);
        let foundFirstIncomplete = false;

        const mappedItems = items.map((item: any) => {
            let progressStatus = item.raw_progress_status;
            const canRetake = false;

            if (user.role !== 'trainee') {
                progressStatus = 'open';
            } else if (progressStatus === 'grading_pending') {
                // Preserve the terminal submission state until all essays are graded.
                // It must never be reopened by the normal active-session logic below.
                // In sequential modules, later items must also remain locked until grading finishes.
                if (enforceSequence) {
                    foundFirstIncomplete = true;
                }
            } else if (progressStatus === 'completed') {
                // Completed exams remain final for this schedule. A further
                // opportunity is opened only through another remedial session.
            } else if (!isActive && !isEnded) {
                // Session hasn't started → all locked
                progressStatus = 'locked';
            } else if (isActive) {
                if (!enforceSequence) {
                    // Open flow (default): All uncompleted items are open and accessible
                    progressStatus = 'open';
                } else {
                    // Sequential flow: Only the first uncompleted item is open
                    if (!foundFirstIncomplete) {
                        progressStatus = 'open';
                        foundFirstIncomplete = true;
                    } else {
                        progressStatus = 'locked';
                    }
                }
            } else {
                // Session ended, not completed → show as locked (missed)
                progressStatus = progressStatus || 'locked';
            }

            const sourceExamId = item.item_type === 'exam'
                ? (remedialSourceByExam.get(item.item_id) || item.item_id)
                : null;
            const publishedResult = sourceExamId ? publishedByExam.get(sourceExamId) || null : null;
            const currentRemedialAwaitingPublication = session.session_type === 'remedial'
                && activePublication?.session_id !== sessionId
                && (item.raw_progress_status === 'completed' || item.raw_progress_status === 'grading_pending');
            const isLegacyVisible = Boolean(session.show_score)
                && Number(session.result_publication_version || 0) === 0;
            return {
                module_item_id: item.module_item_id,
                item_type: item.item_type,
                item_id: item.item_id,
                sequence_order: item.sequence_order,
                item_title: item.item_title,
                duration_minutes: item.duration_minutes,
                progress_status: progressStatus,
                score: item.item_type === 'exam'
                    ? publishedResult?.best_score !== null && publishedResult?.best_score !== undefined
                        ? Number(publishedResult.best_score)
                        : isLegacyVisible ? item.score : null
                    : null,
                passing_grade: publishedResult?.passing_grade !== undefined
                    ? Number(publishedResult.passing_grade)
                    : Number(item.passing_grade || 0),
                result_outcome: currentRemedialAwaitingPublication
                    ? (item.raw_progress_status === 'grading_pending' ? 'grading_pending' : 'draft')
                    : publishedResult?.outcome || (item.raw_progress_status === 'grading_pending' ? 'grading_pending' : 'draft'),
                source_exam_id: sourceExamId,
                remedial_session_id: publishedResult?.remedial_session_id || null,
                result_published: Boolean(publishedResult) && !currentRemedialAwaitingPublication,
                can_retake: canRetake,
                attempts_count: item.attempts_count || 0,
                max_attempts: item.max_attempts || 1
            };
        });

        const enrollmentRows = await executeQuery<any[]>(
            `SELECT graduation_status, graduation_decided_at, graduation_notes, skl_number, certificate_file_url, certificate_number
             FROM session_participants
             WHERE session_id = ? AND user_id = ?
             LIMIT 1`,
            [rootSessionId, user.id]
        );
        const enrollment = enrollmentRows?.[0] || {};
        const participantOutcomes = publishedItems.map((item: any) => item.outcome as string);
        const currentRemedialAwaitingPublication = session.session_type === 'remedial'
            && activePublication?.session_id !== sessionId
            && items.some((item: any) => item.raw_progress_status === 'completed' || item.raw_progress_status === 'grading_pending');
        const evaluationStatus = currentRemedialAwaitingPublication || !activePublication
            ? 'draft'
            : participantOutcomes.includes('remedial_required')
                ? 'remedial_required'
                : participantOutcomes.some((outcome) => outcome === 'remedial_exhausted' || outcome === 'absent')
                    ? 'remedial_exhausted'
                    : participantOutcomes.length > 0 && participantOutcomes.every((outcome) => outcome === 'passed')
                        ? 'ready_for_graduation'
                        : 'draft';
        const publishedRemedialSessionId = publishedItems.find((item: any) => item.remedial_session_id)?.remedial_session_id || null;
        const remedialSessionId = publishedRemedialSessionId === sessionId ? null : publishedRemedialSessionId;
        const remedialSessionRows = remedialSessionId
            ? await executeQuery<any[]>(
                `SELECT id, title, start_time, end_time FROM sessions WHERE id = ? LIMIT 1`,
                [remedialSessionId],
            )
            : [];
        const remedialSession = remedialSessionRows?.[0] || null;

        return NextResponse.json({
            success: true,
            data: {
                ...session,
                enforce_sequence: enforceSequence,
                start_time: normalizeDbDateToIso(session.start_time),
                end_time: normalizeDbDateToIso(session.end_time),
                server_time: serverTime,
                is_active: isActive,
                is_ended: isEnded,
                module_title: moduleTitle,
                participant_name: participantName,
                show_score: Boolean(activePublication) || (Boolean(session.show_score) && Number(session.result_publication_version || 0) === 0),
                result_state: activePublication ? 'published' : 'draft',
                result_publication: activePublication ? {
                    version: Number(activePublication.version),
                    published_at: normalizeDbDateToIso(activePublication.published_at),
                } : null,
                evaluation_status: evaluationStatus,
                published_exam_results: publishedItems.map((item: any) => ({
                    source_exam_id: item.source_exam_id,
                    exam_title: item.source_exam_title,
                    best_score: item.best_score === null ? null : Number(item.best_score),
                    passing_grade: Number(item.passing_grade),
                    outcome: item.outcome,
                    attempts_used: Number(item.attempts_used || 0),
                })),
                remedial_session: remedialSession ? {
                    id: remedialSession.id,
                    title: remedialSession.title,
                    start_time: normalizeDbDateToIso(remedialSession.start_time),
                    end_time: normalizeDbDateToIso(remedialSession.end_time),
                } : null,
                graduation_status: enrollment.graduation_status || 'pending',
                graduation_decided_at: enrollment.graduation_decided_at || null,
                graduation_notes: enrollment.graduation_notes || null,
                skl_number: enrollment.skl_number || null,
                certificate_file_url: enrollment.certificate_file_url || null,
                certificate_number: enrollment.certificate_number || null,
                items: mappedItems,
            },
        });
    } catch (error) {
        if (error instanceof ParticipantError) {
            return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
        }
        const message = error instanceof Error ? error.message : 'Internal Server Error';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

export const GET = withAuth(handleGet, { allowedRoles: ['admin', 'trainer', 'trainee'] });
