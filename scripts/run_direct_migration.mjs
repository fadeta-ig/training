import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function run() {
    const host = process.env.DB_HOST || 'localhost';
    const port = Number(process.env.DB_PORT) || 3307;
    const user = process.env.DB_USER || 'root';
    const password = process.env.DB_PASSWORD ?? '';
    const database = process.env.DB_NAME || 'lms_antigravity';

    console.log(`Connecting to MySQL at ${host}:${port} as ${user}, database=${database}...`);

    try {
        const connection = await mysql.createConnection({
            host, port, user, password, database
        });
        console.log('Connected successfully!');

        const queries = [
            `ALTER TABLE users ADD COLUMN reset_token VARCHAR(255) NULL, ADD COLUMN reset_token_expires DATETIME NULL;`,
            `ALTER TABLE users MODIFY role ENUM('admin', 'trainer', 'trainee', 'participant') NOT NULL DEFAULT 'trainee';`,
            `UPDATE users SET role = 'trainee' WHERE role = 'participant';`,
            `ALTER TABLE users MODIFY role ENUM('admin', 'trainer', 'trainee') NOT NULL DEFAULT 'trainee';`,
            `ALTER TABLE proctor_snapshots ADD COLUMN image_url VARCHAR(500) NULL;`
        ];

        for (const q of queries) {
            try {
                console.log('Executing:', q);
                await connection.query(q);
                console.log('-> OK');
            } catch (err) {
                console.log('-> Info/Note:', err.message);
            }
        }

        await connection.end();
        console.log('Migration complete!');
    } catch (err) {
        console.error('Connection/Execution Error:', err);
    }
}

run();
