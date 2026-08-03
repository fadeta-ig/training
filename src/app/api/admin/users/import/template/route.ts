import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-auth';
import logger from '@/lib/logger';
import { objectsToCsv } from '@/lib/csv';

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

        const csv = objectsToCsv(sampleData, [
            'Nama Lengkap',
            'Email Aktif (Username)',
            'Role (admin/trainer)',
            'Password (opsional)',
            'No HP',
            'Institusi',
        ]);

        return new NextResponse(csv, {
            status: 200,
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': 'attachment; filename="Template_Import_Pengguna_LMS.csv"',
            },
        });
    } catch (error: any) {
        logger.error('USER_TEMPLATE_DOWNLOAD', 'Gagal membuat file template pengguna', error);
        return NextResponse.json(
            { success: false, error: 'Gagal membuat file template pengguna' },
            { status: 500 }
        );
    }
}

export const GET = withAuth(handleGet, { allowedRoles: ['admin'] });
