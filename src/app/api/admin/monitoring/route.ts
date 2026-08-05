import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import { withAuth } from '@/lib/api-auth';
import { promises as fs } from 'fs';
import path from 'path';

interface SessionData {
    id: string;
    title: string;
    start_time: string;
    end_time: string;
    require_seb: boolean;
    enable_proctoring: boolean;
    module_title: string;
}

interface SnapshotData {
    id: string;
    user_id: string;
    session_id: string;
    image_url: string;
    captured_at: string;
    full_name: string;
    username: string;
}

/**
 * Converts snapshot image URL path to a Base64 Data URI.
 * Next.js dev/standalone servers do not serve files added to `public/` dynamically after startup.
 * Reading the image directly into a Data URI guarantees instant, zero-404 rendering in the admin dashboard.
 */
async function formatSnapshotUrl(imageUrl: string): Promise<string> {
    if (!imageUrl) return '';
    if (imageUrl.startsWith('data:image/')) return imageUrl;

    if (imageUrl.startsWith('/uploads/proctor/')) {
        try {
            const filename = path.basename(imageUrl);
            const filePath = path.join(process.cwd(), 'public', 'uploads', 'proctor', filename);
            const fileBuffer = await fs.readFile(filePath);
            const ext = path.extname(filename).toLowerCase();
            const mimeType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
            return `data:${mimeType};base64,${fileBuffer.toString('base64')}`;
        } catch {
            // If file cannot be read from disk, return original URL as fallback
            return imageUrl;
        }
    }
    return imageUrl;
}

async function handleGet(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const sessionId = searchParams.get('session_id');

        // If no sessionId, return list of active/recent sessions that have proctoring
        if (!sessionId) {
            const activeSessions = await executeQuery<SessionData[]>(`
                SELECT 
                    s.id, s.title, s.start_time, s.end_time, s.require_seb, s.enable_proctoring,
                    m.title as module_title
                FROM sessions s
                JOIN modules m ON s.module_id = m.id
                ORDER BY s.end_time DESC
                LIMIT 50
            `);

            return NextResponse.json({ success: true, data: activeSessions });
        }

        // If sessionId provided, get the LATEST snapshot for each participant in that session
        const snapshots = await executeQuery<SnapshotData[]>(`
            SELECT 
                ps.id, ps.user_id, ps.session_id, ps.image_url, ps.captured_at,
                u.full_name, u.username
            FROM proctor_snapshots ps
            JOIN users u ON ps.user_id = u.id
            INNER JOIN (
                SELECT user_id, MAX(captured_at) as max_captured_at
                FROM proctor_snapshots
                WHERE session_id = ?
                GROUP BY user_id
            ) latest ON ps.user_id = latest.user_id AND ps.captured_at = latest.max_captured_at
            WHERE ps.session_id = ?
            ORDER BY u.full_name ASC
        `, [sessionId, sessionId]);

        // Transform image_url to Data URI for seamless image rendering
        const formattedSnapshots = await Promise.all(
            snapshots.map(async (snap) => ({
                ...snap,
                image_url: await formatSnapshotUrl(snap.image_url),
            }))
        );

        return NextResponse.json({ success: true, data: formattedSnapshots });

    } catch (error) {
        const message = error instanceof Error ? error.message : 'Internal Server Error';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

// Both Admin and Trainer (who is essentially an instructor) can monitor sessions
export const GET = withAuth(handleGet, { allowedRoles: ['admin', 'trainer'] });
