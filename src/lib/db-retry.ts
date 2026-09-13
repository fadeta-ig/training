import logger from '@/lib/logger';

export interface RetryOptions {
    maxRetries?: number;
    initialBackoffMs?: number;
    maxBackoffMs?: number;
}

const TRANSIENT_ERROR_CODES = new Set([
    'ER_LOCK_DEADLOCK',
    'ER_LOCK_WAIT_TIMEOUT',
    'PROTOCOL_CONNECTION_LOST',
    'ECONNRESET',
    'ETIMEDOUT',
]);

const TRANSIENT_ERRNOS = new Set([
    1213, // ER_LOCK_DEADLOCK
    1205, // ER_LOCK_WAIT_TIMEOUT
]);

/**
 * Checks if a database error is a transient lock contention or connection failure.
 */
export function isTransientDbError(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;
    const err = error as { code?: string; errno?: number; message?: string };
    if (err.code && TRANSIENT_ERROR_CODES.has(err.code)) return true;
    if (typeof err.errno === 'number' && TRANSIENT_ERRNOS.has(err.errno)) return true;
    const msg = err.message ? err.message.toLowerCase() : '';
    return msg.includes('deadlock') || msg.includes('lock wait timeout');
}

/**
 * Executes a database operation with bounded retry on transient deadlocks or lock wait timeouts.
 * Employs exponential backoff with full jitter to eliminate retry collisions.
 */
export async function executeWithRetry<T>(
    operation: (attempt: number) => Promise<T>,
    options: RetryOptions = {}
): Promise<T> {
    const maxRetries = options.maxRetries ?? 3;
    const initialBackoff = options.initialBackoffMs ?? 50;
    const maxBackoff = options.maxBackoffMs ?? 500;

    let lastError: unknown;

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
        try {
            return await operation(attempt);
        } catch (error) {
            lastError = error;
            const isTransient = isTransientDbError(error);
            const isLastAttempt = attempt > maxRetries;

            if (!isTransient || isLastAttempt) {
                throw error;
            }

            // Exponential backoff with full jitter
            const rawBackoff = Math.min(maxBackoff, initialBackoff * Math.pow(2, attempt - 1));
            const jitteredBackoff = Math.floor(Math.random() * rawBackoff) + 10;

            logger.warn('DB_RETRY', `Transient DB lock contention detected. Retrying attempt ${attempt}/${maxRetries} in ${jitteredBackoff}ms`, {
                attempt,
                delayMs: jitteredBackoff,
                error: error instanceof Error ? error.message : String(error),
            });

            await new Promise((resolve) => setTimeout(resolve, jitteredBackoff));
        }
    }

    throw lastError;
}
