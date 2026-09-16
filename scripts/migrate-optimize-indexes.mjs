import mysql from 'mysql2/promise';
import fs from 'node:fs';
import path from 'node:path';

// Load .env.local if present
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

async function indexExists(connection, tableName, indexName) {
  const [rows] = await connection.execute(
    `SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND INDEX_NAME = ?
     LIMIT 1`,
    [dbConfig.database, tableName, indexName]
  );
  return Array.isArray(rows) && rows.length > 0;
}

async function runMigration() {
  console.log('🚀 Connecting to MySQL Database...');
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
  } catch (err) {
    console.error(`❌ Could not connect to MySQL (${dbConfig.host}:${dbConfig.port}):`, err.message);
    console.log('ℹ️ Pastikan MySQL service aktif dan port di .env.local sesuai.');
    return;
  }

  try {
    console.log('📦 Checking and creating optimized database indexes...\n');

    // 1. Check idx_module_items_item_id on module_items
    const hasModuleItemIdx = await indexExists(connection, 'module_items', 'idx_module_items_item_id');
    if (!hasModuleItemIdx) {
      console.log('➕ Adding INDEX `idx_module_items_item_id` to table `module_items`...');
      await connection.execute(
        `ALTER TABLE module_items ADD INDEX idx_module_items_item_id (item_id)`
      );
      console.log('✅ Index `idx_module_items_item_id` created successfully.');
    } else {
      console.log('ℹ️ Index `idx_module_items_item_id` already exists on `module_items`.');
    }

    // 2. Check idx_proctor_captured_at on proctor_snapshots
    const hasProctorCapturedAtIdx = await indexExists(connection, 'proctor_snapshots', 'idx_proctor_captured_at');
    if (!hasProctorCapturedAtIdx) {
      console.log('➕ Adding INDEX `idx_proctor_captured_at` to table `proctor_snapshots`...');
      await connection.execute(
        `ALTER TABLE proctor_snapshots ADD INDEX idx_proctor_captured_at (captured_at)`
      );
      console.log('✅ Index `idx_proctor_captured_at` created successfully.');
    } else {
      console.log('ℹ️ Index `idx_proctor_captured_at` already exists on `proctor_snapshots`.');
    }

    // 3. Check idx_user_progress_status_updated on user_progress
    const hasUserProgressIdx = await indexExists(connection, 'user_progress', 'idx_user_progress_status_updated');
    if (!hasUserProgressIdx) {
      console.log('➕ Adding INDEX `idx_user_progress_status_updated` to table `user_progress`...');
      await connection.execute(
        `ALTER TABLE user_progress ADD INDEX idx_user_progress_status_updated (status, updated_at)`
      );
      console.log('✅ Index `idx_user_progress_status_updated` created successfully.');
    } else {
      console.log('ℹ️ Index `idx_user_progress_status_updated` already exists on `user_progress`.');
    }

    // 4. Check idx_sp_session_status on session_participants
    const hasSpSessionStatusIdx = await indexExists(connection, 'session_participants', 'idx_sp_session_status');
    if (!hasSpSessionStatusIdx) {
      console.log('➕ Adding INDEX `idx_sp_session_status` to table `session_participants`...');
      await connection.execute(
        `ALTER TABLE session_participants ADD INDEX idx_sp_session_status (session_id, graduation_status)`
      );
      console.log('✅ Index `idx_sp_session_status` created successfully.');
    } else {
      console.log('ℹ️ Index `idx_sp_session_status` already exists on `session_participants`.');
    }

    console.log('\n🎉 Database index optimization completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

runMigration();
