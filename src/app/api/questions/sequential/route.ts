import { NextRequest, NextResponse } from 'next/server';
import pool, { executeQuery } from '@/lib/db';
import { withAuth, AuthenticatedUser } from '@/lib/api-auth';
import { logActivity } from '@/lib/audit';
import { z } from 'zod';

const sequentialSchema = z.object({
    examId: z.string().min(1, 'ID ujian diperlukan'),
});

async function handlePost(request: NextRequest, user: AuthenticatedUser) {
    try {
        const body = await request.json();
        const parsed = sequentialSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { success: false, error: 'Validasi gagal', details: parsed.error.flatten().fieldErrors },
                { status: 400 }
            );
        }

        const { examId } = parsed.data;

        // Verify exam exists
        const examRows = await executeQuery<{ id: string }[]>(
            `SELECT id FROM exams WHERE id = ? LIMIT 1`,
            [examId]
        );
        if (!Array.isArray(examRows) || examRows.length === 0) {
            return NextResponse.json({ success: false, error: 'Ujian tidak ditemukan' }, { status: 404 });
        }

        // Fetch current sequence order for previous snapshot
        const currentQuestions = await executeQuery<{ id: string }[]>(
            `SELECT id FROM questions WHERE exam_id = ? ORDER BY sequence_order ASC, id ASC`,
            [examId]
        );

        if (!Array.isArray(currentQuestions) || currentQuestions.length === 0) {
            return NextResponse.json({ success: false, error: 'Tidak ada soal untuk diurutkan' }, { status: 400 });
        }

        const previousOrder = currentQuestions.map((q) => q.id);

        // Fetch by primary key/natural order for sequential resetting
        const naturalQuestions = await executeQuery<{ id: string }[]>(
            `SELECT id FROM questions WHERE exam_id = ? ORDER BY id ASC`,
            [examId]
        );

        const newOrder = naturalQuestions.map((q) => q.id);

        // Execute updates in a single transaction
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            for (let index = 0; index < newOrder.length; index++) {
                await connection.execute(
                    `UPDATE questions SET sequence_order = ? WHERE id = ? AND exam_id = ?`,
                    [index + 1, newOrder[index], examId]
                );
            }

            await connection.commit();
        } catch (txError) {
            await connection.rollback();
            throw txError;
        } finally {
            connection.release();
        }

        await logActivity(user.id, 'REORDER_QUESTIONS', 'exams', examId, {
            mode: 'sequential',
            questionCount: newOrder.length,
        });

        return NextResponse.json({
            success: true,
            data: {
                previousOrder,
                newOrder,
            },
            message: 'Urutan nomor soal berhasil diatur ulang berurutan',
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Internal Server Error';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

export const POST = withAuth(handlePost, { allowedRoles: ['admin'] });
