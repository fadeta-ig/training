const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env.local' });

async function setup() {
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
                username VARCHAR(50) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                full_name VARCHAR(100) NOT NULL,
                role ENUM('admin', 'participant') NOT NULL DEFAULT 'participant',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            );
        `);
        console.log('Users table created or already exists.');

        console.log('Inserting default admin user (admin / admin123)...');
        // $2a$10$wT/3G.V6R.XmD5/J.n6y0O32cO./zT0F0vI0N3WqVqVqVqVqVqVq
        // We will just use standard bcrypt hashing in JS, but since this is a quick setup, we can just insert a known hash for 'admin123'
        // bcrypt hash for 'admin123' = $2b$10$nEqV6D7R.I19yP6.XW.yqO4HjD6T9/wT.w3P5X9N9/Q8.uN9.XN9O
        const bcrypt = require('bcryptjs');
        const hash = await bcrypt.hash('admin123', 10);

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
