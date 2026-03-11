const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env.local' });

async function migrate() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST ?? 'localhost',
        port: Number(process.env.DB_PORT) || 3306,
        user: process.env.DB_USER ?? 'root',
        password: process.env.DB_PASSWORD ?? '',
        database: process.env.DB_NAME ?? 'lms_antigravity',
    });

    try {
        const sql = `
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
    `;
        console.log('Running migration: Creating participant_profiles table...');
        await pool.query(sql);
        console.log('Migration successful.');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await pool.end();
    }
}

migrate();
