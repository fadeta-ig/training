import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import { withAuth, AuthenticatedUser } from '@/lib/api-auth';
import { v4 as uuidv4 } from 'uuid';

/**
 * GET /api/participant/sessions/[id]/exam/[examId]
 * Returns exam questions for the trainee to answer.
 * Only returns questions if the session is currently active.
 */
async function handleGet(
    _request: NextRequest,
    user: AuthenticatedUser,
    context: { params: Promise<{ id: string; examId: string }> }
) {
    try {
        const { id: sessionId, examId } = await context.params;

        // Verify enrollment
        const enrollment = await executeQuery<any[]>(
            `SELECT id FROM session_participants WHERE session_id = ? AND user_id = ?`,
            [sessionId, user.id]
        );
        if (!enrollment || enrollment.length === 0) {
            return NextResponse.json({ success: false, error: 'Tidak terdaftar' }, { status: 403 });
        }

        // Check session is active
        const session = await executeQuery<any[]>(
            `SELECT start_time, end_time, require_seb FROM sessions WHERE id = ?`,
            [sessionId]
        );
        if (!session || session.length === 0) {
            return NextResponse.json({ success: false, error: 'Sesi tidak ditemukan' }, { status: 404 });
        }

        if (session[0].require_seb) {
            const userAgent = _request.headers.get('user-agent') || '';
            if (!userAgent.includes('SafeExamBrowser')) {
                return NextResponse.json(
                    { success: false, error: 'Akses ujian ini mewajibkan penggunaan Safe Exam Browser (SEB).' },
                    { status: 403 }
                );
            }
        }

        const now = new Date();
        const start = new Date(session[0].start_time);
        const end = new Date(session[0].end_time);

        if (now < start) {
            return NextResponse.json({ success: false, error: 'Sesi belum dimulai' }, { status: 400 });
        }
        if (now > end) {
            return NextResponse.json({ success: false, error: 'Sesi sudah berakhir' }, { status: 400 });
        }

        // Fetch exam info
        const exam = await executeQuery<any[]>(
            `SELECT id, title, duration_minutes, passing_grade FROM exams WHERE id = ?`,
            [examId]
        );
        if (!exam || exam.length === 0) {
            return NextResponse.json({ success: false, error: 'Ujian tidak ditemukan' }, { status: 404 });
        }

        // Fetch questions (without correct answers for security)
        const questions = await executeQuery<any[]>(
            `SELECT id, question_type, text AS question_text, question_image, options_json, points
             FROM questions WHERE exam_id = ?`,
            [examId]
        );

        // Sanitize options for matching type (don't reveal pairs)
        const sanitized = questions.map((q: any) => {
            const parsed = q.options_json ? (typeof q.options_json === 'string' ? JSON.parse(q.options_json) : q.options_json) : null;

            if (q.question_type === 'matching' && parsed?.pairs) {
                // Shuffle the right column for matching
                const rights = parsed.pairs.map((p: any) => p.right).sort(() => Math.random() - 0.5);
                return {
                    ...q,
                    options_json: {
                        lefts: parsed.pairs.map((p: any) => p.left),
                        rights,
                    },
                };
            }
            return q;
        });

        // Fetch any existing answers (in case of resume)
        const existingAnswers = await executeQuery<any[]>(
            `SELECT question_id, selected_option FROM exam_answers
             WHERE user_id = ? AND session_id = ?`,
            [user.id, sessionId]
        );

        return NextResponse.json({
            success: true,
            data: {
                exam: exam[0],
                questions: sanitized,
                existingAnswers,
                serverTime: new Date().toISOString(),
                sessionEnd: session[0].end_time,
            },
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Internal Server Error';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

export const GET = withAuth(handleGet, { allowedRoles: ['trainee'] });
