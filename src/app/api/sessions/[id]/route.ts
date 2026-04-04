import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { executeQuery } from '@/lib/db';
import pool from '@/lib/db';
import { sessionSchema } from '@/lib/validations/sessionSchema';
import { withAuth } from '@/lib/api-auth';

// GET Detail Sesi & Peserta + Progress Monitoring
async function handleGet(
    request: NextRequest,
    _user: any,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const resolvedParams = await context.params;
        const result = await executeQuery<any[]>(
            `SELECT id, module_id, title, start_time, end_time, require_seb, seb_config_key, created_at 
             FROM sessions WHERE id = ?`,
            [resolvedParams.id]
        );

        if (!result || result.length === 0) {
            return NextResponse.json({ success: false, error: 'Session not found' }, { status: 404 });
        }

        const session = result[0];

        // Fetch module items count
        const moduleItems = await executeQuery<any[]>(
            `SELECT mi.id, mi.item_type, mi.item_id, mi.sequence_order,
                    CASE mi.item_type
                        WHEN 'training' THEN t.title
                        WHEN 'exam' THEN e.title
                    END AS item_title
             FROM module_items mi
             LEFT JOIN trainings t ON mi.item_type = 'training' AND mi.item_id = t.id
             LEFT JOIN exams e ON mi.item_type = 'exam' AND mi.item_id = e.id
             WHERE mi.module_id = ?
             ORDER BY mi.sequence_order ASC`,
            [session.module_id]
        );

        const totalItems = moduleItems.length;

        // Fetch participants with progress
        const participants = await executeQuery<any[]>(
            `SELECT sp.user_id, u.username, u.full_name,
                    COUNT(up.id) AS completed_items
             FROM session_participants sp
             JOIN users u ON sp.user_id = u.id
             LEFT JOIN user_progress up ON up.user_id = sp.user_id 
                  AND up.session_id = sp.session_id 
                  AND up.status = 'completed'
             WHERE sp.session_id = ?
             GROUP BY sp.user_id, u.username, u.full_name
             ORDER BY completed_items DESC, u.full_name ASC`,
            [resolvedParams.id]
        );

        return NextResponse.json({
            success: true,
            data: {
                ...session,
                total_items: totalItems,
                module_items: moduleItems,
                participants: participants.map(p => ({
                    id: p.user_id,
                    username: p.username,
                    full_name: p.full_name,
                    completed_items: Number(p.completed_items),
                    total_items: totalItems,
                    progress: totalItems > 0 ? Math.round((Number(p.completed_items) / totalItems) * 100) : 0,
                }))
            }
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Internal Server Error';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

// PUT Update Sesi & Sinkronisasi Peserta
async function handlePut(
    request: NextRequest,
    _user: any,
    context: { params: Promise<{ id: string }> }
) {
    let connection;
    try {
        const resolvedParams = await context.params;
        const body = await request.json();
        const parsed = sessionSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { success: false, error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
                { status: 400 }
            );
        }

        const { module_id, title, start_time, end_time, require_seb, participant_ids } = parsed.data;
        const sebConfigKey = require_seb ? process.env.SEB_CONFIG_KEY_HASH || null : null;

        connection = await pool.getConnection();
        await connection.beginTransaction();

        // Update session
        await connection.execute(
            `UPDATE sessions 
             SET module_id = ?, title = ?, start_time = ?, end_time = ?, require_seb = ?, seb_config_key = ? 
             WHERE id = ?`,
            [
                module_id,
                title,
                start_time.replace('T', ' ') + ':00',
                end_time.replace('T', ' ') + ':00',
                require_seb,
                sebConfigKey,
                resolvedParams.id
            ]
        );

        // Replace participants (Delete then Insert)
        await connection.execute(`DELETE FROM session_participants WHERE session_id = ?`, [resolvedParams.id]);

        if (participant_ids && participant_ids.length > 0) {
            for (const userId of participant_ids) {
                const participantId = uuidv4();
                await connection.execute(
                    `INSERT INTO session_participants (id, session_id, user_id) VALUES (?, ?, ?)`,
                    [participantId, resolvedParams.id, userId]
                );
            }
        }

        await connection.commit();
        connection.release();

        return NextResponse.json({ success: true, message: 'Session updated completely' });
    } catch (error) {
        if (connection) {
            await connection.rollback();
            connection.release();
        }
        const message = error instanceof Error ? error.message : 'Internal Server Error';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

// DELETE Sesi
async function handleDelete(
    request: NextRequest,
    _user: any,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const resolvedParams = await context.params;

        // ON DELETE CASCADE will handle session_participants
        const result = await executeQuery<{ affectedRows: number }>(
            `DELETE FROM sessions WHERE id = ?`,
            [resolvedParams.id]
        );

        if (result && 'affectedRows' in result && result.affectedRows === 0) {
            return NextResponse.json({ success: false, error: 'Session not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true, message: 'Session deleted' });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Internal Server Error';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

export const GET = withAuth(handleGet, { allowedRoles: ['admin', 'trainer'] });
export const PUT = withAuth(handlePut, { allowedRoles: ['admin'] });
export const DELETE = withAuth(handleDelete, { allowedRoles: ['admin'] });
