import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { executeQuery } from '@/lib/db';
import { examSchema } from '@/lib/validations/examSchema';
import { withAuth, type AuthenticatedUser } from '@/lib/api-auth';
import { parsePagination } from '@/lib/sanitize';
import { resolveUserCategoryScope } from '@/lib/data-scoping';

async function handleGet(request: NextRequest, user: AuthenticatedUser) {
    try {
        const { searchParams } = new URL(request.url);
        const { page, limit, offset } = parsePagination(searchParams);
        const search = searchParams.get('search')?.trim() || searchParams.get('q')?.trim() || '';
        const categoryId = searchParams.get('category_id') || 'all';
        const examType = searchParams.get('exam_type') || 'all';
        const allowRemedial = searchParams.get('allow_remedial') || 'all';
        const questionStatus = searchParams.get('question_status') || 'all';
        const sort = searchParams.get('sort') || 'created_desc';

        const conditions: string[] = [];
        const conditionParams: (string | number)[] = [];

        // Scoping per role: Trainer hanya melihat ujian di kategori yang di-assign
        const scope = await resolveUserCategoryScope(user, 'e');
        if (scope.sqlCondition) {
            conditions.push(scope.sqlCondition.replace(/^\s*AND\s*/i, ''));
            conditionParams.push(...scope.params);
        }

        if (categoryId !== 'all' && categoryId) {
            conditions.push(`e.category_id = ?`);
            conditionParams.push(categoryId);
        }

        if (search) {
            conditions.push(`(e.title LIKE ? OR lc.name LIKE ? OR lc.code LIKE ?)`);
            conditionParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        if (examType === 'regular') {
            conditions.push(`NOT EXISTS (SELECT 1 FROM exams parent WHERE parent.remedial_exam_id = e.id)`);
        } else if (examType === 'remedial') {
            conditions.push(`EXISTS (SELECT 1 FROM exams parent WHERE parent.remedial_exam_id = e.id)`);
        }

        if (allowRemedial === 'yes') {
            conditions.push(`e.allow_remedial = 1`);
        } else if (allowRemedial === 'no') {
            conditions.push(`(e.allow_remedial = 0 OR e.allow_remedial IS NULL)`);
        }

        if (questionStatus === 'has_questions') {
            conditions.push(`EXISTS (SELECT 1 FROM questions q WHERE q.exam_id = e.id)`);
        } else if (questionStatus === 'no_questions') {
            conditions.push(`NOT EXISTS (SELECT 1 FROM questions q WHERE q.exam_id = e.id)`);
        }

        const whereClause = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';

        const SORT_MAP: Record<string, string> = {
            created_desc: 'e.created_at DESC',
            created_asc: 'e.created_at ASC',
            title_asc: 'e.title ASC',
            title_desc: 'e.title DESC',
            passing_grade_desc: 'e.passing_grade DESC, e.title ASC',
            passing_grade_asc: 'e.passing_grade ASC, e.title ASC',
            duration_desc: 'e.duration_minutes DESC, e.title ASC',
            duration_asc: 'e.duration_minutes ASC, e.title ASC',
            questions_desc: 'question_count DESC, e.title ASC',
        };
        const orderClause = SORT_MAP[sort] || 'e.created_at DESC';

        const countResult = await executeQuery<{ total: number }[]>(
            `SELECT COUNT(*) as total 
             FROM exams e
             LEFT JOIN learning_categories lc ON e.category_id = lc.id
             ${whereClause}`,
            conditionParams
        );
        const total = countResult[0]?.total || 0;

        const exams = await executeQuery(
            `SELECT e.id, e.category_id, lc.name AS category_name, lc.code AS category_code, lc.color AS category_color,
                    e.title, e.duration_minutes, e.passing_grade, e.allow_remedial, e.max_attempts, 
                    e.remedial_exam_id, re.title AS remedial_exam_title, e.created_at,
                    (SELECT COUNT(*) FROM questions q WHERE q.exam_id = e.id) AS question_count,
                    (SELECT COUNT(*) FROM module_items mi WHERE mi.item_id = e.id AND mi.item_type = 'exam') AS module_count,
                    EXISTS (SELECT 1 FROM exams parent WHERE parent.remedial_exam_id = e.id) AS is_remedial_package
             FROM exams e 
             LEFT JOIN learning_categories lc ON e.category_id = lc.id
             LEFT JOIN exams re ON e.remedial_exam_id = re.id 
             ${whereClause}
             ORDER BY ${orderClause} 
             LIMIT ? OFFSET ?`,
            [...conditionParams, limit, offset]
        );

        return NextResponse.json({
            success: true,
            data: exams,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Internal Server Error';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

async function handlePost(request: NextRequest) {
    try {
        const body = await request.json();
        const parsed = examSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { success: false, error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
                { status: 400 }
            );
        }

        const { 
            category_id,
            title, 
            duration_minutes, 
            passing_grade, 
            allow_remedial = false, 
            max_attempts = 1,
            remedial_exam_id = null,
        } = parsed.data;
        const examId = uuidv4();
        const finalRemedialExamId = allow_remedial && remedial_exam_id ? remedial_exam_id : null;

        await executeQuery(
            `INSERT INTO exams (id, category_id, title, duration_minutes, passing_grade, allow_remedial, max_attempts, remedial_exam_id) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [examId, category_id || null, title, duration_minutes, passing_grade, allow_remedial, max_attempts, finalRemedialExamId]
        );

        return NextResponse.json({ success: true, id: examId, message: 'Ujian berhasil dibuat' }, { status: 201 });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Internal Server Error';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

export const GET = withAuth(handleGet, { allowedRoles: ['admin', 'trainer'] });
export const POST = withAuth(handlePost, { allowedRoles: ['admin'] });
