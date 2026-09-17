import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { executeQuery } from '@/lib/db';
import { withAuth, AuthenticatedUser } from '@/lib/api-auth';
import { generateBulkAnswerSheetsZip } from '@/lib/answer-sheet';
import { logActivity } from '@/lib/audit';
import logger from '@/lib/logger';

const bulkDownloadSchema = z.object({
    participant_ids: z.array(z.string().uuid()).optional(),
    exam_id: z.string().uuid().optional(),
    format: z.enum(['pdf', 'html']).default('pdf'),
});

/**
 * POST /api/admin/sessions/[id]/bulk-answer-sheets
 * Mengunduh seluruh lembar hasil pengerjaan peserta terpilih / seluruh peserta dalam satu arsip ZIP.
 */
async function handlePost(
    request: NextRequest,
    authUser: AuthenticatedUser,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id: sessionId } = await context.params;
        let body: any = {};
        try {
            body = await request.json();
        } catch {
            body = {};
        }

        const parsed = bulkDownloadSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { success: false, error: 'Validasi gagal', details: parsed.error.flatten().fieldErrors },
                { status: 400 }
            );
        }

        let targetParticipantIds = parsed.data.participant_ids;

        // Jika tidak ada ID spesifik, ambil seluruh peserta terdaftar dalam sesi ini
        if (!targetParticipantIds || targetParticipantIds.length === 0) {
            const allParticipants = await executeQuery<any[]>(
                `SELECT user_id FROM session_participants WHERE session_id = ? ORDER BY id ASC`,
                [sessionId]
            );
            targetParticipantIds = (allParticipants || []).map((p) => p.user_id);
        }

        if (targetParticipantIds.length === 0) {
            return NextResponse.json(
                { success: false, error: 'Tidak ada peserta terdaftar pada sesi ini' },
                { status: 404 }
            );
        }

        // Generate arsip ZIP
        const result = await generateBulkAnswerSheetsZip(
            sessionId,
            targetParticipantIds,
            parsed.data.exam_id,
            parsed.data.format,
            request.nextUrl.origin
        );

        if (result.totalProcessed === 0) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Tidak ditemukan lembar jawaban ujian yang telah diselesaikan untuk peserta yang dipilih.',
                },
                { status: 404 }
            );
        }

        // Log audit
        await logActivity(authUser.id, 'BULK_DOWNLOAD_ANSWER_SHEETS', 'sessions', sessionId, {
            sessionId,
            requestedCount: targetParticipantIds.length,
            processedCount: result.totalProcessed,
            format: parsed.data.format,
            filename: result.filename,
        });

        return new NextResponse(new Uint8Array(result.buffer), {
            status: 200,
            headers: {
                'Content-Type': 'application/zip',
                'Content-Disposition': `attachment; filename="${result.filename}"`,
                'Cache-Control': 'no-store',
            },
        });
    } catch (error) {
        logger.error('BULK_ANSWER_SHEETS_ERROR', 'Gagal memproses bulk lembar jawaban ZIP', error, authUser.id);
        const message = error instanceof Error ? error.message : 'Internal Server Error';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

export const POST = withAuth(handlePost, { allowedRoles: ['admin', 'trainer'] });
