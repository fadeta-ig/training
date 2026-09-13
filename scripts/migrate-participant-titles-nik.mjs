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
    console.log('📦 Checking table participant_profiles for front_title, back_title, id_card_number...');

    const [columns] = await connection.execute(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'participant_profiles'`,
      [dbConfig.database]
    );

    const existingCols = new Set(columns.map((c) => c.COLUMN_NAME));

    if (!existingCols.has('front_title')) {
      console.log('➕ Adding column front_title (VARCHAR(50) NULL)...');
      await connection.execute(
        `ALTER TABLE participant_profiles ADD COLUMN front_title VARCHAR(50) NULL AFTER nip`
      );
      console.log('✅ Column front_title added successfully.');
    } else {
      console.log('ℹ️ Column front_title already exists.');
    }

    if (!existingCols.has('back_title')) {
      console.log('➕ Adding column back_title (VARCHAR(50) NULL)...');
      await connection.execute(
        `ALTER TABLE participant_profiles ADD COLUMN back_title VARCHAR(50) NULL AFTER front_title`
      );
      console.log('✅ Column back_title added successfully.');
    } else {
      console.log('ℹ️ Column back_title already exists.');
    }

    if (!existingCols.has('id_card_number')) {
      console.log('➕ Adding column id_card_number (VARCHAR(50) NULL)...');
      await connection.execute(
        `ALTER TABLE participant_profiles ADD COLUMN id_card_number VARCHAR(50) NULL AFTER back_title`
      );
      console.log('✅ Column id_card_number added successfully.');
    } else {
      console.log('ℹ️ Column id_card_number already exists.');
    }

    const [indexes] = await connection.execute(
      `SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'participant_profiles' AND INDEX_NAME = 'idx_participant_id_card'`,
      [dbConfig.database]
    );

    if (!Array.isArray(indexes) || indexes.length === 0) {
      console.log('⚡ Adding index idx_participant_id_card...');
      await connection.execute(
        `ALTER TABLE participant_profiles ADD INDEX idx_participant_id_card (id_card_number)`
      );
      console.log('✅ Index idx_participant_id_card added successfully.');
    } else {
      console.log('ℹ️ Index idx_participant_id_card already exists.');
    }

    console.log('\n🎉 Participant titles & NIK migration completed successfully!');
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

runMigration();
