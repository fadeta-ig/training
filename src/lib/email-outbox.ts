import { v4 as uuidv4 } from 'uuid';
import type { PoolConnection } from 'mysql2/promise';
import pool from '@/lib/db';
import { sendCredentialEmail } from '@/lib/email';
import logger from '@/lib/logger';

interface ClaimedEmailJob {
    id: string;
    recipient: string;
    full_name: string;
    initial_password: string;
    attempts: number;
}

interface OutboxCandidate extends ClaimedEmailJob {
    status: 'pending' | 'processing' | 'retry';
}

export async function enqueueCredentialEmail(connection: PoolConnection, userId: string): Promise<void> {
    await connection.execute(
        `INSERT INTO email_outbox (id, user_id, template, status, available_at)
         VALUES (?, ?, 'credential', 'pending', UTC_TIMESTAMP())`,
        [uuidv4(), userId],
    );
}

export async function processEmailOutbox(limit = 25): Promise<{ processed: number; sent: number; failed: number }> {
    const connection = await pool.getConnection();
    let jobs: ClaimedEmailJob[] = [];
    try {
        await connection.beginTransaction();
        const [rows] = await connection.execute<OutboxCandidate[] & any[]>(
            `SELECT eo.id, u.username AS recipient, u.full_name,
                    pp.initial_password, eo.attempts, eo.status
             FROM email_outbox eo
             INNER JOIN users u ON u.id = eo.user_id
             LEFT JOIN participant_profiles pp ON pp.user_id = eo.user_id
             WHERE (
                    (eo.status IN ('pending', 'retry') AND eo.available_at <= UTC_TIMESTAMP())
                    OR (eo.status = 'processing' AND eo.locked_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL 10 MINUTE))
                   )
               AND eo.template = 'credential'
             ORDER BY eo.created_at ASC
             LIMIT ?
             FOR UPDATE SKIP LOCKED`,
            [Math.min(Math.max(limit, 1), 100)],
        );
        jobs = rows.filter((row) => Boolean(row.recipient && row.initial_password));
        const invalidJobs = rows.filter((row) => !row.recipient || !row.initial_password);
        if (invalidJobs.length > 0) {
            const placeholders = invalidJobs.map(() => '?').join(',');
            await connection.execute(
                `UPDATE email_outbox
                 SET status = 'failed', attempts = attempts + 1,
                     last_error = 'Credential recipient or initial password is unavailable', locked_at = NULL
                 WHERE id IN (${placeholders})`,
                invalidJobs.map((job) => job.id),
            );
        }
        if (jobs.length > 0) {
            const placeholders = jobs.map(() => '?').join(',');
            await connection.execute(
                `UPDATE email_outbox SET status = 'processing', locked_at = UTC_TIMESTAMP()
                 WHERE id IN (${placeholders})`,
                jobs.map((job) => job.id),
            );
        }
        await connection.commit();
    } catch (error) {
        await connection.rollback().catch(() => undefined);
        throw error;
    } finally {
        connection.release();
    }

    let sent = 0;
    let failed = 0;
    for (const job of jobs) {
        try {
            await sendCredentialEmail(job.recipient, job.full_name, job.initial_password);
            await pool.execute(
                `UPDATE email_outbox SET status = 'sent', sent_at = UTC_TIMESTAMP(), last_error = NULL
                 WHERE id = ? AND status = 'processing'`,
                [job.id],
            );
            sent += 1;
        } catch (error) {
            const attempts = Number(job.attempts || 0) + 1;
            const nextStatus = attempts >= 3 ? 'failed' : 'retry';
            const delayMinutes = Math.min(60, 2 ** attempts);
            await pool.execute(
                `UPDATE email_outbox
                 SET status = ?, attempts = ?, last_error = ?,
                     available_at = DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? MINUTE), locked_at = NULL
                 WHERE id = ?`,
                [
                    nextStatus,
                    attempts,
                    error instanceof Error ? error.message.slice(0, 500) : 'Unknown email error',
                    delayMinutes,
                    job.id,
                ],
            );
            failed += 1;
        }
    }

    if (jobs.length > 0) {
        logger.info('EMAIL_OUTBOX', `Outbox selesai: ${sent} terkirim, ${failed} ditunda/gagal`);
    }
    return { processed: jobs.length, sent, failed };
}
