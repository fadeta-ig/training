import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { executeQuery } from '@/lib/db';
import pool from '@/lib/db';
import { sessionSchema } from '@/lib/validations/sessionSchema';
import { withAuth } from '@/lib/api-auth';
import logger from '@/lib/logger';
import { normalizeDbDateToIso, toMysqlDatetimeWib } from '@/lib/timezone';

// GET Detail Sesi & Peserta + Progress Monitoring
async function handleGet(
    request: NextRequest,
    _user: any,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const resolvedParams = await context.params;
        const result = await executeQuery<any[]>(
            `SELECT id, module_id, title, start_time, end_time, require_seb, show_score, enable_proctoring, seb_config_key, created_at 
             FROM sessions WHERE id = ?`,
            [resolvedParams.id]
        );

        if (!result || result.length === 0) {
            return NextResponse.json({ success: false, error: 'Session not found' }, { status: 404 });
        }

        const session = result[0];

        // Total module items
        const countResult = await executeQuery<any[]>(
            `SELECT COUNT(*) as total FROM module_items WHERE module_id = ?`,
            [session.module_id]
        );
        const totalItems = countResult?.[0]?.total || 0;

        // Fetch module items with titles & metadata from trainings and exams
        const moduleItems = await executeQuery<any[]>(
            `SELECT 
                mi.id, 
                mi.item_type, 
                mi.item_id, 
                mi.sequence_order,
                CASE mi.item_type
                    WHEN 'training' THEN t.title
                    WHEN 'exam' THEN e.title
                END AS title,
                CASE mi.item_type
                    WHEN 'exam' THEN e.duration_minutes
                    ELSE NULL
                END AS duration,
                CASE mi.item_type
                    WHEN 'exam' THEN e.passing_grade
                    ELSE NULL
                END AS passing_score
             FROM module_items mi
             LEFT JOIN trainings t ON mi.item_type = 'training' AND mi.item_id = t.id
             LEFT JOIN exams e ON mi.item_type = 'exam' AND mi.item_id = e.id
             WHERE mi.module_id = ? 
             ORDER BY mi.sequence_order ASC`,
            [session.module_id]
        );

        // Fetch all progress records for this session to determine real-time participant activity
        const progressRows = await executeQuery<any[]>(
            `SELECT 
                up.user_id,
                up.module_item_id,
                up.status AS item_status,
                up.updated_at,
                up.last_attempt_start,
                mi.item_type,
                mi.sequence_order,
                CASE mi.item_type
                    WHEN 'training' THEN t.title
                    WHEN 'exam' THEN e.title
                END AS item_title
             FROM user_progress up
             JOIN module_items mi ON mi.id = up.module_item_id
             LEFT JOIN trainings t ON mi.item_type = 'training' AND mi.item_id = t.id
             LEFT JOIN exams e ON mi.item_type = 'exam' AND mi.item_id = e.id
             WHERE up.session_id = ?
             ORDER BY up.updated_at DESC`,
            [resolvedParams.id]
        );

        const progressByUser = new Map<string, any[]>();
        for (const pr of progressRows || []) {
            if (!progressByUser.has(pr.user_id)) {
                progressByUser.set(pr.user_id, []);
            }
            progressByUser.get(pr.user_id)!.push(pr);
        }

        // Fetch participants with progress, NIP, graduation verdict, SKL & certificates
        const participants = await executeQuery<any[]>(
            `SELECT sp.id AS session_participant_id,
                    sp.user_id, u.username, u.full_name,
                    p.nip, p.id_card_number, p.institution, p.batch,
                    sp.graduation_status,
                    sp.graduation_decided_at,
                    sp.graduation_notes,
                    sp.skl_number,
                    sp.skl_generated_at,
                    sp.certificate_file_url,
                    sp.certificate_number,
                    sp.certificate_uploaded_at,
                    COUNT(DISTINCT CASE WHEN up.status = 'completed' THEN up.id END) AS completed_items,
                    AVG(CASE WHEN mi.item_type = 'exam' AND up.score IS NOT NULL THEN up.score END) AS exam_avg_score,
                    MAX(CASE WHEN mi.item_type = 'exam' AND up.score IS NOT NULL THEN up.score END) AS exam_max_score,
                    MAX(CASE WHEN mi.item_type = 'exam' AND up.score IS NOT NULL THEN COALESCE(up.original_score, up.score) END) AS exam_original_score,
                    MAX(CASE WHEN mi.item_type = 'exam' AND up.score IS NOT NULL THEN up.score_adjustment END) AS exam_score_adjustment,
                    MAX(CASE WHEN mi.item_type = 'exam' AND up.score IS NOT NULL THEN up.adjustment_reason END) AS exam_adjustment_reason,
                    MAX(CASE WHEN mi.item_type = 'exam' AND up.score IS NOT NULL THEN up.adjusted_at END) AS exam_adjusted_at,
                    MAX(CASE WHEN mi.item_type = 'exam' AND up.score IS NOT NULL THEN up.module_item_id END) AS exam_module_item_id
             FROM session_participants sp
             JOIN users u ON sp.user_id = u.id
             LEFT JOIN participant_profiles p ON sp.user_id = p.user_id
             LEFT JOIN user_progress up ON up.user_id = sp.user_id AND up.session_id = sp.session_id
             LEFT JOIN module_items mi ON mi.id = up.module_item_id
             WHERE sp.session_id = ?
             GROUP BY sp.id, sp.user_id, u.username, u.full_name, p.nip, p.id_card_number, p.institution, p.batch,
                      sp.graduation_status, sp.graduation_decided_at, sp.graduation_notes,
                      sp.skl_number, sp.skl_generated_at, sp.certificate_file_url,
                      sp.certificate_number, sp.certificate_uploaded_at
             ORDER BY completed_items DESC, u.full_name ASC`,
            [resolvedParams.id]
        );

        const participantsWithDetail = participants.map(p => {
            const userItems = progressByUser.get(p.user_id) || [];
            const openItem = userItems.find(ui => ui.item_status === 'open');
            const completedCount = Number(p.completed_items || 0);

            let currentActivity = {
                type: 'not_started' as 'exam' | 'training' | 'completed' | 'in_between' | 'not_started',
                title: null as string | null,
                item_type: null as 'exam' | 'training' | null,
                label: 'Belum Memulai',
                last_activity_at: null as string | null,
            };

            if (openItem) {
                const isExam = openItem.item_type === 'exam';
                currentActivity = {
                    type: isExam ? 'exam' : 'training',
                    title: openItem.item_title,
                    item_type: openItem.item_type,
                    label: isExam ? 'Sedang Mengerjakan Ujian' : 'Sedang Membuka Materi',
                    last_activity_at: openItem.updated_at || openItem.last_attempt_start || null,
                };
            } else if (totalItems > 0 && completedCount >= totalItems) {
                currentActivity = {
                    type: 'completed',
                    title: null,
                    item_type: null,
                    label: 'Selesai Semua Modul',
                    last_activity_at: userItems[0]?.updated_at || null,
                };
            } else if (completedCount > 0) {
                const nextItem = (moduleItems || []).find((mi: any) => !userItems.some((ui: any) => ui.module_item_id === mi.id && ui.item_status === 'completed'));
                currentActivity = {
                    type: 'in_between',
                    title: nextItem?.title || null,
                    item_type: nextItem?.item_type || null,
                    label: nextItem ? `Menunggu Melanjutkan: ${nextItem.title}` : 'Selesai Sebagian',
                    last_activity_at: userItems[0]?.updated_at || null,
                };
            }

            return {
                id: p.user_id,
                session_participant_id: p.session_participant_id,
                username: p.username,
                full_name: p.full_name || p.username,
                id_card_number: p.id_card_number || null,
                nip: p.nip || null,
                institution: p.institution || null,
                batch: p.batch || '1',
                completed_items: completedCount,
                total_items: totalItems,
                progress: totalItems > 0 ? Math.round((completedCount / totalItems) * 100) : 0,
                current_activity: currentActivity,
                graduation_status: p.graduation_status || 'pending',
                graduation_decided_at: p.graduation_decided_at || null,
                graduation_notes: p.graduation_notes || null,
                skl_number: p.skl_number || null,
                skl_generated_at: p.skl_generated_at || null,
                certificate_file_url: p.certificate_file_url || null,
                certificate_number: p.certificate_number || null,
                certificate_uploaded_at: p.certificate_uploaded_at || null,
                final_score: p.exam_max_score !== null && p.exam_max_score !== undefined ? Number(p.exam_max_score) : null,
                original_score: p.exam_original_score !== null && p.exam_original_score !== undefined
                    ? Number(p.exam_original_score)
                    : (p.exam_max_score !== null && p.exam_max_score !== undefined ? Number(p.exam_max_score) : null),
                score_adjustment: p.exam_score_adjustment !== null && p.exam_score_adjustment !== undefined
                    ? Number(p.exam_score_adjustment)
                    : 0,
                adjustment_reason: p.exam_adjustment_reason || null,
                adjusted_at: p.exam_adjusted_at || null,
                exam_module_item_id: p.exam_module_item_id || null,
                avg_score: p.exam_avg_score !== null && p.exam_avg_score !== undefined ? Number(p.exam_avg_score) : null,
            };
        });

        return NextResponse.json({
            success: true,
            data: {
                ...session,
                start_time: normalizeDbDateToIso(session.start_time),
                end_time: normalizeDbDateToIso(session.end_time),
                require_seb: Boolean(session.require_seb),
                show_score: session.show_score === 1 || session.show_score === true || session.show_score === '1',
                enable_proctoring: session.enable_proctoring === 1 || session.enable_proctoring === true || session.enable_proctoring === '1',
                total_items: totalItems,
                module_items: moduleItems,
                participants: participantsWithDetail,
            }
        });
    } catch (error) {
        logger.error('GET_SESSION_DETAIL', 'Gagal memuat detail sesi', error);
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

        const { module_id, title, start_time, end_time, require_seb, show_score, enable_proctoring, participant_ids } = parsed.data;
        const sebConfigKey = require_seb ? process.env.SEB_CONFIG_KEY_HASH || null : null;

        connection = await pool.getConnection();
        await connection.beginTransaction();

        // Update session with normalized WIB timestamps and strict boolean flags
        await connection.execute(
            `UPDATE sessions 
             SET module_id = ?, title = ?, start_time = ?, end_time = ?, require_seb = ?, show_score = ?, enable_proctoring = ?, seb_config_key = ? 
             WHERE id = ?`,
            [
                module_id,
                title,
                toMysqlDatetimeWib(start_time),
                toMysqlDatetimeWib(end_time),
                Boolean(require_seb),
                Boolean(show_score),
                Boolean(enable_proctoring),
                sebConfigKey,
                resolvedParams.id
            ]
        );

        // Diff-based synchronization: Preserves graduation_status, SKL, & certificate records
        const [existingRows] = await connection.execute<any[]>(
            `SELECT user_id FROM session_participants WHERE session_id = ?`,
            [resolvedParams.id]
        );
        const existingUserIds = new Set<string>((existingRows || []).map((r: any) => String(r.user_id)));
        const targetUserIds = new Set<string>((participant_ids || []).map((id: string) => String(id)));

        // Remove participants that were unselected
        const userIdsToRemove = Array.from(existingUserIds).filter(id => !targetUserIds.has(id));
        if (userIdsToRemove.length > 0) {
            const placeholders = userIdsToRemove.map(() => '?').join(',');
            await connection.execute(
                `DELETE FROM session_participants WHERE session_id = ? AND user_id IN (${placeholders})`,
                [resolvedParams.id, ...userIdsToRemove]
            );
        }

        // Add newly selected participants
        const userIdsToAdd = Array.from(targetUserIds).filter(id => !existingUserIds.has(id));
        for (const userId of userIdsToAdd) {
            const participantId = uuidv4();
            await connection.execute(
                `INSERT INTO session_participants (id, session_id, user_id) VALUES (?, ?, ?)`,
                [participantId, resolvedParams.id, userId]
            );
        }

        await connection.commit();
        connection.release();

        return NextResponse.json({ success: true, message: 'Session updated completely' });
    } catch (error) {
        if (connection) {
            await connection.rollback();
            connection.release();
        }
        logger.error('UPDATE_SESSION', 'Gagal memperbarui sesi', error);
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
        logger.error('DELETE_SESSION', 'Gagal menghapus sesi', error);
        const message = error instanceof Error ? error.message : 'Internal Server Error';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

export const GET = withAuth(handleGet, { allowedRoles: ['admin', 'trainer'] });
export const PUT = withAuth(handlePut, { allowedRoles: ['admin'] });
export const DELETE = withAuth(handleDelete, { allowedRoles: ['admin'] });
