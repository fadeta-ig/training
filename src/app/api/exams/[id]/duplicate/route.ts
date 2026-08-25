import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import pool, { executeQuery } from '@/lib/db';
import { withAuth, AuthenticatedUser } from '@/lib/api-auth';
import { logActivity } from '@/lib/audit';
import type { Exam, Question } from '@/types';

async function handlePost(
    _request: NextRequest,
    user: AuthenticatedUser,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const resolvedParams = await context.params;
        const sourceExamId = resolvedParams.id;

        // Fetch source exam
        const sourceExams = await executeQuery<Exam[]>(
            `SELECT id, title, duration_minutes, passing_grade, allow_remedial, max_attempts, remedial_exam_id FROM exams WHERE id = ? LIMIT 1`,
            [sourceExamId]
        );

        const sourceExam = Array.isArray(sourceExams) ? sourceExams[0] : null;
        if (!sourceExam) {
            return NextResponse.json({ success: false, error: 'Ujian sumber tidak ditemukan' }, { status: 404 });
        }

        // Fetch source questions
        const sourceQuestions = await executeQuery<Question[]>(
            `SELECT id, exam_id, question_type, question_text, question_image, options_json, correct_option_index, correct_answer, points, sequence_order 
             FROM questions WHERE exam_id = ? ORDER BY sequence_order ASC, id ASC`,
            [sourceExamId]
        );

        const questionsList = Array.isArray(sourceQuestions) ? sourceQuestions : [];

        // Prepare new exam metadata
        const newExamId = uuidv4();
        const baseTitle = `${sourceExam.title} (Salinan)`;
        // Ensure max 150 characters to comply with VARCHAR(150) schema
        const newTitle = baseTitle.length > 150 ? baseTitle.slice(0, 147) + '...' : baseTitle;

        // Execute duplication atomically in a MySQL transaction
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            // 1. Insert duplicated exam
            await connection.execute(
                `INSERT INTO exams (id, title, duration_minutes, passing_grade, allow_remedial, max_attempts, remedial_exam_id) 
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    newExamId,
                    newTitle,
                    sourceExam.duration_minutes,
                    sourceExam.passing_grade,
                    sourceExam.allow_remedial ? 1 : 0,
                    sourceExam.max_attempts,
                    sourceExam.remedial_exam_id || null,
                ]
            );

            // 2. Clone all questions into the new exam
            for (let i = 0; i < questionsList.length; i++) {
                const q = questionsList[i];
                const newQuestionId = uuidv4();

                // Format options_json properly if it's already an object
                const optionsValue = typeof q.options_json === 'object' && q.options_json !== null
                    ? JSON.stringify(q.options_json)
                    : q.options_json;

                await connection.execute(
                    `INSERT INTO questions (
                        id, exam_id, question_type, question_text, question_image, 
                        options_json, correct_option_index, correct_answer, points, sequence_order
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        newQuestionId,
                        newExamId,
                        q.question_type,
                        q.question_text,
                        q.question_image || null,
                        optionsValue || null,
                        q.correct_option_index !== undefined ? q.correct_option_index : null,
                        q.correct_answer || null,
                        q.points || 1,
                        q.sequence_order !== undefined && q.sequence_order !== null ? q.sequence_order : i + 1,
                    ]
                );
            }

            await connection.commit();
        } catch (txError) {
            await connection.rollback();
            throw txError;
        } finally {
            connection.release();
        }

        // Log audit activity
        await logActivity(user.id, 'DUPLICATE_EXAM', 'exams', newExamId, {
            sourceExamId,
            sourceTitle: sourceExam.title,
            newTitle,
            questionCount: questionsList.length,
        });

        return NextResponse.json({
            success: true,
            data: {
                id: newExamId,
                title: newTitle,
                questionCount: questionsList.length,
                sourceExamId,
            },
            message: `Ujian berhasil diduplikasi beserta ${questionsList.length} butir soal`,
        }, { status: 201 });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Internal Server Error';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

export const POST = withAuth(handlePost, { allowedRoles: ['admin'] });
