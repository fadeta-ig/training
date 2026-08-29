import mysql from 'mysql2/promise';
import fs from 'node:fs';
import path from 'node:path';

function loadEnv() {
    const envPath = path.join(process.cwd(), '.env.local');
    if (!fs.existsSync(envPath)) return;

    for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const separator = trimmed.indexOf('=');
        if (separator < 0) continue;
        const key = trimmed.slice(0, separator).trim();
        const value = trimmed.slice(separator + 1).trim().replace(/^["'](.*)["']$/, '$1');
        if (!process.env[key]) process.env[key] = value;
    }
}

loadEnv();

const dbConfig = {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_NAME || 'lms_antigravity',
};

async function columnExists(connection, tableName, columnName) {
    const [rows] = await connection.execute(
        `SELECT 1
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?
         LIMIT 1`,
        [dbConfig.database, tableName, columnName],
    );
    return rows.length > 0;
}

async function indexExists(connection, tableName, indexName) {
    const [rows] = await connection.execute(
        `SELECT 1
         FROM INFORMATION_SCHEMA.STATISTICS
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND INDEX_NAME = ?
         LIMIT 1`,
        [dbConfig.database, tableName, indexName],
    );
    return rows.length > 0;
}

async function constraintExists(connection, tableName, constraintName) {
    const [rows] = await connection.execute(
        `SELECT 1
         FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND CONSTRAINT_NAME = ?
         LIMIT 1`,
        [dbConfig.database, tableName, constraintName],
    );
    return rows.length > 0;
}

async function migrate() {
    console.log('[MIGRATE-QUESTION-IMPORT] Connecting to database...');
    const connection = await mysql.createConnection(dbConfig);

    try {
        await connection.query(`
            CREATE TABLE IF NOT EXISTS question_import_batches (
              id                VARCHAR(36) PRIMARY KEY,
              exam_id           VARCHAR(36) NOT NULL,
              created_by        VARCHAR(36) NULL,
              original_filename VARCHAR(255) NOT NULL,
              file_sha256       CHAR(64) NOT NULL,
              payload_sha256    CHAR(64) NOT NULL,
              template_version  VARCHAR(20) NOT NULL,
              status            ENUM('previewed','committed','rolled_back','expired','failed')
                                  NOT NULL DEFAULT 'previewed',
              question_count    INT NOT NULL DEFAULT 0,
              total_points      INT NOT NULL DEFAULT 0,
              payload_json      LONGTEXT NULL,
              expires_at        DATETIME NOT NULL,
              committed_at      DATETIME NULL,
              rolled_back_at    DATETIME NULL,
              created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
              INDEX idx_question_import_exam_created (exam_id, created_at),
              INDEX idx_question_import_exam_file (exam_id, file_sha256),
              INDEX idx_question_import_exam_payload (exam_id, payload_sha256),
              INDEX idx_question_import_status_expiry (status, expires_at),
              CONSTRAINT fk_question_import_exam
                FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE,
              CONSTRAINT fk_question_import_user
                FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
            ) ENGINE=InnoDB
        `);

        const batchIndexes = [
            ['idx_question_import_exam_created', '(exam_id, created_at)'],
            ['idx_question_import_exam_file', '(exam_id, file_sha256)'],
            ['idx_question_import_exam_payload', '(exam_id, payload_sha256)'],
            ['idx_question_import_status_expiry', '(status, expires_at)'],
        ];
        for (const [indexName, columns] of batchIndexes) {
            if (!await indexExists(connection, 'question_import_batches', indexName)) {
                await connection.query(`CREATE INDEX ${indexName} ON question_import_batches ${columns}`);
                console.log(`[MIGRATE-QUESTION-IMPORT] Added ${indexName}`);
            }
        }

        const columns = [
            ['import_batch_id', 'VARCHAR(36) NULL'],
            ['source_question_code', 'VARCHAR(50) NULL'],
            ['source_sheet', 'VARCHAR(50) NULL'],
            ['source_row', 'INT NULL'],
        ];
        for (const [columnName, definition] of columns) {
            if (!await columnExists(connection, 'questions', columnName)) {
                await connection.query(`ALTER TABLE questions ADD COLUMN ${columnName} ${definition}`);
                console.log(`[MIGRATE-QUESTION-IMPORT] Added questions.${columnName}`);
            }
        }

        if (!await indexExists(connection, 'questions', 'idx_questions_import_batch')) {
            await connection.query('CREATE INDEX idx_questions_import_batch ON questions (import_batch_id)');
            console.log('[MIGRATE-QUESTION-IMPORT] Added idx_questions_import_batch');
        }

        if (!await constraintExists(connection, 'questions', 'fk_questions_import_batch')) {
            await connection.query(`
                ALTER TABLE questions
                ADD CONSTRAINT fk_questions_import_batch
                FOREIGN KEY (import_batch_id) REFERENCES question_import_batches(id) ON DELETE SET NULL
            `);
            console.log('[MIGRATE-QUESTION-IMPORT] Added fk_questions_import_batch');
        }

        console.log('[MIGRATE-QUESTION-IMPORT] Migration completed successfully.');
    } catch (error) {
        console.error('[MIGRATE-QUESTION-IMPORT] Migration failed:', error instanceof Error ? error.message : error);
        process.exitCode = 1;
    } finally {
        await connection.end();
    }
}

migrate();
