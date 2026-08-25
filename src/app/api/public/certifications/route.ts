import { NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';

const FALLBACK_CERTIFICATIONS = [
    {
        id: 'cert-tdit-default',
        name: 'Pelatihan & Sertifikasi Transformasi Digital & Tata Kelola IT',
        code: 'CERT-TDIT',
        description: 'Standardisasi keahlian arsitektur teknologi dan tata kelola sistem informasi.',
    },
    {
        id: 'cert-mdca-default',
        name: 'Sertifikasi Manajemen Data, Analitik & Cloud Architecture',
        code: 'CERT-MDCA',
        description: 'Standardisasi kompetensi rekayasa data dan arsitektur komputasi awan.',
    },
    {
        id: 'cert-csis-default',
        name: 'Sertifikasi Keamanan Informasi & Cyber Security Specialist',
        code: 'CERT-CSIS',
        description: 'Program sertifikasi pertahanan siber dan audit keamanan informasi.',
    },
    {
        id: 'cert-bapm-default',
        name: 'Sertifikasi Analisis Bisnis & Manajemen Proyek Teknologi',
        code: 'CERT-BAPM',
        description: 'Pengembangan kapasitas profesional dalam analisis kebutuhan dan manajemen proyek IT.',
    },
];

export async function GET() {
    try {
        const rows = await executeQuery<any[]>(
            `SELECT id, name, code, description 
             FROM certification_programs 
             WHERE is_active = TRUE 
             ORDER BY name ASC`
        );

        if (!rows || rows.length === 0) {
            return NextResponse.json({
                success: true,
                data: FALLBACK_CERTIFICATIONS,
            });
        }

        return NextResponse.json({
            success: true,
            data: rows,
        });
    } catch (error) {
        console.warn('[PUBLIC_CERTIFICATIONS_FALLBACK] Using fallback list:', error);
        return NextResponse.json({
            success: true,
            data: FALLBACK_CERTIFICATIONS,
        });
    }
}
