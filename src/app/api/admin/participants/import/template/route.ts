import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { withAuth } from '@/lib/api-auth';

async function handleGet() {
    try {
        const sampleData = [
            {
                'Nama Lengkap': 'Ahmad Dahlan',
                'Email Aktif': 'ahmad.dahlan@example.com',
                'No HP': '081234567890',
                'Institusi': 'PT Inovasi Gemilang',
                'Tanggal Lahir (YYYY-MM-DD)': '1995-05-20',
                'Jenis Kelamin (L/P)': 'L',
                'Alamat': 'Jl. Merdeka No. 45, Jakarta'
            },
            {
                'Nama Lengkap': 'Siti Nurhaliza',
                'Email Aktif': 'siti.nurhaliza@example.com',
                'No HP': '089876543210',
                'Institusi': 'Universitas Mandiri',
                'Tanggal Lahir (YYYY-MM-DD)': '1998-11-12',
                'Jenis Kelamin (L/P)': 'P',
                'Alamat': 'Jl. Mawar No. 12, Bandung'
            }
        ];

        const worksheet = XLSX.utils.json_to_sheet(sampleData);

        // Adjust column widths for easy reading
        worksheet['!cols'] = [
            { wch: 25 }, // Nama Lengkap
            { wch: 32 }, // Email Aktif
            { wch: 18 }, // No HP
            { wch: 25 }, // Institusi
            { wch: 25 }, // Tanggal Lahir
            { wch: 20 }, // Jenis Kelamin
            { wch: 35 }, // Alamat
        ];

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Template Import Peserta');

        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

        return new NextResponse(buffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': 'attachment; filename="Template_Import_Peserta_LMS.xlsx"',
            },
        });
    } catch (error: any) {
        console.error('Download template error:', error);
        return NextResponse.json(
            { success: false, error: 'Gagal membuat file template' },
            { status: 500 }
        );
    }
}

export const GET = withAuth(handleGet, { allowedRoles: ['admin', 'trainer'] });
