import { NextRequest, NextResponse } from 'next/server';
import { promises as fs, createReadStream } from 'fs';
import path from 'path';
import { Readable } from 'stream';

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
 * High-performance streaming file server with HTTP 206 Partial Content support.
 * - Streams video and large documents to prevent high RAM / OOM crashes.
 * - Supports HTTP Range requests for video seeking in Safari (macOS/iOS) and Chrome.
 * - Strictly protects proctoring webcam snapshots from public unauthenticated access.
 */
export async function GET(
    request: NextRequest,
    context: { params: Promise<{ path: string[] }> }
) {
    try {
        const { path: pathSegments } = await context.params;

        if (!pathSegments || pathSegments.length === 0) {
            return new NextResponse('File path missing', { status: 400 });
        }

        // Security check 1: Proctor webcam snapshots MUST NOT be served publicly via /api/uploads/proctor/*
        // They must only be accessed through the authenticated /api/proctor/image/[filename] endpoint.
        if (pathSegments[0] === 'proctor') {
            return new NextResponse('Forbidden: Akses snapshot proctor memerlukan autentikasi pengawas', { status: 403 });
        }

        const uploadsDir = path.resolve(process.cwd(), 'public', 'uploads');
        const targetPath = path.resolve(uploadsDir, ...pathSegments);

        // Security check 2: Prevent path traversal outside public/uploads (case-insensitive for Windows)
        const cleanUploadsDir = uploadsDir.toLowerCase();
        const cleanTargetPath = targetPath.toLowerCase();
        if (!cleanTargetPath.startsWith(cleanUploadsDir + path.sep) && cleanTargetPath !== cleanUploadsDir) {
            return new NextResponse('Forbidden', { status: 403 });
        }

        let stat;
        try {
            stat = await fs.stat(targetPath);
        } catch (fileError) {
            if ((fileError as NodeJS.ErrnoException).code === 'ENOENT') {
                return new NextResponse('File Not Found', { status: 404 });
            }
            throw fileError;
        }

        if (stat.isDirectory()) {
            return new NextResponse('Forbidden', { status: 403 });
        }

        const fileSize = stat.size;
        const ext = path.extname(targetPath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        const rangeHeader = request.headers.get('range');

        // HTTP 206 Partial Content (Byte-Range Streaming) for low RAM & video seek support
        if (rangeHeader && rangeHeader.startsWith('bytes=')) {
            const parts = rangeHeader.replace(/bytes=/, '').split('-');
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

            if (isNaN(start) || isNaN(end) || start > end || start >= fileSize) {
                return new NextResponse('Requested range not satisfiable', {
                    status: 416,
                    headers: { 'Content-Range': `bytes */${fileSize}` },
                });
            }

            const chunksize = end - start + 1;
            const nodeStream = createReadStream(targetPath, { start, end });
            const webStream = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;

            return new NextResponse(webStream, {
                status: 206,
                headers: {
                    'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                    'Accept-Ranges': 'bytes',
                    'Content-Length': String(chunksize),
                    'Content-Type': contentType,
                    'Cache-Control': 'public, max-age=86400',
                },
            });
        }

        // Full file streaming via Web Streams (constant minimal memory footprint ~64KB)
        const nodeStream = createReadStream(targetPath);
        const webStream = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;

        return new NextResponse(webStream, {
            status: 200,
            headers: {
                'Accept-Ranges': 'bytes',
                'Content-Length': String(fileSize),
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=86400',
            },
        });
    } catch (error) {
        console.error('[API_UPLOADS_ROUTE_ERROR]', error);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
