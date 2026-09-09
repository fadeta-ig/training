import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { withAuth, AuthenticatedUser } from '@/lib/api-auth';
import logger from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Maps MIME types to the media_type enum and server-controlled extension. */
const ALLOWED_TYPES: Record<string, { mediaType: string; extension: string }> = {
    'image/jpeg': { mediaType: 'image', extension: 'jpg' },
    'image/jpg': { mediaType: 'image', extension: 'jpg' },
    'image/pjpeg': { mediaType: 'image', extension: 'jpg' },
    'image/png': { mediaType: 'image', extension: 'png' },
    'image/x-png': { mediaType: 'image', extension: 'png' },
    'image/gif': { mediaType: 'image', extension: 'gif' },
    'image/webp': { mediaType: 'image', extension: 'webp' },
    'application/pdf': { mediaType: 'pdf', extension: 'pdf' },
    'application/x-pdf': { mediaType: 'pdf', extension: 'pdf' },
    'application/acrobat': { mediaType: 'pdf', extension: 'pdf' },
    'applications/vnd.pdf': { mediaType: 'pdf', extension: 'pdf' },
    'text/pdf': { mediaType: 'pdf', extension: 'pdf' },
    'application/msword': { mediaType: 'document', extension: 'doc' },
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { mediaType: 'document', extension: 'docx' },
    'application/vnd.ms-powerpoint': { mediaType: 'document', extension: 'ppt' },
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': { mediaType: 'document', extension: 'pptx' },
};

/** Extension fallback for browsers or operating systems sending generic application/octet-stream */
const EXTENSION_FALLBACK_MAP: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.ppt': 'application/vnd.ms-powerpoint',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};

const MAX_FILE_SIZE_IMAGE = 10 * 1024 * 1024;   // 10 MB
const MAX_FILE_SIZE_DOCUMENT = 25 * 1024 * 1024; // 25 MB
const UPLOAD_RATE_LIMIT = { windowMs: 60_000, maxRequests: 30 };

function getMaxSize(mediaType: string): number {
    return mediaType === 'image' ? MAX_FILE_SIZE_IMAGE : MAX_FILE_SIZE_DOCUMENT;
}

function startsWithBytes(buffer: Buffer, bytes: number[]): boolean {
    return bytes.every((byte, index) => buffer[index] === byte);
}

function hasExpectedSignature(mimeType: string, buffer: Buffer): boolean {
    const lower = mimeType.toLowerCase();
    if (lower.includes('jpeg') || lower.includes('jpg') || lower.includes('pjpeg')) {
        return startsWithBytes(buffer, [0xff, 0xd8, 0xff]);
    }
    if (lower.includes('png')) {
        return startsWithBytes(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    }
    if (lower.includes('gif')) {
        const signature = buffer.subarray(0, 6).toString('ascii');
        return signature === 'GIF87a' || signature === 'GIF89a';
    }
    if (lower.includes('webp')) {
        return buffer.length > 12
            && buffer.subarray(0, 4).toString('ascii') === 'RIFF'
            && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
    }
    if (lower.includes('pdf')) {
        // According to ISO 32000-1 (section 7.5.2), %PDF can appear in the first 1024 bytes
        const sample = buffer.subarray(0, Math.min(buffer.length, 1024)).toString('latin1');
        return sample.includes('%PDF-') || sample.includes('%PDF');
    }
    if (lower.includes('msword') || lower.includes('powerpoint')) {
        return startsWithBytes(buffer, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
    }
    if (
        lower.includes('wordprocessingml')
        || lower.includes('presentationml')
    ) {
        return startsWithBytes(buffer, [0x50, 0x4b, 0x03, 0x04])
            || startsWithBytes(buffer, [0x50, 0x4b, 0x05, 0x06])
            || startsWithBytes(buffer, [0x50, 0x4b, 0x07, 0x08]);
    }
    return false;
}

function sanitizeOriginalFilename(name: string): string {
    return name.replace(/[^\w.\- ()]/g, '_').slice(0, 255) || 'upload';
}

/**
 * Handles file upload for rich text editor, question images, and training media.
 * Stores files in `public/uploads/` and returns the accessible URL.
 */
async function handlePost(request: NextRequest, user: AuthenticatedUser) {
    try {
        const blocked = checkRateLimit(request, { ...UPLOAD_RATE_LIMIT, identifier: user.id });
        if (blocked) return blocked;

        const formData = await request.formData();
        const file = formData.get('file') as File | null;

        if (!file) {
            return NextResponse.json(
                { success: false, error: 'File tidak ditemukan dalam request.' },
                { status: 400 }
            );
        }

        // Resolve MIME type with fallback to extension if browser sent generic octet-stream or empty
        let resolvedMime = file.type;
        if (!resolvedMime || resolvedMime === 'application/octet-stream') {
            const ext = path.extname(file.name).toLowerCase();
            if (EXTENSION_FALLBACK_MAP[ext]) {
                resolvedMime = EXTENSION_FALLBACK_MAP[ext];
            }
        }

        const allowedType = ALLOWED_TYPES[resolvedMime];
        if (!allowedType) {
            const allowedExts = Object.keys(EXTENSION_FALLBACK_MAP).join(', ');
            return NextResponse.json(
                {
                    success: false,
                    error: `Tipe file "${file.name}" tidak diizinkan. Ekstensi yang didukung: ${allowedExts}`,
                },
                { status: 400 }
            );
        }

        const maxSize = getMaxSize(allowedType.mediaType);
        if (file.size > maxSize) {
            const limitMB = Math.round(maxSize / (1024 * 1024));
            return NextResponse.json(
                {
                    success: false,
                    error: `Ukuran berkas "${file.name}" (${(file.size / (1024 * 1024)).toFixed(1)}MB) melebihi batas maksimum ${limitMB}MB.`,
                },
                { status: 400 }
            );
        }

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        if (!hasExpectedSignature(resolvedMime, buffer)) {
            return NextResponse.json(
                {
                    success: false,
                    error: `Isi berkas "${file.name}" tidak sesuai atau rusak (header file tidak valid).`,
                },
                { status: 400 }
            );
        }

        const originalFilename = sanitizeOriginalFilename(file.name);
        const uniqueFilename = `${uuidv4()}.${allowedType.extension}`;

        const uploadDir = path.join(process.cwd(), 'public', 'uploads');
        await mkdir(uploadDir, { recursive: true });

        const filePath = path.join(uploadDir, uniqueFilename);
        await writeFile(filePath, buffer);

        const fileUrl = `/uploads/${uniqueFilename}`;

        logger.info('FILE_UPLOAD', `File berhasil diunggah: ${file.name} -> ${uniqueFilename}`, {
            originalName: file.name,
            mimeType: resolvedMime,
            sizeBytes: file.size,
            mediaCategory: allowedType.mediaType,
            url: fileUrl,
        });

        return NextResponse.json({
            success: true,
            url: fileUrl,
            filename: uniqueFilename,
            original_filename: originalFilename,
            media_type: allowedType.mediaType,
            message: 'File berhasil diunggah.',
        });
    } catch (error: unknown) {
        logger.error('FILE_UPLOAD', 'Gagal mengunggah file', error);
        const message = error instanceof Error ? error.message : 'Kesalahan sistem';
        return NextResponse.json(
            { success: false, error: `Gagal mengunggah file: ${message}` },
            { status: 500 }
        );
    }
}

export const POST = withAuth(handlePost, { allowedRoles: ['admin', 'trainer'] });
