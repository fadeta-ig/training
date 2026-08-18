import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-auth';
import logger from '@/lib/logger';
import { objectsToCsv } from '@/lib/csv';
import { generateParticipantTemplateXlsx } from '@/lib/excel';

async function handleGet(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const format = searchParams.get('format') || 'xlsx';

        if (format === 'csv') {
            const sampleData = [
                {
                    'Nama Lengkap': 'Ahmad Dahlan',
                    'Email Aktif': 'ahmad.dahlan@example.com',
                    'No HP': '081234567890',
                    'Institusi': 'PT Inovasi Gemilang',
                    'Tanggal Lahir (YYYY-MM-DD)': '1995-05-20',
                    'Jenis Kelamin (L/P)': 'L',
                    'Alamat': 'Jl. Merdeka No. 45, Jakarta Pusat',
                },
                {
                    'Nama Lengkap': 'Siti Nurhaliza',
                    'Email Aktif': 'siti.nurhaliza@example.com',
                    'No HP': '089876543210',
                    'Institusi': 'Universitas Mandiri',
                    'Tanggal Lahir (YYYY-MM-DD)': '1998-11-12',
                    'Jenis Kelamin (L/P)': 'P',
                    'Alamat': 'Jl. Mawar No. 12, Bandung',
                },
            ];

            const csv = objectsToCsv(sampleData, [
                'Nama Lengkap',
                'Email Aktif',
                'No HP',
                'Institusi',
                'Tanggal Lahir (YYYY-MM-DD)',
                'Jenis Kelamin (L/P)',
                'Alamat',
            ]);

            return new NextResponse(csv, {
                status: 200,
                headers: {
                    'Content-Type': 'text/csv; charset=utf-8',
                    'Content-Disposition': 'attachment; filename="Template_Import_Peserta_LMS.csv"',
                },
            });
        }

        // Default: Professional styled XLSX
        const xlsxBuffer = await generateParticipantTemplateXlsx();

        return new NextResponse(Buffer.from(xlsxBuffer), {
            status: 200,
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': 'attachment; filename="Template_Import_Peserta_LMS.xlsx"',
                'Cache-Control': 'no-store',
            },
        });
    } catch (error: unknown) {
        logger.error('PARTICIPANT_TEMPLATE_DOWNLOAD', 'Gagal membuat file template peserta', error);
        return NextResponse.json(
            { success: false, error: 'Gagal membuat file template' },
            { status: 500 }
        );
    }
}

export const GET = withAuth(handleGet, { allowedRoles: ['admin', 'trainer'] });
