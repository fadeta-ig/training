import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import { withAuth, AuthenticatedUser, validateMutationOrigin } from '@/lib/api-auth';
import { logActivity } from '@/lib/audit';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

const certificationSchema = z.object({
    name: z.string().trim().min(3, 'Nama program sertifikasi minimal 3 karakter').max(255),
    code: z.string().trim().max(50).optional().nullable(),
    description: z.string().trim().max(2000).optional().nullable(),
    is_active: z.boolean().default(true),
});

async function handleGet(request: NextRequest, user: AuthenticatedUser) {
    try {
        const search = request.nextUrl.searchParams.get('search')?.trim() || '';

        let query = `
            SELECT 
                cp.id, 
                cp.name, 
                cp.code, 
                cp.description, 
                cp.is_active, 
                cp.created_at, 
                cp.updated_at,
                COUNT(pp.id) as participant_count
            FROM certification_programs cp
            LEFT JOIN participant_profiles pp ON pp.target_certification_id = cp.id
        `;
        const params: any[] = [];

        if (search) {
            query += ` WHERE (cp.name LIKE ? OR cp.code LIKE ? OR cp.description LIKE ?)`;
            const wildcard = `%${search}%`;
            params.push(wildcard, wildcard, wildcard);
        }

        query += ` GROUP BY cp.id, cp.name, cp.code, cp.description, cp.is_active, cp.created_at, cp.updated_at ORDER BY cp.name ASC`;

        const rows = await executeQuery<any[]>(query, params);

        return NextResponse.json({
            success: true,
            data: rows || [],
        });
    } catch (error) {
        console.error('[ADMIN_CERTIFICATIONS_GET_ERROR]', error);
        return NextResponse.json(
            { success: false, error: 'Gagal memuat daftar program sertifikasi' },
            { status: 500 }
        );
    }
}

async function handlePost(request: NextRequest, user: AuthenticatedUser) {
    const invalidOrigin = validateMutationOrigin(request);
    if (invalidOrigin) return invalidOrigin;

    try {
        const body = await request.json();
        const parseResult = certificationSchema.safeParse(body);

        if (!parseResult.success) {
            const firstError = parseResult.error.issues[0]?.message || 'Data program sertifikasi tidak valid';
            return NextResponse.json({ success: false, error: firstError }, { status: 400 });
        }

        const data = parseResult.data;
        const id = uuidv4();

        // Check if code is already used (if provided)
        if (data.code) {
            const existingCode = await executeQuery<any[]>(
                `SELECT id FROM certification_programs WHERE LOWER(code) = ? LIMIT 1`,
                [data.code.toLowerCase()]
            );
            if (Array.isArray(existingCode) && existingCode.length > 0) {
                return NextResponse.json({ success: false, error: 'Kode program sertifikasi sudah digunakan' }, { status: 409 });
            }
        }

        await executeQuery(
            `INSERT INTO certification_programs (id, name, code, description, is_active)
             VALUES (?, ?, ?, ?, ?)`,
            [id, data.name, data.code || null, data.description || null, data.is_active ? 1 : 0]
        );

        await logActivity(user.id, 'CREATE_CERTIFICATION_PROGRAM', 'certification_programs', id, {
            name: data.name,
            code: data.code,
        });

        return NextResponse.json(
            {
                success: true,
                message: 'Program sertifikasi berhasil ditambahkan',
                data: { id, ...data },
            },
            { status: 201 }
        );
    } catch (error) {
        console.error('[ADMIN_CERTIFICATIONS_POST_ERROR]', error);
        return NextResponse.json(
            { success: false, error: 'Terjadi kesalahan sistem saat menyimpan program sertifikasi' },
            { status: 500 }
        );
    }
}

export const GET = withAuth(handleGet, { allowedRoles: ['admin', 'trainer'] });
export const POST = withAuth(handlePost, { allowedRoles: ['admin'] });
