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
 * Detects if a batch string is purely numeric (legacy format like '1', '2', '03').
 */
function isNumericBatch(batch: string): boolean {
  return /^\d+$/.test(batch.trim());
}

/**
 * Formats standard NIP string based on batch type:
 * - Numeric batch (legacy):  [CODE]-B[BATCH]-[YYMM]-[SEQ]  e.g. TLKM-B01-2608-001
 * - Custom string batch:     [CODE]-[BATCH]-[SEQ]           e.g. TLKM-CSBA-SEP26-001
 *
 * Custom string batches already encode period info (e.g. SEP26) so YYMM is omitted
 * to avoid redundancy.
 */
export function formatNip(
  institutionCode: string,
  batch: string,
  yearMonth: string,
  sequence: number
): string {
  const safeCode = (institutionCode || 'GEN').toUpperCase().trim();
  const safeBatch = (batch || '1').trim().toUpperCase();
  const seqStr = String(sequence).padStart(3, '0');

  if (isNumericBatch(safeBatch)) {
    // Legacy format: CODE-B01-YYMM-001
    const batchStr = safeBatch.padStart(2, '0');
    return `${safeCode}-B${batchStr}-${yearMonth}-${seqStr}`;
  }

  // Custom batch format: CODE-CSBA-SEP26-001 (YYMM omitted — already in batch string)
  return `${safeCode}-${safeBatch}-${seqStr}`;
}

/**
 * Resolves the highest sequence number existing in DB for a specific institution, batch, and yearMonth prefix.
 * Supports both numeric (legacy) and custom string batches.
 */
export async function getLatestSequence(
  connection: PoolConnection,
  institution: string | null,
  batch: string,
  yearMonth: string,
  institutionCode: string
): Promise<number> {
  const safeBatch = (batch || '1').trim().toUpperCase();

  // Build LIKE prefix matching the NIP format used for this batch type
  const prefix = isNumericBatch(safeBatch)
    ? `${institutionCode}-B${safeBatch.padStart(2, '0')}-${yearMonth}-%`
    : `${institutionCode}-${safeBatch}-%`;

  const [rows] = await connection.execute<any[]>(
    `SELECT nip FROM participant_profiles 
     WHERE (institution = ? OR (institution IS NULL AND ? IS NULL))
       AND batch = ?
       AND nip LIKE ?
     ORDER BY nip DESC
     LIMIT 50`,
    [institution || null, institution || null, safeBatch, prefix]
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
  batch?: string | null;
  registration_date?: string | Date | null;
  registrationDate?: string | Date | null;
}

/**
 * Generates an array of unique, sequential NIPs for bulk items within an active database transaction.
 * Thread-safe / collision-free via in-memory sequence tracking per (institution, batch, yearMonth) group.
 *
 * Backward compatible: batch '1' → CODE-B01-YYMM-001, batch 'CSBA-SEP26' → CODE-CSBA-SEP26-001
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
    const batch = (item.batch || '1').toString().trim();
    const regDate = item.registration_date ?? item.registrationDate;
    const yearMonth = formatYearMonth(regDate);
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
    const batch = (item.batch || '1').toString().trim();
    const yearMonth = formatYearMonth(item.registration_date ?? item.registrationDate);
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
