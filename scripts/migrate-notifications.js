const mysql = require('mysql2/promise');
const { v4: uuidv4 } = require('uuid');

async function run() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'lms_antigravity'
    });

    try {
        console.log('Creating notifications table...');
        await pool.query(`CREATE TABLE IF NOT EXISTS notifications (
            id VARCHAR(36) PRIMARY KEY,
            user_id VARCHAR(36) NULL,
            title VARCHAR(200) NOT NULL,
            message TEXT NOT NULL,
            type ENUM('info', 'success', 'warning', 'error') NOT NULL DEFAULT 'info',
            is_read TINYINT(1) NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )`);
        console.log('Table created successfully.');

        console.log('Seeding initial notifications...');
        const notifs = [
            { title: 'Selamat Datang', message: 'Sistem e-learning Antigravity LMS telah aktif dan siap digunakan.', type: 'success' },
            { title: 'Keamanan Ditingkatkan', message: 'Semua API endpoint kini telah dilindungi dengan autentikasi JWT.', type: 'info' },
            { title: 'Sistem Siap', message: 'Database dan semua tabel telah disinkronisasi dengan struktur terbaru.', type: 'success' },
        ];

        for (const n of notifs) {
            await pool.query(
                'INSERT INTO notifications (id, user_id, title, message, type) VALUES (?, ?, ?, ?, ?)',
                [uuidv4(), 'admin-uuid-001', n.title, n.message, n.type]
            );
        }
        console.log('Seeded 3 initial notifications.');
    } catch (e) {
        console.error('Migration error:', e.message);
    } finally {
        await pool.end();
        process.exit(0);
    }
}

run();
