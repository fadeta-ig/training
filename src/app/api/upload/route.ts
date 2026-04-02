import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { withAuth } from '@/lib/api-auth';

/** Maps MIME types to the media_type enum used by training_media */
const ALLOWED_TYPES: Record<string, string> = {
    'image/jpeg': 'image',
    'image/png': 'image',
    'image/gif': 'image',
    'image/webp': 'image',
    'image/svg+xml': 'image',
    'application/pdf': 'pdf',
    'application/msword': 'document',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'document',
    'application/vnd.ms-powerpoint': 'document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'document',
};

const MAX_FILE_SIZE_IMAGE = 5 * 1024 * 1024;    // 5 MB
const MAX_FILE_SIZE_DOCUMENT = 20 * 1024 * 1024; // 20 MB

function getMaxSize(mimeType: string): number {
    const mediaType = ALLOWED_TYPES[mimeType];
    return mediaType === 'image' ? MAX_FILE_SIZE_IMAGE : MAX_FILE_SIZE_DOCUMENT;
}

/**
 * Handles file upload for rich text editor, question images, and training media.
 * Stores files in `public/uploads/` and returns the accessible URL.
 */
async function handlePost(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File | null;

        if (!file) {
            return NextResponse.json(
                { success: false, error: 'File tidak ditemukan dalam request.' },
                { status: 400 }
            );
        }

        const mediaCategory = ALLOWED_TYPES[file.type];
        if (!mediaCategory) {
            const allowed = Object.keys(ALLOWED_TYPES).join(', ');
            return NextResponse.json(
                { success: false, error: `Tipe file tidak diizinkan: ${file.type}. Tipe yang diizinkan: ${allowed}` },
                { status: 400 }
            );
        }

        const maxSize = getMaxSize(file.type);
        if (file.size > maxSize) {
            const limitMB = Math.round(maxSize / (1024 * 1024));
            return NextResponse.json(
                { success: false, error: `Ukuran file melebihi batas maksimum ${limitMB}MB.` },
                { status: 400 }
            );
        }

        const fileExtension = file.name.split('.').pop() || 'bin';
        const uniqueFilename = `${uuidv4()}.${fileExtension}`;

        const uploadDir = path.join(process.cwd(), 'public', 'uploads');
        await mkdir(uploadDir, { recursive: true });

        const filePath = path.join(uploadDir, uniqueFilename);
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        await writeFile(filePath, buffer);

        const fileUrl = `/uploads/${uniqueFilename}`;

        return NextResponse.json({
            success: true,
            url: fileUrl,
            filename: uniqueFilename,
            original_filename: file.name,
            media_type: mediaCategory,
            message: 'File berhasil diunggah.',
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Internal Server Error';
        console.error('[UPLOAD_ERROR]', message);
        return NextResponse.json(
            { success: false, error: `Gagal mengunggah file: ${message}` },
            { status: 500 }
        );
    }
}

export const POST = withAuth(handlePost, { allowedRoles: ['admin', 'trainer'] });
