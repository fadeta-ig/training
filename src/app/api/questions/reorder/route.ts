import { NextRequest, NextResponse } from 'next/server';
import pool, { executeQuery } from '@/lib/db';
import { withAuth, AuthenticatedUser } from '@/lib/api-auth';
import { logActivity } from '@/lib/audit';
import { z } from 'zod';

const reorderSchema = z.object({
    examId: z.string().min(1, 'ID ujian diperlukan'),
    orderedIds: z.array(z.string().min(1)).min(1, 'Daftar ID soal tidak boleh kosong'),
});

async function handlePatch(request: NextRequest, user: AuthenticatedUser) {
    try {
        const body = await request.json();
        const parsed = reorderSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { success: false, error: 'Validasi gagal', details: parsed.error.flatten().fieldErrors },
                { status: 400 }
            );
        }

        const { examId, orderedIds } = parsed.data;

        // Check for duplicates in orderedIds
        if (new Set(orderedIds).size !== orderedIds.length) {
            return NextResponse.json(
                { success: false, error: 'Terdapat ID soal duplikat dalam urutan' },
                { status: 400 }
            );
        }

        // Verify exam exists
        const examRows = await executeQuery<{ id: string }[]>(
            `SELECT id FROM exams WHERE id = ? LIMIT 1`,
            [examId]
        );
        if (!Array.isArray(examRows) || examRows.length === 0) {
            return NextResponse.json({ success: false, error: 'Ujian tidak ditemukan' }, { status: 404 });
        }

        // Fetch current questions for this exam
        const existingQuestions = await executeQuery<{ id: string }[]>(
            `SELECT id FROM questions WHERE exam_id = ?`,
            [examId]
        );

        if (!Array.isArray(existingQuestions) || existingQuestions.length === 0) {
            return NextResponse.json({ success: false, error: 'Ujian tidak memiliki soal' }, { status: 400 });
        }

        const existingIdSet = new Set(existingQuestions.map((q) => q.id));

        if (orderedIds.length !== existingQuestions.length || !orderedIds.every((id) => existingIdSet.has(id))) {
            return NextResponse.json(
                { success: false, error: 'Daftar ID soal tidak sesuai dengan soal yang ada pada ujian ini' },
                { status: 400 }
            );
        }

        // Execute updates in a single transaction
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            for (let index = 0; index < orderedIds.length; index++) {
                await connection.execute(
                    `UPDATE questions SET sequence_order = ? WHERE id = ? AND exam_id = ?`,
                    [index + 1, orderedIds[index], examId]
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
            questionCount: orderedIds.length,
        });

        return NextResponse.json({
            success: true,
            message: 'Urutan soal berhasil diperbarui',
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Internal Server Error';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

export const PATCH = withAuth(handlePatch, { allowedRoles: ['admin'] });
