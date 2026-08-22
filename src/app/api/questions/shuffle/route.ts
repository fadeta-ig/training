import { NextRequest, NextResponse } from 'next/server';
import pool, { executeQuery } from '@/lib/db';
import { withAuth, AuthenticatedUser } from '@/lib/api-auth';
import { logActivity } from '@/lib/audit';
import { z } from 'zod';

const shuffleSchema = z.object({
    examId: z.string().min(1, 'ID ujian diperlukan'),
});

function fisherYatesShuffle<T>(array: T[]): T[] {
    const copy = [...array];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

async function handlePost(request: NextRequest, user: AuthenticatedUser) {
    try {
        const body = await request.json();
        const parsed = shuffleSchema.safeParse(body);

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

        // Fetch current questions ordered by current sequence_order
        const existingQuestions = await executeQuery<{ id: string }[]>(
            `SELECT id FROM questions WHERE exam_id = ? ORDER BY sequence_order ASC, id ASC`,
            [examId]
        );

        if (!Array.isArray(existingQuestions) || existingQuestions.length === 0) {
            return NextResponse.json({ success: false, error: 'Tidak ada soal untuk diacak' }, { status: 400 });
        }

        const previousOrder = existingQuestions.map((q) => q.id);
        const newOrder = fisherYatesShuffle(previousOrder);

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

        await logActivity(user.id, 'SHUFFLE_QUESTIONS', 'exams', examId, {
            questionCount: newOrder.length,
        });

        return NextResponse.json({
            success: true,
            data: {
                previousOrder,
                newOrder,
            },
            message: 'Soal berhasil diacak',
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Internal Server Error';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

export const POST = withAuth(handlePost, { allowedRoles: ['admin'] });
