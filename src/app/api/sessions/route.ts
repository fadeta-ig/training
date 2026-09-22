import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { executeQuery } from '@/lib/db';
import pool from '@/lib/db';
import { withAuth, type AuthenticatedUser } from '@/lib/api-auth';
import { sessionSchema } from '@/lib/validations/sessionSchema';
import { normalizeDbDateToIso, toMysqlDatetimeWib } from '@/lib/timezone';
import { validateRemedialSessionConfiguration } from '@/lib/exam-results';
import { resolveSessionCategoryScope } from '@/lib/data-scoping';

async function handleGet(request: NextRequest, user: AuthenticatedUser) {
    try {
        const { searchParams } = new URL(request.url);
        const categoryId = searchParams.get('category_id') || 'all';

        const conditions: string[] = [];
        const conditionParams: (string | number)[] = [];

        // Scoping per role: Trainer hanya melihat sesi yang modulnya masuk kategori assignment
        const scope = await resolveSessionCategoryScope(user, 'm');
        if (scope.sqlCondition) {
            conditions.push(scope.sqlCondition.replace(/^\s*AND\s*/i, ''));
            conditionParams.push(...scope.params);
        }

        if (categoryId !== 'all' && categoryId) {
            conditions.push(`m.category_id = ?`);
            conditionParams.push(categoryId);
        }

        const whereClause = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';

        const sessions = await executeQuery<any[]>(
            `SELECT s.id, s.module_id, s.title, s.start_time, s.end_time, s.session_type, s.parent_session_id,
                    s.remedial_cycle, s.result_state, s.result_published_at, s.result_publication_version,
                    s.require_seb, s.show_score, s.enable_proctoring, s.created_at,
                    m.title AS module_title, m.category_id,
                    lc.name AS category_name, lc.code AS category_code, lc.color AS category_color
             FROM sessions s
             JOIN modules m ON s.module_id = m.id
             LEFT JOIN learning_categories lc ON m.category_id = lc.id
             ${whereClause}
             ORDER BY s.start_time DESC`,
            conditionParams
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

async function handlePost(request: NextRequest, _user: AuthenticatedUser) {
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
