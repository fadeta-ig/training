import 'dotenv/config';
import pool from './src/lib/db.js'; // Assuming you can access it, maybe need to create a temporary runner

async function run() {
    let connection;
    try {
        connection = await pool.getConnection();
        console.log('Connected to DB. Applying DDL...');

        const queries = [
            `ALTER TABLE exams ADD COLUMN allow_remedial BOOLEAN DEFAULT FALSE;`,
            `ALTER TABLE exams ADD COLUMN max_attempts INT DEFAULT 1;`,
            `ALTER TABLE user_progress ADD COLUMN attempts_count INT DEFAULT 0;`,
            `ALTER TABLE user_progress ADD COLUMN last_attempt_start DATETIME NULL;`,
            `ALTER TABLE exam_answers ADD COLUMN attempt_number INT DEFAULT 1;`
        ];

        for (const q of queries) {
            try {
                console.log('Running:', q);
                await connection.execute(q);
                console.log('Success');
            } catch (e) {
                console.log('Error (might already exist):', e.message);
            }
        }
        console.log('Done');
    } catch (e) {
        console.error(e);
    } finally {
        if (connection) connection.release();
        process.exit(0);
    }
}
run();
