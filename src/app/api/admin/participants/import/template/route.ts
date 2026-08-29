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
                    'Email Aktif (Username Login)': 'ahmad.dahlan@example.com',
                    'Jenis Kelamin (L/P)': 'L',
                    'Tanggal Lahir (YYYY-MM-DD)': '1995-05-20',
                    'No HP / WhatsApp': '081234567890',
                    'Alamat Domisili': 'Jl. Merdeka No. 45, Jakarta Pusat',
                    'Institusi / Unit Kerja': 'PT Telkom Indonesia',
                    'Program Sertifikasi': 'Certified Strategic Business Analyst',
                    'Batch Pelatihan': 'CSBA-SEP26',
                    'Tanggal Pendaftaran (YYYY-MM-DD)': new Date().toISOString().slice(0, 10),
                },
                {
                    'Nama Lengkap': 'Siti Nurhaliza',
                    'Email Aktif (Username Login)': 'siti.nurhaliza@example.com',
                    'Jenis Kelamin (L/P)': 'P',
                    'Tanggal Lahir (YYYY-MM-DD)': '1998-11-12',
                    'No HP / WhatsApp': '089876543210',
                    'Alamat Domisili': 'Jl. Mawar No. 12, Bandung',
                    'Institusi / Unit Kerja': 'Universitas Mandiri',
                    'Program Sertifikasi': 'Pelatihan Transformasi Digital & Tata Kelola IT',
                    'Batch Pelatihan': 'TDIT-OKT26',
                    'Tanggal Pendaftaran (YYYY-MM-DD)': new Date().toISOString().slice(0, 10),
                },
            ];

            const csv = objectsToCsv(sampleData, [
                'Nama Lengkap',
                'Email Aktif (Username Login)',
                'Jenis Kelamin (L/P)',
                'Tanggal Lahir (YYYY-MM-DD)',
                'No HP / WhatsApp',
                'Alamat Domisili',
                'Institusi / Unit Kerja',
                'Program Sertifikasi',
                'Batch Pelatihan',
                'Tanggal Pendaftaran (YYYY-MM-DD)',
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
