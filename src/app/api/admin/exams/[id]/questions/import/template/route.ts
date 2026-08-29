import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthenticatedUser } from '@/lib/api-auth';
import { executeQuery } from '@/lib/db';
import { generateQuestionImportTemplateXlsx } from '@/lib/question-import';
import logger from '@/lib/logger';

async function handleGet(
    _request: NextRequest,
    user: AuthenticatedUser,
    context: { params: Promise<{ id: string }> },
) {
    try {
        const { id: examId } = await context.params;
        const exams = await executeQuery<Array<{ id: string }>>(
            'SELECT id FROM exams WHERE id = ? LIMIT 1',
            [examId],
        );
        if (exams.length === 0) {
            return NextResponse.json({ success: false, error: 'Ujian tidak ditemukan' }, { status: 404 });
        }

        const buffer = await generateQuestionImportTemplateXlsx();
        logger.info('QUESTION_IMPORT_TEMPLATE', 'Template import soal dibuat', { examId }, user.id);

        return new NextResponse(Buffer.from(buffer), {
            status: 200,
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': 'attachment; filename="Template_Import_Soal_LMS.xlsx"',
                'Cache-Control': 'no-store',
                'X-Content-Type-Options': 'nosniff',
            },
        });
    } catch (error) {
        logger.error('QUESTION_IMPORT_TEMPLATE', 'Gagal membuat template import soal', error, user.id);
        return NextResponse.json({ success: false, error: 'Gagal membuat template import soal' }, { status: 500 });
    }
}

export const GET = withAuth(handleGet, { allowedRoles: ['admin'] });
