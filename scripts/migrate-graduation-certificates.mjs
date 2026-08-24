import mysql from 'mysql2/promise';
import fs from 'node:fs';
import path from 'node:path';

function loadEnv() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return {};
  const envContent = fs.readFileSync(envPath, 'utf8');
  const res = {};
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    res[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
  }
  return res;
}

async function main() {
  const env = loadEnv();
  const host = env.DB_HOST || '127.0.0.1';
  const port = Number(env.DB_PORT) || 3307;
  const user = env.DB_USER || 'root';
  const password = env.DB_PASSWORD || '';
  const database = env.DB_NAME || 'lms_antigravity';

  console.log(`[Migration] Connecting to MySQL at ${host}:${port} (${database})...`);
  
  let conn;
  try {
    conn = await mysql.createConnection({ host, port, user, password, database });
    console.log('[Migration] Connected successfully.');

    // Check existing columns in session_participants
    const [columns] = await conn.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'session_participants'
    `, [database]);
    
    const existingCols = new Set(columns.map((c) => c.COLUMN_NAME.toLowerCase()));
    
    const columnsToAdd = [
      { name: 'graduation_status', def: "ENUM('pending', 'passed', 'failed') NOT NULL DEFAULT 'pending'" },
      { name: 'graduation_decided_at', def: "DATETIME NULL" },
      { name: 'graduation_decided_by', def: "VARCHAR(36) NULL" },
      { name: 'graduation_notes', def: "TEXT NULL" },
      { name: 'skl_number', def: "VARCHAR(100) NULL" },
      { name: 'skl_generated_at', def: "DATETIME NULL" },
      { name: 'certificate_file_url', def: "VARCHAR(500) NULL" },
      { name: 'certificate_number', def: "VARCHAR(100) NULL" },
      { name: 'certificate_uploaded_at', def: "DATETIME NULL" }
    ];

    for (const col of columnsToAdd) {
      if (!existingCols.has(col.name.toLowerCase())) {
        console.log(`[Migration] Adding column '${col.name}'...`);
        await conn.query(`ALTER TABLE session_participants ADD COLUMN ${col.name} ${col.def}`);
        console.log(`[Migration] Added '${col.name}'.`);
      } else {
        console.log(`[Migration] Column '${col.name}' already exists.`);
      }
    }

    console.log('[Migration] Adding index for graduation_status...');
    try {
      await conn.query(`ALTER TABLE session_participants ADD INDEX idx_sp_graduation (graduation_status)`);
    } catch {
      // index might already exist
    }

    console.log('[Migration] Database migration completed successfully!');
  } catch (err) {
    console.error('[Migration] Failed:', err.message);
  } finally {
    if (conn) await conn.end();
  }
}

main();
