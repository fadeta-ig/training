import mysql from 'mysql2/promise';
import fs from 'node:fs';
import path from 'node:path';

// 1. Parse .env.local if present
function loadEnv() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return;

  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    process.env[key] = value;
  }
}

loadEnv();

const dbConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'lms_antigravity',
};

const NOISE_WORDS = new Set([
  'PT', 'CV', 'TBK', 'PERSERO', 'PERUM', 'YAYASAN', 'LEMBAGA', 'DAN', 'OF', 'THE', 'AND', 'CORP', 'INC', 'CO'
]);

function extractInstitutionCode(institutionName) {
  if (!institutionName || !institutionName.trim()) return 'GEN';
  const clean = institutionName.replace(/[^\w\s]/gi, ' ').trim().toUpperCase();
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'GEN';
  let significantWords = words.filter((w) => !NOISE_WORDS.has(w));
  if (significantWords.length === 0) significantWords = words;
  if (significantWords.length === 1) {
    const single = significantWords[0];
    if (single.length <= 4) return single;
    const consonants = single.replace(/[AEIOU]/g, '');
    if (consonants.length >= 3) return consonants.slice(0, 4);
    return single.slice(0, 4);
  }
  const initials = significantWords.map((w) => w[0]).join('');
  if (initials.length >= 2) return initials.slice(0, 5);
  return clean.slice(0, 4).replace(/\s/g, '') || 'GEN';
}

function formatYearMonth(dateInput) {
  const date = dateInput ? new Date(dateInput) : new Date();
  const validDate = isNaN(date.getTime()) ? new Date() : date;
  const yy = String(validDate.getUTCFullYear()).slice(-2);
  const mm = String(validDate.getUTCMonth() + 1).padStart(2, '0');
  return `${yy}${mm}`;
}

async function runMigration() {
  console.log('🚀 Connecting to MySQL Database...');
  const connection = await mysql.createConnection(dbConfig);

  try {
    console.log('📦 Checking and altering table participant_profiles...');

    // Check existing columns in participant_profiles
    const [columns] = await connection.execute(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'participant_profiles'`,
      [dbConfig.database]
    );
    const existingCols = new Set(columns.map((c) => c.COLUMN_NAME));

    if (!existingCols.has('nip')) {
      console.log('➕ Adding column `nip`...');
      await connection.execute(`ALTER TABLE participant_profiles ADD COLUMN nip VARCHAR(50) UNIQUE NULL AFTER user_id`);
    }
    if (!existingCols.has('institution_code')) {
      console.log('➕ Adding column `institution_code`...');
      await connection.execute(`ALTER TABLE participant_profiles ADD COLUMN institution_code VARCHAR(20) NULL AFTER institution`);
    }
    if (!existingCols.has('batch')) {
      console.log('➕ Adding column `batch`...');
      await connection.execute(`ALTER TABLE participant_profiles ADD COLUMN batch INT NOT NULL DEFAULT 1 AFTER institution_code`);
    }
    if (!existingCols.has('registration_date')) {
      console.log('➕ Adding column `registration_date`...');
      await connection.execute(`ALTER TABLE participant_profiles ADD COLUMN registration_date DATE NOT NULL DEFAULT (CURRENT_DATE) AFTER batch`);
    }

    // Check indexes
    const [indexes] = await connection.execute(
      `SHOW INDEX FROM participant_profiles WHERE Key_name IN ('idx_participant_nip', 'idx_participant_inst_batch', 'idx_participant_reg_date')`
    );
    const existingIndexes = new Set(indexes.map((idx) => idx.Key_name));

    if (!existingIndexes.has('idx_participant_nip')) {
      await connection.execute(`ALTER TABLE participant_profiles ADD INDEX idx_participant_nip (nip)`);
    }
    if (!existingIndexes.has('idx_participant_inst_batch')) {
      await connection.execute(`ALTER TABLE participant_profiles ADD INDEX idx_participant_inst_batch (institution, batch)`);
    }
    if (!existingIndexes.has('idx_participant_reg_date')) {
      await connection.execute(`ALTER TABLE participant_profiles ADD INDEX idx_participant_reg_date (registration_date)`);
    }

    console.log('🔍 Checking existing participants for NIP backfill...');
    const [trainees] = await connection.execute(`
      SELECT p.id as profile_id, p.user_id, p.institution, p.batch, p.registration_date, p.created_at, p.nip, u.full_name
      FROM participant_profiles p
      JOIN users u ON p.user_id = u.id
      ORDER BY p.institution ASC, p.created_at ASC
    `);

    console.log(`📋 Found ${trainees.length} participant profiles.`);

    const groupSequences = new Map();
    let updatedCount = 0;

    for (const t of trainees) {
      if (t.nip) {
        console.log(`  ✓ Participant ${t.full_name} already has NIP: ${t.nip}`);
        continue;
      }

      const instName = (t.institution || '').trim();
      const batch = t.batch || 1;
      const regDate = t.registration_date || (t.created_at ? new Date(t.created_at).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10));
      const yearMonth = formatYearMonth(regDate);
      const instCode = extractInstitutionCode(instName);
      const groupKey = `${instName}:::${batch}:::${yearMonth}`;

      const seq = (groupSequences.get(groupKey) || 0) + 1;
      groupSequences.set(groupKey, seq);

      const batchStr = String(batch).padStart(2, '0');
      const seqStr = String(seq).padStart(3, '0');
      const generatedNip = `${instCode}-B${batchStr}-${yearMonth}-${seqStr}`;

      await connection.execute(
        `UPDATE participant_profiles 
         SET nip = ?, institution_code = ?, batch = ?, registration_date = ? 
         WHERE id = ?`,
        [generatedNip, instCode, batch, regDate, t.profile_id]
      );

      console.log(`  ✨ Assigned NIP ${generatedNip} to ${t.full_name} (${instName || 'No Institution'} - Batch ${batch})`);
      updatedCount++;
    }

    console.log(`🎉 Migration complete! ${updatedCount} participants backfilled with NIP.`);
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

runMigration();
