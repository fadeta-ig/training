import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthenticatedUser } from '@/lib/api-auth';
import {
    getParticipantAnswerSheetData,
    renderAnswerSheetHtml,
    generateAnswerSheetPdf,
} from '@/lib/answer-sheet';
import { logActivity } from '@/lib/audit';
import logger from '@/lib/logger';
import { getAppBaseUrl } from '@/lib/app-url';

/**
 * GET /api/admin/sessions/[id]/participants/[participantId]/answer-sheet
 * Menghasilkan lembar hasil pengerjaan evaluasi peserta (HTML print-ready atau PDF).
 */
async function handleGet(
    request: NextRequest,
    authUser: AuthenticatedUser,
    context: { params: Promise<{ id: string; participantId: string }> }
) {
    try {
        const { id: sessionId, participantId } = await context.params;
        const searchParams = request.nextUrl.searchParams;
        const examId = searchParams.get('examId') || undefined;
        const format = searchParams.get('format') || 'print'; // 'print' | 'pdf'

        // 1. Ambil data lembar pengerjaan
        const data = await getParticipantAnswerSheetData(sessionId, participantId, examId);

        if (!data) {
            return new NextResponse(
                'Data lembar pengerjaan tidak ditemukan. Pastikan peserta telah menyelesaikan ujian pada sesi ini.',
                { status: 404 }
            );
        }

        // 2. Render HTML
        const baseUrl = process.env.NODE_ENV === 'production' ? getAppBaseUrl() : request.nextUrl.origin;
        const html = await renderAnswerSheetHtml(data, baseUrl);

        // 3. Log activity audit
        await logActivity(authUser.id, 'DOWNLOAD_ANSWER_SHEET', 'exam_answers', data.document_id, {
            sessionId,
            participantId,
            participantName: data.participant.full_name,
            examTitle: data.exam.title,
            format,
            score: data.stats.final_score,
        });

        // 4. Return respon sesuai format
        if (format === 'pdf') {
            try {
                const pdfBuffer = await generateAnswerSheetPdf(html);
                const safeName = data.participant.full_name.replace(/[^a-zA-Z0-9_-]/g, '_');
                const safeNip = (data.participant.nip || data.participant.username).replace(/[^a-zA-Z0-9_-]/g, '_');
                const filename = `Lembar_Hasil_${safeNip}_${safeName}.pdf`;

                return new NextResponse(new Uint8Array(pdfBuffer), {
                    status: 200,
                    headers: {
                        'Content-Type': 'application/pdf',
                        'Content-Disposition': `attachment; filename="${filename}"`,
                        'Cache-Control': 'no-store',
                    },
                });
            } catch (pdfErr) {
                logger.error('PDF_RENDER_FAIL', 'Gagal merender PDF langsung, fallback ke HTML print', pdfErr);
                // Fallback ke HTML jika PDF headless browser bermasalah
                return new NextResponse(html, {
                    status: 200,
                    headers: {
                        'Content-Type': 'text/html; charset=utf-8',
                        'Cache-Control': 'no-store',
                    },
                });
            }
        }

        // Default: HTML print-ready (dapat diprint / disave as PDF oleh browser secara instan)
        return new NextResponse(html, {
            status: 200,
            headers: {
                'Content-Type': 'text/html; charset=utf-8',
                'Cache-Control': 'no-store',
            },
        });
    } catch (error) {
        logger.error('ANSWER_SHEET_ERROR', 'Gagal memproses lembar jawaban', error, authUser.id);
        const message = error instanceof Error ? error.message : 'Internal Server Error';
        return new NextResponse(message, { status: 500 });
    }
}

export const GET = withAuth(handleGet, { allowedRoles: ['admin', 'trainer'] });
