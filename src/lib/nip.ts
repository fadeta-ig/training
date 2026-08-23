import type { PoolConnection } from 'mysql2/promise';

/**
 * Common noise words in Indonesian & English corporate / organizational names
 * that should be skipped when generating multi-word acronyms.
 */
const NOISE_WORDS = new Set([
  'PT',
  'CV',
  'TBK',
  'PERSERO',
  'PERUM',
  'YAYASAN',
  'LEMBAGA',
  'DAN',
  'DAN/ATAU',
  'OF',
  'THE',
  'AND',
  'FOR',
  'IN',
  'CORP',
  'CORPORATION',
  'INC',
  'INCORPORATED',
  'LTD',
  'LIMITED',
  'CO',
  'COMPANY',
  'LLC',
]);

/**
 * Extracts a concise 2-5 character uppercase institution code from an institution name.
 * 
 * Examples:
 * - "PT Telekomunikasi Indonesia" -> "TLKM"
 * - "RSUD Dr. Soetomo" -> "RDS"
 * - "Universitas Gadjah Mada" -> "UGM"
 * - "Politeknik Negeri Malang" -> "PNM"
 * - "Pertamina" -> "PTM"
 * - "Nusamitra" -> "NSM"
 * - "" / null -> "GEN"
 */
export function extractInstitutionCode(institutionName?: string | null): string {
  if (!institutionName || !institutionName.trim()) {
    return 'GEN';
  }

  // Normalize: remove special characters (keep alphanumeric and spaces)
  const clean = institutionName
    .replace(/[^\w\s]/gi, ' ')
    .trim()
    .toUpperCase();

  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return 'GEN';
  }

  // Filter out noise words if there are multiple words
  let significantWords = words.filter((w) => !NOISE_WORDS.has(w));
  if (significantWords.length === 0) {
    significantWords = words;
  }

  if (significantWords.length === 1) {
    const single = significantWords[0];
    if (single.length <= 4) {
      return single;
    }
    // Take first letter + consonants or first 3-4 letters
    const consonants = single.replace(/[AEIOU]/g, '');
    if (consonants.length >= 3) {
      return consonants.slice(0, 4);
    }
    return single.slice(0, 4);
  }

  // Multi-word: take first letter of each significant word (up to 4 chars)
  const initials = significantWords.map((w) => w[0]).join('');
  if (initials.length >= 2) {
    return initials.slice(0, 5);
  }

  return clean.slice(0, 4).replace(/\s/g, '') || 'GEN';
}

/**
 * Extracts Year-Month format (YYMM) from a date string or Date object.
 * Defaults to current date if invalid.
 */
export function formatYearMonth(dateInput?: string | Date | null): string {
  let date: Date;

  if (dateInput instanceof Date && !isNaN(dateInput.getTime())) {
    date = dateInput;
  } else if (typeof dateInput === 'string' && dateInput.trim()) {
    const parsed = new Date(dateInput.includes('T') ? dateInput : `${dateInput.trim()}T00:00:00Z`);
    date = isNaN(parsed.getTime()) ? new Date() : parsed;
  } else {
    date = new Date();
  }

  const yy = String(date.getUTCFullYear()).slice(-2);
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${yy}${mm}`;
}

/**
 * Formats standard NIP string: [CODE]-B[BATCH]-[YYMM]-[SEQ]
 * Example: TLKM-B01-2608-001
 */
export function formatNip(
  institutionCode: string,
  batch: number,
  yearMonth: string,
  sequence: number
): string {
  const safeCode = (institutionCode || 'GEN').toUpperCase().trim();
  const safeBatch = Math.max(1, Math.floor(batch || 1));
  const batchStr = String(safeBatch).padStart(2, '0');
  const seqStr = String(sequence).padStart(3, '0');

  return `${safeCode}-B${batchStr}-${yearMonth}-${seqStr}`;
}

/**
 * Resolves the highest sequence number existing in DB for a specific institution, batch, and yearMonth prefix.
 */
export async function getLatestSequence(
  connection: PoolConnection,
  institution: string | null,
  batch: number,
  yearMonth: string,
  institutionCode: string
): Promise<number> {
  const prefix = `${institutionCode}-B${String(batch).padStart(2, '0')}-${yearMonth}-%`;

  const [rows] = await connection.execute<any[]>(
    `SELECT nip FROM participant_profiles 
     WHERE (institution = ? OR (institution IS NULL AND ? IS NULL))
       AND batch = ?
       AND nip LIKE ?
     ORDER BY nip DESC
     LIMIT 50`,
    [institution || null, institution || null, batch, prefix]
  );

  if (!Array.isArray(rows) || rows.length === 0) {
    return 0;
  }

  let maxSeq = 0;
  for (const row of rows) {
    if (typeof row.nip === 'string') {
      const parts = row.nip.split('-');
      const lastPart = parts[parts.length - 1];
      const seq = parseInt(lastPart, 10);
      if (!isNaN(seq) && seq > maxSeq) {
        maxSeq = seq;
      }
    }
  }

  return maxSeq;
}

export interface NipGenerationItem {
  institution?: string | null;
  batch?: number | null;
  registration_date?: string | Date | null;
}

/**
 * Generates an array of unique, sequential NIPs for bulk items within an active database transaction.
 * Thread-safe / collision-free via in-memory sequence tracking per (institution, batch, yearMonth) group.
 */
export async function generateBulkNips(
  connection: PoolConnection,
  items: NipGenerationItem[]
): Promise<{ nips: string[]; institutionCodes: string[] }> {
  const groupSequences = new Map<string, number>();
  const groupCodes = new Map<string, string>();

  // 1. Identify all unique groups
  for (const item of items) {
    const instName = (item.institution || '').trim();
    const batch = Math.max(1, Math.floor(Number(item.batch) || 1));
    const yearMonth = formatYearMonth(item.registration_date);
    const code = extractInstitutionCode(instName);
    const groupKey = `${instName}:::${batch}:::${yearMonth}`;

    if (!groupSequences.has(groupKey)) {
      groupCodes.set(groupKey, code);
      // Fetch current max sequence from DB
      const currentMax = await getLatestSequence(
        connection,
        instName || null,
        batch,
        yearMonth,
        code
      );
      groupSequences.set(groupKey, currentMax);
    }
  }

  // 2. Increment sequences and build NIPs
  const nips: string[] = [];
  const institutionCodes: string[] = [];

  for (const item of items) {
    const instName = (item.institution || '').trim();
    const batch = Math.max(1, Math.floor(Number(item.batch) || 1));
    const yearMonth = formatYearMonth(item.registration_date);
    const groupKey = `${instName}:::${batch}:::${yearMonth}`;

    const code = groupCodes.get(groupKey) || 'GEN';
    const nextSeq = (groupSequences.get(groupKey) || 0) + 1;
    groupSequences.set(groupKey, nextSeq);

    const nip = formatNip(code, batch, yearMonth, nextSeq);
    nips.push(nip);
    institutionCodes.push(code);
  }

  return { nips, institutionCodes };
}

/**
 * Generates a single NIP for a participant.
 */
export async function generateSingleNip(
  connection: PoolConnection,
  item: NipGenerationItem
): Promise<{ nip: string; institutionCode: string }> {
  const { nips, institutionCodes } = await generateBulkNips(connection, [item]);
  return { nip: nips[0], institutionCode: institutionCodes[0] };
}
