import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { executeQuery } from '@/lib/db';
import { withAuth, AuthenticatedUser } from '@/lib/api-auth';
import logger from '@/lib/logger';
import { promises as fs } from 'fs';
import path from 'path';
import { checkRateLimit } from '@/lib/rate-limit';
import {
    ParticipantError,
    validateSebAccess,
    validateSessionTiming,
    verifyEnrollment,
} from '@/lib/participant-helpers';

/** Max 30 snapshots per minute per IP (allows ~2s interval captures) */
const SNAPSHOT_RATE_LIMIT = { windowMs: 60_000, maxRequests: 30 };
const MAX_SNAPSHOT_BYTES = 2 * 1024 * 1024;
const IMAGE_DATA_URI_RE = /^data:image\/(jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=]+)$/;
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
const configuredRetentionDays = Number.parseInt(process.env.PROCTOR_RETENTION_DAYS || '30', 10);
const PROCTOR_RETENTION_DAYS = Number.isFinite(configuredRetentionDays)
    ? Math.min(Math.max(configuredRetentionDays, 1), 365)
    : 30;
let lastCleanupAt = 0;

interface ExpiredSnapshot {
    id: string;
    image_url: string;
}

async function cleanupExpiredSnapshots(uploadDir: string): Promise<void> {
    const now = Date.now();
    if (now - lastCleanupAt < CLEANUP_INTERVAL_MS) return;
    lastCleanupAt = now;

    try {
        const cutoff = new Date(now - PROCTOR_RETENTION_DAYS * 24 * 60 * 60 * 1000);
        const expired = await executeQuery<ExpiredSnapshot[]>(
            `SELECT id, image_url
             FROM proctor_snapshots
             WHERE captured_at < ?
             ORDER BY captured_at ASC
             LIMIT 5000`,
            [cutoff],
        );

        if (!expired.length) return;

        const placeholders = expired.map(() => '?').join(', ');
        await executeQuery(
            `DELETE FROM proctor_snapshots WHERE id IN (${placeholders}) AND captured_at < ?`,
            [...expired.map((snapshot) => snapshot.id), cutoff],
        );

        const resolvedUploadDir = path.resolve(uploadDir);
        await Promise.all(expired.map(async (snapshot) => {
            if (!snapshot.image_url?.startsWith('/uploads/proctor/')) return;

            const filePath = path.resolve(resolvedUploadDir, path.basename(snapshot.image_url));
            if (path.dirname(filePath) !== resolvedUploadDir) return;

            try {
                await fs.unlink(filePath);
            } catch (error) {
                if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
            }
        }));
    } catch (error) {
        lastCleanupAt = 0;
        logger.warn('PROCTOR_CLEANUP', 'Pembersihan snapshot kedaluwarsa gagal', {
            error: error instanceof Error ? error.message : String(error),
        });
    }
}

function isValidImageMagic(buffer: Buffer, type: 'jpeg' | 'png' | 'webp'): boolean {
    if (type === 'jpeg') {
        return buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    }
    if (type === 'png') {
        return buffer.length > 8
            && buffer[0] === 0x89
            && buffer[1] === 0x50
            && buffer[2] === 0x4e
            && buffer[3] === 0x47
            && buffer[4] === 0x0d
            && buffer[5] === 0x0a
            && buffer[6] === 0x1a
            && buffer[7] === 0x0a;
    }
    return buffer.length > 12
        && buffer.subarray(0, 4).toString('ascii') === 'RIFF'
        && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
}

/**
 * Zod schema for snapshot submission with strict input validation.
 */
const snapshotSchema = z.object({
    sessionId: z.string().uuid('Invalid session ID format'),
    imageBase64: z
        .string()
        .min(100, 'Image data too short')
        .max(3_000_000, 'Image data exceeds allowed limit')
        .refine(
            (val) => IMAGE_DATA_URI_RE.test(val),
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
    const blocked = checkRateLimit(request, { ...SNAPSHOT_RATE_LIMIT, identifier: user.id });
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
        await verifyEnrollment(sessionId, user.id);

        const { session, isActive } = await validateSessionTiming(sessionId);
        if (!isActive) {
            return NextResponse.json({ success: false, error: 'Snapshot hanya dapat dikirim saat sesi aktif.' }, { status: 400 });
        }
        validateSebAccess(request, session);

        const snapshotId = uuidv4();

        const match = imageBase64.match(IMAGE_DATA_URI_RE);
        if (!match) {
            return NextResponse.json({ success: false, error: 'Format gambar tidak valid.' }, { status: 400 });
        }

        const imageType = match[1] === 'jpg' ? 'jpeg' : match[1] as 'jpeg' | 'png' | 'webp';
        const extension = imageType === 'jpeg' ? 'jpg' : imageType;
        const base64Data = match[2];
        const imageBuffer = Buffer.from(base64Data, 'base64');

        if (imageBuffer.length === 0 || imageBuffer.length > MAX_SNAPSHOT_BYTES || !isValidImageMagic(imageBuffer, imageType)) {
            return NextResponse.json({ success: false, error: 'Isi gambar snapshot tidak valid.' }, { status: 400 });
        }

        const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'proctor');
        await fs.mkdir(uploadDir, { recursive: true });

        const filename = `${snapshotId}-${user.id}.${extension}`;
        const filePath = path.join(uploadDir, filename);

        await fs.writeFile(filePath, imageBuffer);

        const fileUrl = `/uploads/proctor/${filename}`;

        try {
            await executeQuery(
                `INSERT INTO proctor_snapshots (id, user_id, session_id, image_url) VALUES (?, ?, ?, ?)`,
                [snapshotId, user.id, sessionId, fileUrl],
            );
        } catch (error) {
            await fs.unlink(filePath).catch(() => undefined);
            throw error;
        }

        await cleanupExpiredSnapshots(uploadDir);

        return NextResponse.json({ success: true, id: snapshotId }, { status: 201 });
    } catch (error) {
        if (error instanceof ParticipantError) {
            return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
        }
        logger.error('PROCTOR_SNAPSHOT', 'Gagal menyimpan snapshot proktor', error, user.id);
        return NextResponse.json({ success: false, error: 'Gagal menyimpan data snapshot proktor.' }, { status: 500 });
    }
}

export const POST = withAuth(handlePost, { allowedRoles: ['trainee'] });
