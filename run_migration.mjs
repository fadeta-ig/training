import mysql from 'mysql2/promise';

async function run() {
    console.log('Connecting to MySQL database...');
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT) || 3307,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'lms_antigravity',
    });

    try {
        console.log('Running migration: ADD COLUMN enable_proctoring to sessions...');
        await connection.execute(`
            ALTER TABLE sessions
            ADD COLUMN enable_proctoring BOOLEAN NOT NULL DEFAULT TRUE;
        `);
        console.log('✅ Migration executed successfully!');
    } catch (error) {
        if (error.code === 'ER_DUP_FIELDNAME') {
            console.log('ℹ️ Column enable_proctoring already exists.');
        } else {
            console.error('❌ Migration failed:', error.message);
        }
    } finally {
        await connection.end();
    }
}

run();
