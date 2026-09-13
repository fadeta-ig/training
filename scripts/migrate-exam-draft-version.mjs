import mysql from 'mysql2/promise';
import fs from 'node:fs';
import path from 'node:path';

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
  console.log(`🚀 Connecting to MySQL Database on ${dbConfig.host}:${dbConfig.port}...`);
  const connection = await mysql.createConnection(dbConfig);

  try {
    console.log('📦 Checking table exam_answer_drafts for client_version column...');

    const [columns] = await connection.execute(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'exam_answer_drafts'`,
      [dbConfig.database]
    );

    const existingCols = new Set(columns.map((c) => c.COLUMN_NAME));

    if (!existingCols.has('client_version')) {
      console.log('➕ Adding column client_version (INT NOT NULL DEFAULT 1)...');
      await connection.execute(
        `ALTER TABLE exam_answer_drafts ADD COLUMN client_version INT NOT NULL DEFAULT 1 AFTER selected_option`
      );
      console.log('✅ Column client_version added successfully.');
    } else {
      console.log('ℹ️ Column client_version already exists.');
    }

    console.log('🎉 Migration finished successfully!');
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

runMigration();
