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
    console.log('📦 Checking table user_progress for score adjustment columns...');

    // 1. Check & add original_score
    const [origScoreCols] = await connection.execute(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'user_progress' AND COLUMN_NAME = 'original_score'`,
      [dbConfig.database]
    );

    if (origScoreCols.length === 0) {
      console.log('➕ Adding `original_score` DECIMAL(5, 2) NULL...');
      await connection.execute(
        `ALTER TABLE user_progress ADD COLUMN original_score DECIMAL(5, 2) NULL AFTER score`
      );
      // Backfill existing scores as original_score
      await connection.execute(
        `UPDATE user_progress SET original_score = score WHERE score IS NOT NULL AND original_score IS NULL`
      );
      console.log('✅ Column `original_score` added and backfilled.');
    } else {
      console.log('ℹ️ Column `original_score` already exists.');
    }

    // 2. Check & add score_adjustment
    const [adjScoreCols] = await connection.execute(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'user_progress' AND COLUMN_NAME = 'score_adjustment'`,
      [dbConfig.database]
    );

    if (adjScoreCols.length === 0) {
      console.log('➕ Adding `score_adjustment` DECIMAL(5, 2) NOT NULL DEFAULT 0.00...');
      await connection.execute(
        `ALTER TABLE user_progress ADD COLUMN score_adjustment DECIMAL(5, 2) NOT NULL DEFAULT 0.00 AFTER original_score`
      );
      console.log('✅ Column `score_adjustment` added.');
    } else {
      console.log('ℹ️ Column `score_adjustment` already exists.');
    }

    // 3. Check & add adjustment_reason
    const [reasonCols] = await connection.execute(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'user_progress' AND COLUMN_NAME = 'adjustment_reason'`,
      [dbConfig.database]
    );

    if (reasonCols.length === 0) {
      console.log('➕ Adding `adjustment_reason` VARCHAR(255) NULL...');
      await connection.execute(
        `ALTER TABLE user_progress ADD COLUMN adjustment_reason VARCHAR(255) NULL AFTER score_adjustment`
      );
      console.log('✅ Column `adjustment_reason` added.');
    } else {
      console.log('ℹ️ Column `adjustment_reason` already exists.');
    }

    // 4. Check & add adjusted_by
    const [byCols] = await connection.execute(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'user_progress' AND COLUMN_NAME = 'adjusted_by'`,
      [dbConfig.database]
    );

    if (byCols.length === 0) {
      console.log('➕ Adding `adjusted_by` VARCHAR(36) NULL...');
      await connection.execute(
        `ALTER TABLE user_progress ADD COLUMN adjusted_by VARCHAR(36) NULL AFTER adjustment_reason`
      );
      console.log('✅ Column `adjusted_by` added.');
    } else {
      console.log('ℹ️ Column `adjusted_by` already exists.');
    }

    // 5. Check & add adjusted_at
    const [atCols] = await connection.execute(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'user_progress' AND COLUMN_NAME = 'adjusted_at'`,
      [dbConfig.database]
    );

    if (atCols.length === 0) {
      console.log('➕ Adding `adjusted_at` DATETIME NULL...');
      await connection.execute(
        `ALTER TABLE user_progress ADD COLUMN adjusted_at DATETIME NULL AFTER adjusted_by`
      );
      console.log('✅ Column `adjusted_at` added.');
    } else {
      console.log('ℹ️ Column `adjusted_at` already exists.');
    }

    // 6. Check & add FK fk_progress_adjusted_by if not exists
    const [fkCols] = await connection.execute(
      `SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'user_progress' AND CONSTRAINT_NAME = 'fk_progress_adjusted_by'`,
      [dbConfig.database]
    );

    if (fkCols.length === 0) {
      try {
        console.log('🔗 Adding foreign key constraint `fk_progress_adjusted_by`...');
        await connection.execute(
          `ALTER TABLE user_progress ADD CONSTRAINT fk_progress_adjusted_by
           FOREIGN KEY (adjusted_by) REFERENCES users(id) ON DELETE SET NULL`
        );
        console.log('✅ Foreign key `fk_progress_adjusted_by` added.');
      } catch (fkErr) {
        console.warn('⚠️ Note on FK constraint:', fkErr.message);
      }
    } else {
      console.log('ℹ️ Foreign key constraint `fk_progress_adjusted_by` already exists.');
    }

    console.log('\n🎉 All score adjustment migrations completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

runMigration();
