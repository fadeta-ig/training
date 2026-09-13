import mysql from 'mysql2/promise';
import fs from 'node:fs';
import path from 'node:path';

function loadEnv() {
  for (const file of ['.env.local', '.env', '.env.production']) {
    const envPath = path.join(process.cwd(), file);
    if (!fs.existsSync(envPath)) continue;

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
}

loadEnv();

const dbConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'lms_antigravity',
};

async function runDropTitlesMigration() {
  console.log(`🚀 Connecting to MySQL Database on ${dbConfig.host}:${dbConfig.port}...`);
  const connection = await mysql.createConnection(dbConfig);

  try {
    console.log('📦 Checking table participant_profiles for front_title and back_title...');

    const [columns] = await connection.execute(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'participant_profiles'`,
      [dbConfig.database]
    );

    const existingCols = new Set(columns.map((c) => c.COLUMN_NAME));

    if (existingCols.has('front_title')) {
      console.log('🗑️ Dropping column front_title...');
      await connection.execute(`ALTER TABLE participant_profiles DROP COLUMN front_title`);
      console.log('✅ Column front_title dropped successfully.');
    } else {
      console.log('ℹ️ Column front_title does not exist.');
    }

    if (existingCols.has('back_title')) {
      console.log('🗑️ Dropping column back_title...');
      await connection.execute(`ALTER TABLE participant_profiles DROP COLUMN back_title`);
      console.log('✅ Column back_title dropped successfully.');
    } else {
      console.log('ℹ️ Column back_title does not exist.');
    }

    if (!existingCols.has('id_card_number')) {
      console.log('➕ Ensuring column id_card_number exists...');
      await connection.execute(`ALTER TABLE participant_profiles ADD COLUMN id_card_number VARCHAR(50) NULL AFTER nip`);
      await connection.execute(`ALTER TABLE participant_profiles ADD INDEX idx_participant_id_card (id_card_number)`).catch(() => {});
      console.log('✅ Column id_card_number ensured.');
    }

    console.log('\n🎉 Migration completed: Titles removed from participant_profiles.');
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

runDropTitlesMigration();
