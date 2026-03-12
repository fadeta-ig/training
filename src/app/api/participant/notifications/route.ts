import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import { withAuth, AuthenticatedUser } from '@/lib/api-auth';

/**
 * GET /api/participant/notifications
 * Fetch user notifications, sorted by most recent
 */
async function handleGet(request: NextRequest, user: AuthenticatedUser) {
    try {
        const notifications = await executeQuery<any[]>(
            `SELECT id, title, message, is_read, created_at, link_url
             FROM notifications 
             WHERE user_id = ? 
             ORDER BY created_at DESC`,
            [user.id]
        );

        return NextResponse.json({ success: true, data: notifications });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Kesalahan internal server';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

/**
 * PUT /api/participant/notifications
 * Mark a specific notification or all notifications as read
 */
async function handlePut(request: NextRequest, user: AuthenticatedUser) {
    try {
        const body = await request.json();
        const { notification_id, mark_all } = body;

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
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Kesalahan server saat memperbarui notifikasi';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

export const GET = withAuth(handleGet);
export const PUT = withAuth(handlePut);
