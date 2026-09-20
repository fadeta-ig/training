import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import { examSchema } from '@/lib/validations/examSchema';
import { withAuth, type AuthenticatedUser } from '@/lib/api-auth';
import { assertTrainerAccess } from '@/lib/data-scoping';
import pool from '@/lib/db';

async function handleGet(
    _request: NextRequest,
    user: AuthenticatedUser,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const resolvedParams = await context.params;

        // Anti-IDOR: Validasi bahwa trainer memiliki akses ke kategori ujian ini
        const hasAccess = await assertTrainerAccess(user, 'exams', resolvedParams.id);
        if (!hasAccess) {
            return NextResponse.json(
                { success: false, error: 'Anda tidak memiliki akses ke ujian ini atau ujian tidak ditemukan' },
                { status: 403 }
            );
        }

        const result = await executeQuery<any[]>(
            `SELECT e.*, lc.name AS category_name, lc.code AS category_code, lc.color AS category_color,
                    re.title AS remedial_exam_title 
             FROM exams e 
             LEFT JOIN learning_categories lc ON e.category_id = lc.id
             LEFT JOIN exams re ON e.remedial_exam_id = re.id 
             WHERE e.id = ? LIMIT 1`,
            [resolvedParams.id]
        );

        if (!result || result.length === 0) {
            return NextResponse.json({ success: false, error: 'Exam not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true, data: result[0] });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Internal Server Error';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

async function handlePut(
    request: NextRequest,
    _user: AuthenticatedUser,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const resolvedParams = await context.params;
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

        // Prevent self-reference
        if (remedial_exam_id && remedial_exam_id === resolvedParams.id) {
            return NextResponse.json(
                { success: false, error: 'Paket ujian remedial tidak boleh merujuk ke ujian ini sendiri' },
                { status: 400 }
            );
        }

        const finalRemedialExamId = allow_remedial && remedial_exam_id ? remedial_exam_id : null;

        const result = await executeQuery<{ affectedRows: number }>(
            `UPDATE exams 
             SET category_id = ?, title = ?, duration_minutes = ?, passing_grade = ?, allow_remedial = ?, max_attempts = ?, remedial_exam_id = ? 
             WHERE id = ?`,
            [category_id || null, title, duration_minutes, passing_grade, allow_remedial, max_attempts, finalRemedialExamId, resolvedParams.id]
        );

        if (result && 'affectedRows' in result && result.affectedRows === 0) {
            return NextResponse.json({ success: false, error: 'Exam not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true, message: 'Exam updated' });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Internal Server Error';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

async function handleDelete(
    _request: NextRequest,
    _user: AuthenticatedUser,
    context: { params: Promise<{ id: string }> }
) {
    let connection;
    try {
        const resolvedParams = await context.params;

        connection = await pool.getConnection();
        await connection.beginTransaction();

        const [usageRows] = await connection.execute<Array<{
            answers: number | string;
            drafts: number | string;
            module_references: number | string;
            remedial_references: number | string;
        }> & any[]>(
            `SELECT
                (SELECT COUNT(*) FROM exam_answers WHERE exam_id = ?) AS answers,
                (SELECT COUNT(*) FROM exam_answer_drafts WHERE exam_id = ?) AS drafts,
                (SELECT COUNT(*) FROM module_items WHERE item_type = 'exam' AND item_id = ?) AS module_references,
                (SELECT COUNT(*) FROM exams WHERE remedial_exam_id = ?) AS remedial_references`,
            [resolvedParams.id, resolvedParams.id, resolvedParams.id, resolvedParams.id],
        );
        const usage = usageRows[0];
        if (
            Number(usage?.answers || 0) > 0
            || Number(usage?.drafts || 0) > 0
            || Number(usage?.module_references || 0) > 0
            || Number(usage?.remedial_references || 0) > 0
        ) {
            await connection.rollback();
            connection.release();
            connection = undefined;
            return NextResponse.json(
                { success: false, error: 'Ujian yang sudah digunakan, memiliki jawaban/draft, atau menjadi paket remedial tidak dapat dihapus. Duplikasi ujian untuk membuat revisi.' },
                { status: 409 },
            );
        }

        const [result] = await connection.execute<any>('DELETE FROM exams WHERE id = ?', [resolvedParams.id]);

        if (result && 'affectedRows' in result && result.affectedRows === 0) {
            await connection.rollback();
            connection.release();
            connection = undefined;
            return NextResponse.json({ success: false, error: 'Exam not found' }, { status: 404 });
        }

        await connection.commit();
        connection.release();
        connection = undefined;

        return NextResponse.json({ success: true, message: 'Exam deleted' });
    } catch {
        if (connection) {
            await connection.rollback();
            connection.release();
        }
        return NextResponse.json({ success: false, error: 'Gagal menghapus ujian' }, { status: 500 });
    }
}

export const GET = withAuth(handleGet, { allowedRoles: ['admin', 'trainer'] });
export const PUT = withAuth(handlePut, { allowedRoles: ['admin'] });
export const DELETE = withAuth(handleDelete, { allowedRoles: ['admin'] });
