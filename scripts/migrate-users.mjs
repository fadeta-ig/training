import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

/**
 * LMS Antigravity - Dedicated Account Migration Script
 * Migrates & seeds essential user accounts (Admin, Trainer, Trainee)
 * with BCrypt hashed passwords and participant profiles.
 */

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

// Account seed definitions
const SEED_USERS = [
  {
    username: 'admin',
    password: 'Password123!',
    role: 'admin',
    fullName: 'System Administrator',
  },
  {
    username: 'trainer',
    password: 'Password123!',
    role: 'trainer',
    fullName: 'Master Instructor',
  },
  {
    username: 'trainee',
    password: 'Password123!',
    role: 'trainee',
    fullName: 'Sample Trainee',
    institution: 'PT Antigravity Digital',
  },
];

async function runAccountMigration() {
  console.log('🕊️  [MIGRATE-USERS] Connecting to database...');
  console.log(`📌  Target DB: ${dbConfig.user}@${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`);

  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log('✅  Database connection established successfully.\n');

    // Ensure users table exists
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id                  VARCHAR(36)  PRIMARY KEY,
        role                ENUM('admin', 'trainer', 'trainee') NOT NULL DEFAULT 'trainee',
        full_name           VARCHAR(100) NOT NULL,
        username            VARCHAR(255) UNIQUE NOT NULL,
        password_hash       VARCHAR(255) NOT NULL,
        reset_token         VARCHAR(255) NULL,
        reset_token_expires DATETIME NULL,
        created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_users_role_created (role, created_at),
        INDEX idx_users_reset_token (reset_token)
      ) ENGINE=InnoDB;
    `);

    // Ensure participant_profiles table exists
    await connection.query(`
      CREATE TABLE IF NOT EXISTS participant_profiles (
        id              VARCHAR(36) PRIMARY KEY,
        user_id         VARCHAR(36) NOT NULL UNIQUE,
        phone_number    VARCHAR(20) NULL,
        address         TEXT NULL,
        date_of_birth   DATE NULL,
        gender          ENUM('L', 'P') NULL,
        institution     VARCHAR(150) NULL,
        created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_participant_user
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB;
    `);

    for (const seed of SEED_USERS) {
      // Check if user already exists
      const [rows] = await connection.query(
        'SELECT id FROM users WHERE username = ?',
        [seed.username]
      );

      const existingUsers = rows;
      if (existingUsers.length > 0) {
        console.log(`ℹ️   User "${seed.username}" already exists. Updating credentials...`);
        const passwordHash = await bcrypt.hash(seed.password, 10);
        await connection.query(
          'UPDATE users SET password_hash = ?, role = ?, full_name = ? WHERE username = ?',
          [passwordHash, seed.role, seed.fullName, seed.username]
        );
        console.log(`✨  User "${seed.username}" updated.`);
      } else {
        const userId = randomUUID();
        const passwordHash = await bcrypt.hash(seed.password, 10);

        await connection.query(
          `INSERT INTO users (id, role, full_name, username, password_hash)
           VALUES (?, ?, ?, ?, ?)`,
          [userId, seed.role, seed.fullName, seed.username, passwordHash]
        );

        if (seed.role === 'trainee') {
          const profileId = randomUUID();
          await connection.query(
            `INSERT INTO participant_profiles (id, user_id, institution)
             VALUES (?, ?, ?)`,
            [profileId, userId, seed.institution || null]
          );
        }

        console.log(`✅  Created user "${seed.username}" (${seed.role}) successfully.`);
      }
    }

    console.log('\n🎉  Account migration completed successfully!');
  } catch (error) {
    console.error('❌  Account migration failed:', error.message);
    process.exitCode = 1;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

runAccountMigration();
