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
    console.log('📦 Checking table participant_profiles for security columns...');

    // 1. Check & modify gender nullability
    const [genderCols] = await connection.execute(
      `SELECT COLUMN_NAME, IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'participant_profiles' AND COLUMN_NAME = 'gender'`,
      [dbConfig.database]
    );

    if (genderCols.length > 0 && genderCols[0].IS_NULLABLE === 'NO') {
      console.log('🔄 Modifying `gender` to nullable ENUM(\'L\', \'P\') NULL DEFAULT NULL...');
      await connection.execute(
        `ALTER TABLE participant_profiles MODIFY COLUMN gender ENUM('L', 'P') NULL DEFAULT NULL`
      );
      console.log('✅ Column `gender` is now nullable.');
    } else {
      console.log('ℹ️ Column `gender` is already nullable or formatted.');
    }

    // 2. Check & add must_change_password
    const [mustChangeCols] = await connection.execute(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'participant_profiles' AND COLUMN_NAME = 'must_change_password'`,
      [dbConfig.database]
    );

    if (mustChangeCols.length === 0) {
      console.log('➕ Adding column `must_change_password` to participant_profiles (DEFAULT FALSE for existing users)...');
      await connection.execute(
        `ALTER TABLE participant_profiles ADD COLUMN must_change_password BOOLEAN NOT NULL DEFAULT FALSE AFTER initial_password`
      );
      console.log('✅ Column `must_change_password` added successfully (existing users default to 0/safe).');
    } else {
      console.log('ℹ️ Column `must_change_password` already exists.');
    }

    console.log('\n🎉 Security columns migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await connection.end();
  }
}

runMigration();
