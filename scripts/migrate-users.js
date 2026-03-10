const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env.local' });

async function run() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'lms_antigravity'
    });

    try {
        console.log('Renaming name to full_name...');
        await pool.query('ALTER TABLE users CHANGE name full_name VARCHAR(100) NOT NULL');

        console.log('Updating role ENUM values and standardizing participants...');
        await pool.query("ALTER TABLE users MODIFY role ENUM('admin', 'participant', 'trainee') NOT NULL DEFAULT 'participant'");
        await pool.query("UPDATE users SET role = 'participant' WHERE role = 'trainee'");
        await pool.query("ALTER TABLE users MODIFY role ENUM('admin', 'participant') NOT NULL DEFAULT 'participant'");

        console.log('Adding updated_at column...');
        try {
            await pool.query('ALTER TABLE users ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');
        } catch (e) {
            if (e.code === 'ER_DUP_FIELDNAME') {
                console.log('updated_at column already exists, skipping...');
            } else {
                throw e;
            }
        }

        console.log('Seeding default administrator...');
        const bcrypt = require('bcryptjs');
        const hash = await bcrypt.hash('admin123', 10);
        // Use REPLACE to overwrite the dummy admin with correct password hash format if it was generated incorrectly before
        await pool.query('REPLACE INTO users (id, username, password_hash, full_name, role) VALUES (?, ?, ?, ?, ?)', ['admin-uuid-001', 'admin', hash, 'Administrator Sistem', 'admin']);

        console.log('Database synchronization complete.');
    } catch (e) {
        console.error('Migration error:', e);
    } finally {
        await pool.end();
        process.exit(0);
    }
}

run();
