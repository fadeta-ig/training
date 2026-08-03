const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env.local' });

async function setup() {
    const adminPassword = process.env.DEFAULT_ADMIN_PASSWORD;
    if (!adminPassword || adminPassword.length < 12) {
        throw new Error('DEFAULT_ADMIN_PASSWORD wajib diisi minimal 12 karakter sebelum menjalankan script ini.');
    }

    const pool = mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: parseInt(process.env.DB_PORT || '3306', 10),
    });

    try {
        console.log('Creating users table...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id VARCHAR(36) PRIMARY KEY,
                username VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                full_name VARCHAR(100) NOT NULL,
                role ENUM('admin', 'trainer', 'trainee') NOT NULL DEFAULT 'trainee',
                reset_token VARCHAR(255) NULL,
                reset_token_expires DATETIME NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            );
        `);
        console.log('Users table created or already exists.');

        console.log('Inserting default admin user from DEFAULT_ADMIN_PASSWORD...');
        const bcrypt = require('bcryptjs');
        const hash = await bcrypt.hash(adminPassword, 10);

        await pool.query(`
            INSERT IGNORE INTO users (id, username, password_hash, full_name, role)
            VALUES (?, ?, ?, ?, ?)
        `, ['admin-uuid-001', 'admin', hash, 'Administrator Sistem', 'admin']);

        console.log('Default admin seeded.');
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await pool.end();
    }
}

setup();
