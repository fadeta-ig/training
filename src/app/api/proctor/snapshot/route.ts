import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { executeQuery } from '@/lib/db';
import { withAuth, AuthenticatedUser } from '@/lib/api-auth';
import { promises as fs } from 'fs';
import path from 'path';
import { checkRateLimit } from '@/lib/rate-limit';

/** Max 30 snapshots per minute per IP (allows ~2s interval captures) */
const SNAPSHOT_RATE_LIMIT = { windowMs: 60_000, maxRequests: 30 };

/**
 * Zod schema for snapshot submission with strict input validation.
 */
const snapshotSchema = z.object({
    sessionId: z.string().uuid('Invalid session ID format'),
    imageBase64: z
        .string()
        .min(100, 'Image data too short')
        .max(5_000_000, 'Image data exceeds 5MB limit')
        .refine(
            (val) => val.startsWith('data:image/'),
            'Invalid image data format',
        ),
});

/**
 * POST /api/proctor/snapshot
 * Receives a webcam proctoring snapshot in Base64.
 * Decodes the image to avoid MySQL Bloat, saves it locally,
 * and maintains the URL path in the DB.
 */
async function handlePost(request: NextRequest, user: AuthenticatedUser) {
    const blocked = checkRateLimit(request, SNAPSHOT_RATE_LIMIT);
    if (blocked) return blocked;

    try {
        const body = await request.json();
        const parsed = snapshotSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
                { status: 400 },
            );
        }

        const { sessionId, imageBase64 } = parsed.data;
        const snapshotId = uuidv4();

        // 1. Ekstrak header Data URI
        const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
        const imageBuffer = Buffer.from(base64Data, 'base64');

        // 2. Siapkan Lokasi File
        const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'proctor');
        await fs.mkdir(uploadDir, { recursive: true });

        const filename = `${snapshotId}-${user.id}.jpg`;
        const filePath = path.join(uploadDir, filename);
        
        // 3. Tulis Gambar secara fisik (Menyelamatkan RAM Database)
        await fs.writeFile(filePath, imageBuffer);

        const fileUrl = `/uploads/proctor/${filename}`;

        // 4. Record the path into the database rather than the heavy base64
        await executeQuery(
            `INSERT INTO proctor_snapshots (id, user_id, session_id, image_url) VALUES (?, ?, ?, ?)`,
            [snapshotId, user.id, sessionId, fileUrl],
        );

        return NextResponse.json({ success: true, id: snapshotId }, { status: 201 });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Internal server error';
        console.error('[PROCTOR_API]', message);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export const POST = withAuth(handlePost);
