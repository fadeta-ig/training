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
    console.log('📦 Checking table participant_profiles for `initial_password` column...');

    const [columns] = await connection.execute(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'participant_profiles' AND COLUMN_NAME = 'initial_password'`,
      [dbConfig.database]
    );

    if (columns.length === 0) {
      console.log('➕ Adding column `initial_password` to participant_profiles...');
      await connection.execute(
        `ALTER TABLE participant_profiles ADD COLUMN initial_password VARCHAR(255) NULL AFTER registration_date`
      );
      console.log('✅ Column `initial_password` added successfully.');
    } else {
      console.log('ℹ️ Column `initial_password` already exists.');
    }

    console.log('\n🎉 Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await connection.end();
  }
}

runMigration();
