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
            `ALTER TABLE users ADD COLUMN reset_token VARCHAR(255) NULL;`,
            `ALTER TABLE users ADD COLUMN reset_token_expires DATETIME NULL;`,
            `ALTER TABLE users MODIFY role ENUM('admin', 'trainer', 'trainee', 'participant') NOT NULL DEFAULT 'trainee';`,
            `UPDATE users SET role = 'trainee' WHERE role = 'participant';`,
            `ALTER TABLE users MODIFY role ENUM('admin', 'trainer', 'trainee') NOT NULL DEFAULT 'trainee';`,
            `ALTER TABLE proctor_snapshots ADD COLUMN image_url VARCHAR(500) NULL;`,
            `ALTER TABLE proctor_snapshots MODIFY COLUMN image_base64 LONGTEXT NULL;`,
            `CREATE TABLE IF NOT EXISTS audit_logs (
                id VARCHAR(36) PRIMARY KEY,
                user_id VARCHAR(36) NULL,
                action_type VARCHAR(50) NOT NULL,
                entity VARCHAR(50) NOT NULL,
                entity_id VARCHAR(36) NULL,
                details JSON NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB;`,
            `ALTER TABLE audit_logs MODIFY COLUMN user_id VARCHAR(36) NULL;`,
            `ALTER TABLE users ADD INDEX idx_users_role_created (role, created_at);`,
            `ALTER TABLE users ADD INDEX idx_users_reset_token (reset_token);`,
            `ALTER TABLE questions ADD INDEX idx_questions_exam (exam_id);`,
            `ALTER TABLE module_items ADD INDEX idx_module_items_module_order (module_id, sequence_order);`,
            `ALTER TABLE module_items ADD INDEX idx_module_items_lookup (module_id, item_type, item_id);`,
            `ALTER TABLE sessions ADD INDEX idx_sessions_module_time (module_id, start_time, end_time);`,
            `ALTER TABLE session_participants ADD INDEX idx_session_participants_user (user_id);`,
            `ALTER TABLE user_progress ADD INDEX idx_progress_session_item (session_id, module_item_id);`,
            `ALTER TABLE user_progress ADD UNIQUE INDEX uq_progress (user_id, session_id, module_item_id);`,
            `ALTER TABLE proctor_snapshots ADD INDEX idx_proctor_session_user_time (session_id, user_id, captured_at);`,
            `ALTER TABLE notifications ADD INDEX idx_notifications_user_created (user_id, created_at);`,
            `ALTER TABLE notifications ADD INDEX idx_notifications_user_read (user_id, is_read);`,
            `ALTER TABLE audit_logs ADD INDEX idx_audit_created (created_at);`,
            `ALTER TABLE audit_logs ADD INDEX idx_audit_user_created (user_id, created_at);`,
            `ALTER TABLE audit_logs ADD INDEX idx_audit_entity (entity, entity_id);`
        ];

        let hasUnexpectedError = false;
        for (const q of queries) {
            try {
                console.log('Executing:', q);
                await connection.query(q);
                console.log('-> OK');
            } catch (err) {
                const isAlreadyApplied = err.message?.includes('Duplicate column name')
                    || err.message?.includes('Duplicate key name')
                    || err.message?.includes('already exists')
                    || (q.includes('image_base64') && err.message?.includes('Unknown column'));
                if (isAlreadyApplied) {
                    console.log('-> Already applied:', err.message);
                } else {
                    hasUnexpectedError = true;
                    console.error('-> Failed:', err.message);
                }
            }
        }

        await connection.end();
        if (hasUnexpectedError) {
            throw new Error('Migration completed with unexpected errors.');
        }
        console.log('Migration complete!');
    } catch (err) {
        console.error('Connection/Execution Error:', err);
        process.exitCode = 1;
    }
}

run();
