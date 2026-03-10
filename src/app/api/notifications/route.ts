import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import { withAuth, AuthenticatedUser } from '@/lib/api-auth';

async function handleGet(request: NextRequest, user: AuthenticatedUser) {
    try {
        const notifications = await executeQuery<any[]>(
            `SELECT id, title, message, type, is_read, created_at 
             FROM notifications 
             WHERE user_id = ? 
             ORDER BY created_at DESC 
             LIMIT 20`,
            [user.id]
        );

        const unreadCount = await executeQuery<{ count: number }[]>(
            `SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0`,
            [user.id]
        );

        return NextResponse.json({
            success: true,
            data: notifications,
            unreadCount: unreadCount[0]?.count || 0
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Internal Server Error';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

/** Mark all notifications as read */
async function handlePut(request: NextRequest, user: AuthenticatedUser) {
    try {
        await executeQuery(
            `UPDATE notifications SET is_read = 1 WHERE user_id = ?`,
            [user.id]
        );

        return NextResponse.json({ success: true, message: 'Semua notifikasi ditandai telah dibaca' });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Internal Server Error';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

export const GET = withAuth(handleGet);
export const PUT = withAuth(handlePut);
