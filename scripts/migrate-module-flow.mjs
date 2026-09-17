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

async function runMigration() {
  console.log('🚀 Connecting to MySQL Database...');
  const connection = await mysql.createConnection(dbConfig);

  try {
    console.log('📦 Checking table `modules` for `enforce_sequence` column...');

    const [cols] = await connection.execute(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'modules' AND COLUMN_NAME = 'enforce_sequence'`,
      [dbConfig.database]
    );

    if (cols.length === 0) {
      console.log('➕ Adding `enforce_sequence` BOOLEAN NOT NULL DEFAULT FALSE...');
      await connection.execute(
        `ALTER TABLE modules ADD COLUMN enforce_sequence BOOLEAN NOT NULL DEFAULT FALSE AFTER description`
      );
      // Ensure all existing rows have 0 (FALSE)
      await connection.execute(
        `UPDATE modules SET enforce_sequence = FALSE WHERE enforce_sequence IS NULL`
      );
      console.log('✅ Column `enforce_sequence` added and defaulted to FALSE (Unlocked Mode).');
    } else {
      console.log('ℹ️ Column `enforce_sequence` already exists.');
    }

    console.log('\n🎉 Module flow migration finished successfully.');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

runMigration();
