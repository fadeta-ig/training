import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { executeQuery } from '@/lib/db';
import pool from '@/lib/db';
import { withAuth } from '@/lib/api-auth';

import { sessionSchema } from '@/lib/validations/sessionSchema';
async function handleGet() {
    try {
        const sessions = await executeQuery(
            `SELECT id, module_id, title, start_time, end_time, require_seb, created_at FROM sessions ORDER BY start_time DESC`
        );
        return NextResponse.json({ success: true, data: sessions });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Internal Server Error';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

async function handlePost(request: NextRequest) {
    let connection;
    try {
        const body = await request.json();
        const parsed = sessionSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { success: false, error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
                { status: 400 }
            );
        }

        const { module_id, title, start_time, end_time, require_seb, participant_ids } = parsed.data;
        const sessionId = uuidv4();

        const sebConfigKey = require_seb ? process.env.SEB_CONFIG_KEY_HASH || null : null;

        connection = await pool.getConnection();
        await connection.beginTransaction();

        await connection.execute(
            `INSERT INTO sessions (id, module_id, title, start_time, end_time, require_seb, seb_config_key) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                sessionId,
                module_id,
                title,
                new Date(start_time).toISOString().slice(0, 19).replace('T', ' '),
                new Date(end_time).toISOString().slice(0, 19).replace('T', ' '),
                require_seb,
                sebConfigKey
            ]
        );

        if (participant_ids && participant_ids.length > 0) {
            for (const userId of participant_ids) {
                const participantId = uuidv4();
                await connection.execute(
                    `INSERT INTO session_participants (id, session_id, user_id) VALUES (?, ?, ?)`,
                    [participantId, sessionId, userId]
                );
            }
        }

        await connection.commit();
        connection.release();

        return NextResponse.json({ success: true, id: sessionId, message: 'Session created' }, { status: 201 });
    } catch (error) {
        if (connection) {
            await connection.rollback();
            connection.release();
        }
        const message = error instanceof Error ? error.message : 'Internal Server Error';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

export const GET = withAuth(handleGet, { allowedRoles: ['admin'] });
export const POST = withAuth(handlePost, { allowedRoles: ['admin'] });
