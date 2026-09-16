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

/**
 * Fetches the current maximum sequence number for a given Roman month and year.
 * Thread-safe via FOR UPDATE row locks.
 */
export async function getLatestSklSequence(
    connection: PoolConnection,
    romanMonth: string,
    year: number
): Promise<number> {
    const pattern = `%/E/SK/${romanMonth}/${year}`;
    const [rows] = await connection.execute<any[]>(
        `SELECT skl_number FROM session_participants 
         WHERE skl_number LIKE ? 
         FOR UPDATE`,
        [pattern]
    );

    let maxSeq = 0;
    if (Array.isArray(rows)) {
        for (const row of rows) {
            if (typeof row.skl_number === 'string') {
                const parts = row.skl_number.split('/');
                const num = parseInt(parts[0], 10);
                if (!isNaN(num) && num > maxSeq) {
                    maxSeq = num;
                }
            }
        }
    }

    return maxSeq;
}
