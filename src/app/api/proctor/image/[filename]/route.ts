import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { withAuth, type AuthenticatedUser } from '@/lib/api-auth';

/**
 * GET /api/proctor/image/[filename]
 * Serves webcam proctoring snapshot images dynamically from public/uploads/proctor/
 * Strictly protected: only authenticated Admin and Trainer roles can view proctor snapshots.
 */
async function handleGet(
    _request: NextRequest,
    _user: AuthenticatedUser,
    context: { params: Promise<{ filename: string }> }
) {
    try {
        const { filename } = await context.params;

        if (!filename) {
            return new NextResponse('Filename missing', { status: 400 });
        }

        // Sanitize filename to avoid path traversal
        const safeFilename = path.basename(filename);
        const proctorDir = path.resolve(process.cwd(), 'storage', 'proctor');
        const legacyDir = path.resolve(process.cwd(), 'public', 'uploads', 'proctor');
        const filePath = path.resolve(proctorDir, safeFilename);

        if (!filePath.startsWith(proctorDir + path.sep) && filePath !== proctorDir) {
            return new NextResponse('Forbidden', { status: 403 });
        }

        try {
            let fileBuffer: Buffer;
            try {
                fileBuffer = await fs.readFile(filePath);
            } catch {
                // Fallback to legacy path if not yet moved
                const legacyPath = path.resolve(legacyDir, safeFilename);
                if (legacyPath.startsWith(legacyDir + path.sep)) {
                    fileBuffer = await fs.readFile(legacyPath);
                } else {
                    return new NextResponse('Snapshot Not Found', { status: 404 });
                }
            }
            const ext = path.extname(safeFilename).toLowerCase();
            const contentType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';

            return new NextResponse(new Uint8Array(fileBuffer), {
                status: 200,
                headers: {
                    'Content-Type': contentType,
                    'Cache-Control': 'private, max-age=3600',
                },
            });
        } catch {
            return new NextResponse('Snapshot Not Found', { status: 404 });
        }
    } catch (error) {
        console.error('[PROCTOR_IMAGE_ERROR]', error);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}

export const GET = withAuth(handleGet, { allowedRoles: ['admin', 'trainer'] });

