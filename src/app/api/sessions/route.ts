import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { executeQuery } from '@/lib/db';
import pool from '@/lib/db';
import { withAuth } from '@/lib/api-auth';
import { sessionSchema } from '@/lib/validations/sessionSchema';
import { normalizeDbDateToIso, toMysqlDatetimeWib } from '@/lib/timezone';
import { validateRemedialSessionConfiguration } from '@/lib/exam-results';

async function handleGet(_request: NextRequest) {
    try {
        const sessions = await executeQuery<any[]>(
            `SELECT id, module_id, title, start_time, end_time, session_type, parent_session_id,
                    remedial_cycle, result_state, result_published_at, result_publication_version,
                    require_seb, show_score, enable_proctoring, created_at
             FROM sessions ORDER BY start_time DESC`
        );
        const normalized = (sessions || []).map((s) => ({
            ...s,
            start_time: normalizeDbDateToIso(s.start_time),
            end_time: normalizeDbDateToIso(s.end_time),
            require_seb: Boolean(s.require_seb),
            show_score: s.show_score === 1 || s.show_score === true || s.show_score === '1',
            enable_proctoring: s.enable_proctoring === 1 || s.enable_proctoring === true || s.enable_proctoring === '1',
        }));
        return NextResponse.json({ success: true, data: normalized });
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

        const {
            module_id, title, start_time, end_time, session_type, parent_session_id,
            remedial_cycle, require_seb, enable_proctoring, participant_ids,
        } = parsed.data;
        const sessionId = uuidv4();

        // The Config Key is calculated from the exact generated .seb file on download.
        // It must never be a static environment value because startURL and settings
        // are part of the platform-independent SEB checksum.
        const sebConfigKey = null;

        connection = await pool.getConnection();
        await connection.beginTransaction();

        if (session_type === 'remedial') {
            const configurationError = await validateRemedialSessionConfiguration(connection, {
                parentSessionId: parent_session_id!,
                moduleId: module_id,
                remedialCycle: remedial_cycle,
            });
            if (configurationError) {
                await connection.rollback();
                connection.release();
                connection = undefined;
                return NextResponse.json({ success: false, error: configurationError }, { status: 409 });
            }
        }

        await connection.execute(
            `INSERT INTO sessions
                (id, module_id, title, start_time, end_time, session_type, parent_session_id,
                 remedial_cycle, result_state, require_seb, show_score, enable_proctoring, seb_config_key)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?)`,
            [
                sessionId,
                module_id,
                title,
                toMysqlDatetimeWib(start_time),
                toMysqlDatetimeWib(end_time),
                session_type,
                session_type === 'remedial' ? (parent_session_id || null) : null,
                session_type === 'remedial' ? remedial_cycle : 0,
                Boolean(require_seb),
                // Results always start in draft. They become visible only through
                // the atomic session publication workflow.
                false,
                Boolean(enable_proctoring),
                sebConfigKey
            ]
        );

        if (session_type === 'regular' && participant_ids && participant_ids.length > 0) {
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
        connection = undefined;

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

export const GET = withAuth(handleGet, { allowedRoles: ['admin', 'trainer'] });
export const POST = withAuth(handlePost, { allowedRoles: ['admin'] });
