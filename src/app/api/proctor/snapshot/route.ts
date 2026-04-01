import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { executeQuery } from '@/lib/db';
import { withAuth, AuthenticatedUser } from '@/lib/api-auth';

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
 * Receives and stores a webcam proctoring snapshot.
 * Now protected by withAuth — userId is extracted from the JWT token.
 */
async function handlePost(request: NextRequest, user: AuthenticatedUser) {
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

        await executeQuery(
            `INSERT INTO proctor_snapshots (id, user_id, session_id, image_base64) VALUES (?, ?, ?, ?)`,
            [snapshotId, user.id, sessionId, imageBase64],
        );

        return NextResponse.json({ success: true, id: snapshotId }, { status: 201 });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Internal server error';
        console.error('[PROCTOR_API]', message);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export const POST = withAuth(handlePost);
