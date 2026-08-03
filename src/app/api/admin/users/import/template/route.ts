import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { withAuth } from '@/lib/api-auth';

async function handleGet() {
    try {
        const sampleData = [
            {
                'Nama Lengkap': 'Budi Santoso',
                'Email Aktif (Username)': 'budi.admin@example.com',
                'Role (admin/trainer)': 'admin',
                'Password (opsional)': 'AdminSecure123!',
                'No HP': '081234567890',
                'Institusi': 'PT Inovasi Gemilang'
            },
            {
                'Nama Lengkap': 'Siti Aminah',
                'Email Aktif (Username)': 'siti.trainer@example.com',
                'Role (admin/trainer)': 'trainer',
                'Password (opsional)': '',
                'No HP': '089876543210',
                'Institusi': 'Akademi Pelatihan Utama'
            }
        ];

        const worksheet = XLSX.utils.json_to_sheet(sampleData);

        // Adjust column widths for readability
        worksheet['!cols'] = [
            { wch: 25 }, // Nama Lengkap
            { wch: 32 }, // Email Aktif (Username)
            { wch: 22 }, // Role
            { wch: 24 }, // Password
            { wch: 18 }, // No HP
            { wch: 25 }, // Institusi
        ];

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Template Import Pengguna');

        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

        return new NextResponse(buffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': 'attachment; filename="Template_Import_Pengguna_LMS.xlsx"',
            },
        });
    } catch (error: any) {
        console.error('Download template user error:', error);
        return NextResponse.json(
            { success: false, error: 'Gagal membuat file template pengguna' },
            { status: 500 }
        );
    }
}

export const GET = withAuth(handleGet, { allowedRoles: ['admin'] });
