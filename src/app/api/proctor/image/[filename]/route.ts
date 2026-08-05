import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * GET /api/proctor/image/[filename]
 * Serves webcam proctoring snapshot images dynamically from public/uploads/proctor/
 */
export async function GET(
    _request: NextRequest,
    context: { params: Promise<{ filename: string }> }
) {
    try {
        const { filename } = await context.params;

        if (!filename) {
            return new NextResponse('Filename missing', { status: 400 });
        }

        // Sanitize filename to avoid path traversal
        const safeFilename = path.basename(filename);
        const proctorDir = path.resolve(process.cwd(), 'public', 'uploads', 'proctor');
        const filePath = path.resolve(proctorDir, safeFilename);

        if (!filePath.startsWith(proctorDir)) {
            return new NextResponse('Forbidden', { status: 403 });
        }

        try {
            const fileBuffer = await fs.readFile(filePath);
            const ext = path.extname(safeFilename).toLowerCase();
            const contentType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';

            return new NextResponse(fileBuffer, {
                status: 200,
                headers: {
                    'Content-Type': contentType,
                    'Cache-Control': 'public, max-age=86400',
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
