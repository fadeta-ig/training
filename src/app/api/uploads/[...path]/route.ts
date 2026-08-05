import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

/** MIME type mapping for dynamic upload serving */
const MIME_TYPES: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.ppt': 'application/vnd.ms-powerpoint',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
};

/**
 * GET /api/uploads/[...path]
 * Dynamic file server for runtime uploaded files (webcam snapshots, training media, etc.).
 * Next.js static middleware intercepts `/uploads/*` requests and returns 404 for files added
 * dynamically after dev server startup.
 * Routing through `/api/uploads/*` guarantees Next.js routes to this handler without 404 interception.
 */
export async function GET(
    _request: NextRequest,
    context: { params: Promise<{ path: string[] }> }
) {
    try {
        const { path: pathSegments } = await context.params;

        if (!pathSegments || pathSegments.length === 0) {
            return new NextResponse('File path missing', { status: 400 });
        }

        const uploadsDir = path.resolve(process.cwd(), 'public', 'uploads');
        const targetPath = path.resolve(uploadsDir, ...pathSegments);

        // Security check: prevent path traversal attacks outside public/uploads
        if (!targetPath.startsWith(uploadsDir)) {
            return new NextResponse('Forbidden', { status: 403 });
        }

        try {
            const fileBuffer = await fs.readFile(targetPath);
            const ext = path.extname(targetPath).toLowerCase();
            const contentType = MIME_TYPES[ext] || 'application/octet-stream';

            return new NextResponse(fileBuffer, {
                status: 200,
                headers: {
                    'Content-Type': contentType,
                    'Cache-Control': 'public, max-age=86400',
                },
            });
        } catch (fileError) {
            if ((fileError as NodeJS.ErrnoException).code === 'ENOENT') {
                return new NextResponse('File Not Found', { status: 404 });
            }
            throw fileError;
        }
    } catch (error) {
        console.error('[API_UPLOADS_ROUTE_ERROR]', error);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
