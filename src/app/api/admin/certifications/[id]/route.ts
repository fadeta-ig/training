import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import { withAuth, AuthenticatedUser, validateMutationOrigin } from '@/lib/api-auth';
import { logActivity } from '@/lib/audit';
import { z } from 'zod';

const updateCertificationSchema = z.object({
    name: z.string().trim().min(3, 'Nama program sertifikasi minimal 3 karakter').max(255),
    code: z.string().trim().max(50).optional().nullable(),
    description: z.string().trim().max(2000).optional().nullable(),
    is_active: z.boolean().default(true),
});

async function handlePut(
    request: NextRequest,
    user: AuthenticatedUser,
    context: { params: Promise<{ id: string }> }
) {
    const invalidOrigin = validateMutationOrigin(request);
    if (invalidOrigin) return invalidOrigin;

    try {
        const { id } = await context.params;
        const body = await request.json();
        const parseResult = updateCertificationSchema.safeParse(body);

        if (!parseResult.success) {
            const firstError = parseResult.error.issues[0]?.message || 'Data program sertifikasi tidak valid';
            return NextResponse.json({ success: false, error: firstError }, { status: 400 });
        }

        const data = parseResult.data;

        // Check code collision with other records
        if (data.code) {
            const existing = await executeQuery<any[]>(
                `SELECT id FROM certification_programs WHERE LOWER(code) = ? AND id != ? LIMIT 1`,
                [data.code.toLowerCase(), id]
            );
            if (Array.isArray(existing) && existing.length > 0) {
                return NextResponse.json({ success: false, error: 'Kode program sertifikasi sudah digunakan pada program lain' }, { status: 409 });
            }
        }

        await executeQuery(
            `UPDATE certification_programs 
             SET name = ?, code = ?, description = ?, is_active = ? 
             WHERE id = ?`,
            [data.name, data.code || null, data.description || null, data.is_active ? 1 : 0, id]
        );

        await logActivity(user.id, 'UPDATE_CERTIFICATION_PROGRAM', 'certification_programs', id, {
            name: data.name,
            code: data.code,
            is_active: data.is_active,
        });

        return NextResponse.json({
            success: true,
            message: 'Program sertifikasi berhasil diperbarui',
            data: { id, ...data },
        });
    } catch (error) {
        console.error('[ADMIN_CERTIFICATIONS_PUT_ERROR]', error);
        return NextResponse.json(
            { success: false, error: 'Gagal memperbarui program sertifikasi' },
            { status: 500 }
        );
    }
}

async function handleDelete(
    request: NextRequest,
    user: AuthenticatedUser,
    context: { params: Promise<{ id: string }> }
) {
    const invalidOrigin = validateMutationOrigin(request);
    if (invalidOrigin) return invalidOrigin;

    try {
        const { id } = await context.params;

        await executeQuery(
            `DELETE FROM certification_programs WHERE id = ?`,
            [id]
        );

        await logActivity(user.id, 'DELETE_CERTIFICATION_PROGRAM', 'certification_programs', id, null);

        return NextResponse.json({
            success: true,
            message: 'Program sertifikasi berhasil dihapus',
        });
    } catch (error) {
        console.error('[ADMIN_CERTIFICATIONS_DELETE_ERROR]', error);
        return NextResponse.json(
            { success: false, error: 'Gagal menghapus program sertifikasi' },
            { status: 500 }
        );
    }
}

export const PUT = withAuth(handlePut, { allowedRoles: ['admin'] });
export const DELETE = withAuth(handleDelete, { allowedRoles: ['admin'] });
