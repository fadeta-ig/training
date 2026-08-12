import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';

function loadEnvLocal() {
    const envPath = path.resolve(process.cwd(), '.env.local');
    if (fs.existsSync(envPath)) {
        const envConfig = fs.readFileSync(envPath, 'utf8');
        for (const line of envConfig.split('\n')) {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
                const [key, ...valueParts] = trimmed.split('=');
                process.env[key.trim()] = valueParts.join('=').trim();
            }
        }
    }
}

loadEnvLocal();

async function run() {
    let connection;
    try {
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            port: Number(process.env.DB_PORT) || 3306,
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'lms_antigravity',
        });

        console.log('Connected to MySQL DB. Applying Admin Exam Override DDL...');

        const queries = [
            `ALTER TABLE user_progress ADD COLUMN attempt_version INT NOT NULL DEFAULT 1 AFTER attempts_count;`,
            `ALTER TABLE user_progress ADD COLUMN individual_extension_until DATETIME NULL AFTER last_attempt_start;`
        ];

        for (const q of queries) {
            try {
                console.log('Running:', q);
                await connection.execute(q);
                console.log('Success');
            } catch (e) {
                console.log('Notice (might already exist):', e.message);
            }
        }
        console.log('Migration Completed Successfully!');
    } catch (e) {
        console.error('Migration Error:', e);
    } finally {
        if (connection) await connection.end();
        process.exit(0);
    }
}
run();
