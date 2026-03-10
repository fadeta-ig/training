import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const ALLOWED_IMAGE_TYPES = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
];

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

/**
 * Handles image upload for rich text editor and question images.
 * Stores files in `public/uploads/` and returns the accessible URL.
 */
export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File | null;

        if (!file) {
            return NextResponse.json(
                { success: false, error: 'File tidak ditemukan dalam request.' },
                { status: 400 }
            );
        }

        if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
            return NextResponse.json(
                { success: false, error: `Tipe file tidak diizinkan: ${file.type}. Gunakan JPEG, PNG, GIF, atau WebP.` },
                { status: 400 }
            );
        }

        if (file.size > MAX_FILE_SIZE) {
            return NextResponse.json(
                { success: false, error: 'Ukuran file melebihi batas maksimum 5MB.' },
                { status: 400 }
            );
        }

        const fileExtension = file.name.split('.').pop() || 'png';
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
