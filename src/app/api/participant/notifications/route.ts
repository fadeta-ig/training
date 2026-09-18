import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import { withAuth, AuthenticatedUser } from '@/lib/api-auth';
import { parsePagination } from '@/lib/sanitize';
import { z } from 'zod';

const notificationUpdateSchema = z.object({
    notification_id: z.string().uuid().optional(),
    mark_all: z.literal(true).optional(),
}).refine((value) => Boolean(value.notification_id) !== Boolean(value.mark_all), {
    message: 'Pilih tepat satu operasi notifikasi',
});

/**
 * GET /api/participant/notifications
 * Fetch user notifications, sorted by most recent
 */
async function handleGet(request: NextRequest, user: AuthenticatedUser) {
    try {
        const { page, limit, offset } = parsePagination(request.nextUrl.searchParams, 20, 50);
        const [notifications, countRows] = await Promise.all([
            executeQuery<any[]>(
                `SELECT id, title, message, is_read, created_at, link_url
                 FROM notifications
                 WHERE user_id = ?
                 ORDER BY created_at DESC, id DESC
                 LIMIT ? OFFSET ?`,
                [user.id, limit, offset],
            ),
            executeQuery<Array<{ total: number | string; unread: number | string }>>(
                `SELECT COUNT(*) AS total, SUM(CASE WHEN is_read = 0 THEN 1 ELSE 0 END) AS unread
                 FROM notifications WHERE user_id = ?`,
                [user.id],
            ),
        ]);

        const total = Number(countRows[0]?.total || 0);
        return NextResponse.json({
            success: true,
            data: notifications,
            unreadCount: Number(countRows[0]?.unread || 0),
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        });
    } catch {
        return NextResponse.json({ success: false, error: 'Kesalahan internal server' }, { status: 500 });
    }
}

/**
 * PUT /api/participant/notifications
 * Mark a specific notification or all notifications as read
 */
async function handlePut(request: NextRequest, user: AuthenticatedUser) {
    try {
        const parsed = notificationUpdateSchema.safeParse(await request.json());
        if (!parsed.success) {
            return NextResponse.json({ success: false, error: 'Parameter notifikasi tidak valid' }, { status: 400 });
        }
        const { notification_id, mark_all } = parsed.data;

        if (mark_all) {
            await executeQuery(
                `UPDATE notifications SET is_read = TRUE WHERE user_id = ?`,
                [user.id]
            );
        } else if (notification_id) {
            await executeQuery(
                `UPDATE notifications SET is_read = TRUE WHERE id = ? AND user_id = ?`,
                [notification_id, user.id]
            );
        } else {
            return NextResponse.json({ success: false, error: 'Parameter tidak lengkap' }, { status: 400 });
        }

        return NextResponse.json({ success: true, message: 'Notifikasi diperbarui' });
    } catch {
        return NextResponse.json({ success: false, error: 'Kesalahan server saat memperbarui notifikasi' }, { status: 500 });
    }
}

export const GET = withAuth(handleGet);
export const PUT = withAuth(handlePut);
