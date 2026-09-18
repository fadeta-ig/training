import type { PoolConnection } from 'mysql2/promise';

export const ROMAN_MONTHS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

/**
 * Formats standard SKL number string: [SEQ]/E/SK/[ROMAN_MONTH]/[YEAR]
 * Example: 001/E/SK/IX/2026
 */
export function formatSklNumber(sequence: number, romanMonth: string, year: number): string {
    const seqStr = String(sequence).padStart(3, '0');
    return `${seqStr}/E/SK/${romanMonth}/${year}`;
}

/** Resolve the official SKL month/year in the application's Jakarta business timezone. */
export function getSklPeriod(value: string | Date | null = null): { romanMonth: string; year: number } {
    if (typeof value === 'string') {
        const match = /^(\d{4})-(\d{2})/.exec(value.trim());
        if (match) {
            const month = Number(match[2]);
            return { romanMonth: ROMAN_MONTHS[month - 1] || 'I', year: Number(match[1]) };
        }
    }

    const date = value instanceof Date ? value : new Date();
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Jakarta',
        year: 'numeric',
        month: 'numeric',
    }).formatToParts(date);
    const year = Number(parts.find((part) => part.type === 'year')?.value || date.getUTCFullYear());
    const month = Number(parts.find((part) => part.type === 'month')?.value || date.getUTCMonth() + 1);
    return { romanMonth: ROMAN_MONTHS[month - 1] || 'I', year };
}

/** Atomically reserves one SKL sequence using a dedicated, indexed counter row. */
export async function reserveNextSklSequence(
    connection: PoolConnection,
    romanMonth: string,
    year: number
): Promise<number> {
    const scopeKey = `skl:${year}:${romanMonth}`;
    let [sequenceRows] = await connection.execute<Array<{ next_value: number | string }> & any[]>(
        'SELECT next_value FROM document_sequences WHERE scope_key = ? FOR UPDATE',
        [scopeKey],
    );
    if (sequenceRows.length === 0) {
        const pattern = `%/E/SK/${romanMonth}/${year}`;
        const [maximumRows] = await connection.execute<Array<{ maximum: number | string | null }> & any[]>(
            `SELECT COALESCE(MAX(CAST(SUBSTRING_INDEX(skl_number, '/', 1) AS UNSIGNED)), 0) AS maximum
             FROM session_participants
             WHERE skl_number LIKE ?`,
            [pattern],
        );
        const initialNext = Number(maximumRows[0]?.maximum || 0) + 1;
        await connection.execute(
            `INSERT INTO document_sequences (scope_key, next_value)
             VALUES (?, ?)
             ON DUPLICATE KEY UPDATE scope_key = VALUES(scope_key)`,
            [scopeKey, initialNext],
        );
        [sequenceRows] = await connection.execute<Array<{ next_value: number | string }> & any[]>(
            'SELECT next_value FROM document_sequences WHERE scope_key = ? FOR UPDATE',
            [scopeKey],
        );
    }
    const reserved = Number(sequenceRows[0]?.next_value);
    if (!Number.isSafeInteger(reserved) || reserved < 1) {
        throw new Error('Counter nomor SKL tidak valid');
    }
    await connection.execute(
        'UPDATE document_sequences SET next_value = ? WHERE scope_key = ?',
        [reserved + 1, scopeKey],
    );

    return reserved;
}
