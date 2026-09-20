import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { executeQuery } from '@/lib/db';
import { questionSchema } from '@/lib/validations/questionSchema';
import { buildQuestionData } from '@/lib/question-helpers';
import { withAuth } from '@/lib/api-auth';
import { assertTrainerAccess, resolveUserCategoryScope } from '@/lib/data-scoping';
import { parsePagination } from '@/lib/sanitize';
import type { AuthenticatedUser } from '@/lib/api-auth';

async function handleGet(request: NextRequest, user: AuthenticatedUser) {
    try {
        const { searchParams } = new URL(request.url);
        const examId = searchParams.get('examId');

        const { page, limit, offset } = parsePagination(searchParams, 100, 200);

        if (examId) {
            const hasAccess = await assertTrainerAccess(user, 'exams', examId);
            if (!hasAccess) {
                return NextResponse.json(
                    { success: false, error: 'Anda tidak memiliki akses ke butir soal ujian ini' },
                    { status: 403 }
                );
            }
        } else if (user.role === 'trainer') {
            const scope = await resolveUserCategoryScope(user, 'e');
            if (scope.categoryIds.length === 0) {
                return NextResponse.json({ success: true, data: [], pagination: { total: 0, page: 1, limit, totalPages: 0 } });
            }
        }

        let countQuery = `SELECT COUNT(*) as total FROM questions q`;
        const countParams: (string | number)[] = [];

        let query = `SELECT q.id, q.exam_id, q.question_type, q.question_text, q.question_image, q.options_json, q.correct_option_index, q.correct_answer, q.points, q.sequence_order FROM questions q`;
        const params: (string | number)[] = [];

        if (examId) {
            countQuery += ` WHERE q.exam_id = ?`;
            countParams.push(examId);

            query += ` WHERE q.exam_id = ? ORDER BY q.sequence_order ASC, q.id ASC LIMIT ? OFFSET ?`;
            params.push(examId, limit, offset);
        } else if (user.role === 'trainer') {
            const scope = await resolveUserCategoryScope(user, 'e');
            const placeholders = scope.categoryIds.map(() => '?').join(',');
            countQuery += ` JOIN exams e ON q.exam_id = e.id WHERE e.category_id IN (${placeholders})`;
            countParams.push(...scope.categoryIds);

            query += ` JOIN exams e ON q.exam_id = e.id WHERE e.category_id IN (${placeholders}) ORDER BY q.sequence_order ASC, q.id ASC LIMIT ? OFFSET ?`;
            params.push(...scope.categoryIds, limit, offset);
        } else {
            query += ` ORDER BY q.sequence_order ASC, q.id ASC LIMIT ? OFFSET ?`;
            params.push(limit, offset);
        }

        const countResult = await executeQuery<{ total: number }[]>(countQuery, countParams);
        const total = countResult[0]?.total || 0;

        const questions = await executeQuery(query, params);

        return NextResponse.json({
            success: true,
            data: questions,
            pagination: { total, page, limit, totalPages: Math.ceil(total / limit) }
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Internal Server Error';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

async function handlePost(request: NextRequest) {
    try {
        const body = await request.json();
        const parsed = questionSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { success: false, error: 'Validasi gagal', details: parsed.error.flatten().fieldErrors },
                { status: 400 }
            );
        }

        const {
            exam_id,
            question_type,
            question_text,
            question_image,
            points,
        } = parsed.data;

        // Verify exam exists
        const examCheck = await executeQuery<{ id: string }[]>(`SELECT id FROM exams WHERE id = ?`, [exam_id]);
        if (!Array.isArray(examCheck) || examCheck.length === 0) {
            return NextResponse.json({ success: false, error: 'Ujian tidak ditemukan' }, { status: 404 });
        }

        // Calculate next sequence_order
        const maxOrderResult = await executeQuery<{ max_order: number }[]>(
            `SELECT COALESCE(MAX(sequence_order), 0) AS max_order FROM questions WHERE exam_id = ?`,
            [exam_id]
        );
        const nextOrder = (maxOrderResult[0]?.max_order ?? 0) + 1;

        const questionId = uuidv4();

        const { optionsJson, finalCorrectIndex, finalCorrectAnswer } = buildQuestionData(parsed.data);

        await executeQuery(
            `INSERT INTO questions (id, exam_id, question_type, question_text, question_image, options_json, correct_option_index, correct_answer, points, sequence_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                questionId,
                exam_id,
                question_type,
                question_text,
                question_image || null,
                optionsJson,
                finalCorrectIndex,
                finalCorrectAnswer,
                points,
                nextOrder,
            ]
        );

        return NextResponse.json({ success: true, id: questionId, message: 'Soal berhasil ditambahkan' }, { status: 201 });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Internal Server Error';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

export const GET = withAuth(handleGet, { allowedRoles: ['admin', 'trainer'] });
export const POST = withAuth(handlePost, { allowedRoles: ['admin'] });
