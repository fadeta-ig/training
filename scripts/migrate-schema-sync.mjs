import fs from 'node:fs';
import path from 'node:path';
import mysql from 'mysql2/promise';

function loadEnv() {
    const envPath = path.join(process.cwd(), '.env.local');
    if (!fs.existsSync(envPath)) return;
    for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
        const value = line.trim();
        if (!value || value.startsWith('#')) continue;
        const separator = value.indexOf('=');
        if (separator < 1) continue;
        const key = value.slice(0, separator).trim();
        const raw = value.slice(separator + 1).trim().replace(/^(["'])(.*)\1$/, '$2');
        if (!process.env[key]) process.env[key] = raw;
    }
}

loadEnv();

const apply = process.argv.includes('--apply');
const dbConfig = {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_NAME || 'lms_antigravity',
};

const requiredColumns = {
    users: {
        approval_status: "ENUM('pending','approved','rejected') NOT NULL DEFAULT 'approved'",
        rejection_reason: 'VARCHAR(255) NULL',
        approved_at: 'DATETIME NULL',
    },
    participant_profiles: {
        nip: 'VARCHAR(50) NULL',
        id_card_number: 'VARCHAR(50) NULL',
        institution_code: 'VARCHAR(20) NULL',
        target_certification_id: 'VARCHAR(36) NULL',
        target_certification_name: 'VARCHAR(255) NULL',
        target_period: 'VARCHAR(50) NULL',
        batch: "VARCHAR(50) NOT NULL DEFAULT '1'",
        registration_date: 'DATE NULL',
        initial_password: 'VARCHAR(255) NULL',
        must_change_password: 'BOOLEAN NOT NULL DEFAULT TRUE',
    },
    exams: {
        allow_remedial: 'BOOLEAN NOT NULL DEFAULT FALSE',
        max_attempts: 'INT NOT NULL DEFAULT 1',
        remedial_exam_id: 'VARCHAR(36) NULL',
    },
    questions: {
        sequence_order: 'INT NOT NULL DEFAULT 0',
        import_batch_id: 'VARCHAR(36) NULL',
        source_question_code: 'VARCHAR(50) NULL',
        source_sheet: 'VARCHAR(50) NULL',
        source_row: 'INT NULL',
    },
    modules: {
        enforce_sequence: 'BOOLEAN NOT NULL DEFAULT FALSE',
    },
    session_participants: {
        graduation_status: "ENUM('pending','passed','failed') NOT NULL DEFAULT 'pending'",
        graduation_decided_at: 'DATETIME NULL',
        graduation_decided_by: 'VARCHAR(36) NULL',
        graduation_notes: 'TEXT NULL',
        skl_number: 'VARCHAR(100) NULL',
        skl_generated_at: 'DATETIME NULL',
        certificate_file_url: 'VARCHAR(500) NULL',
        certificate_number: 'VARCHAR(100) NULL',
        certificate_uploaded_at: 'DATETIME NULL',
    },
    user_progress: {
        original_score: 'DECIMAL(5,2) NULL',
        score_adjustment: 'DECIMAL(5,2) NOT NULL DEFAULT 0.00',
        adjustment_reason: 'VARCHAR(255) NULL',
        adjusted_by: 'VARCHAR(36) NULL',
        adjusted_at: 'DATETIME NULL',
        attempt_version: 'INT NOT NULL DEFAULT 1',
        last_attempt_start: 'DATETIME NULL',
        individual_extension_until: 'DATETIME NULL',
        last_submission_id: 'VARCHAR(36) NULL',
        last_submission_result: 'LONGTEXT NULL',
    },
    exam_answer_drafts: {
        client_version: 'INT NOT NULL DEFAULT 1',
    },
};

const requiredIndexes = [
    ['users', 'idx_users_approval', '(approval_status)'],
    ['certification_programs', 'idx_cert_programs_active', '(is_active)'],
    ['participant_profiles', 'idx_participant_nip', '(nip)'],
    ['participant_profiles', 'idx_participant_id_card', '(id_card_number)'],
    ['participant_profiles', 'idx_participant_inst_batch', '(institution, batch)'],
    ['participant_profiles', 'idx_participant_reg_date', '(registration_date)'],
    ['exams', 'idx_exams_remedial', '(remedial_exam_id)'],
    ['questions', 'idx_questions_exam_order', '(exam_id, sequence_order)'],
    ['questions', 'idx_questions_import_batch', '(import_batch_id)'],
    ['question_import_batches', 'idx_question_import_exam_created', '(exam_id, created_at)'],
    ['question_import_batches', 'idx_question_import_exam_file', '(exam_id, file_sha256)'],
    ['question_import_batches', 'idx_question_import_exam_payload', '(exam_id, payload_sha256)'],
    ['question_import_batches', 'idx_question_import_status_expiry', '(status, expires_at)'],
    ['module_items', 'idx_module_items_item_id', '(item_id)'],
    ['session_participants', 'idx_sp_graduation', '(graduation_status)'],
    ['session_participants', 'idx_sp_session_status', '(session_id, graduation_status)'],
    ['user_progress', 'idx_user_progress_status_updated', '(status, updated_at)'],
    ['proctor_snapshots', 'idx_proctor_captured_at', '(captured_at)'],
];

const requiredTables = {
    certification_programs: `CREATE TABLE certification_programs (
        id VARCHAR(36) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        code VARCHAR(50) UNIQUE NULL,
        description TEXT NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB`,
    question_import_batches: `CREATE TABLE question_import_batches (
        id VARCHAR(36) PRIMARY KEY,
        exam_id VARCHAR(36) NOT NULL,
        created_by VARCHAR(36) NULL,
        original_filename VARCHAR(255) NOT NULL,
        file_sha256 CHAR(64) NOT NULL,
        payload_sha256 CHAR(64) NOT NULL,
        template_version VARCHAR(20) NOT NULL,
        status ENUM('previewed','committed','rolled_back','expired','failed') NOT NULL DEFAULT 'previewed',
        question_count INT NOT NULL DEFAULT 0,
        total_points INT NOT NULL DEFAULT 0,
        payload_json LONGTEXT NULL,
        expires_at DATETIME NOT NULL,
        committed_at DATETIME NULL,
        rolled_back_at DATETIME NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_question_import_exam_created (exam_id, created_at),
        INDEX idx_question_import_exam_file (exam_id, file_sha256),
        INDEX idx_question_import_exam_payload (exam_id, payload_sha256),
        INDEX idx_question_import_status_expiry (status, expires_at)
    ) ENGINE=InnoDB`,
    seb_access_overrides: `CREATE TABLE seb_access_overrides (
        id VARCHAR(36) PRIMARY KEY,
        session_id VARCHAR(36) NOT NULL,
        user_id VARCHAR(36) NOT NULL,
        granted_by VARCHAR(36) NOT NULL,
        reason VARCHAR(500) NOT NULL,
        expires_at DATETIME NOT NULL,
        revoked_at DATETIME NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_seb_override_lookup (session_id, user_id, expires_at, revoked_at),
        INDEX idx_seb_override_granted_by (granted_by, created_at)
    ) ENGINE=InnoDB`,
};

async function inspect(connection) {
    const [tableRows] = await connection.execute(
        `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ?`,
        [dbConfig.database],
    );
    const tables = new Set(tableRows.map((row) => row.TABLE_NAME));
    const missingTables = Object.keys(requiredTables).filter((table) => !tables.has(table));
    const missingColumns = [];
    for (const [table, definitions] of Object.entries(requiredColumns)) {
        if (!tables.has(table)) {
            missingColumns.push(...Object.keys(definitions).map((column) => `${table}.${column} (table missing)`));
            continue;
        }
        const [rows] = await connection.execute(
            `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
            [dbConfig.database, table],
        );
        const columns = new Set(rows.map((row) => row.COLUMN_NAME));
        for (const column of Object.keys(definitions)) {
            if (!columns.has(column)) missingColumns.push(`${table}.${column}`);
        }
    }
    const missingIndexes = [];
    for (const [table, index] of requiredIndexes) {
        if (!tables.has(table)) continue;
        const [rows] = await connection.execute(
            `SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND INDEX_NAME = ? LIMIT 1`,
            [dbConfig.database, table, index],
        );
        if (rows.length === 0) missingIndexes.push(`${table}.${index}`);
    }
    return { tables, missingTables, missingColumns, missingIndexes };
}

async function main() {
    const connection = await mysql.createConnection(dbConfig);
    try {
        let state = await inspect(connection);
        console.log(`[SCHEMA] Missing tables: ${state.missingTables.length ? state.missingTables.join(', ') : 'none'}`);
        console.log(`[SCHEMA] Missing columns: ${state.missingColumns.length ? state.missingColumns.join(', ') : 'none'}`);
        console.log(`[SCHEMA] Missing indexes: ${state.missingIndexes.length ? state.missingIndexes.join(', ') : 'none'}`);

        if (!apply) {
            if (state.missingTables.length || state.missingColumns.length || state.missingIndexes.length) process.exitCode = 1;
            return;
        }

        for (const table of state.missingTables) {
            await connection.query(requiredTables[table]);
            console.log(`[SCHEMA] Created table ${table}`);
        }

        state = await inspect(connection);
        for (const [table, definitions] of Object.entries(requiredColumns)) {
            if (!state.tables.has(table)) continue;
            for (const [column, definition] of Object.entries(definitions)) {
                if (!state.missingColumns.includes(`${table}.${column}`)) continue;
                await connection.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
                console.log(`[SCHEMA] Added ${table}.${column}`);
            }
        }

        state = await inspect(connection);
        for (const [table, index, columns] of requiredIndexes) {
            if (!state.missingIndexes.includes(`${table}.${index}`)) continue;
            await connection.query(`CREATE INDEX \`${index}\` ON \`${table}\` ${columns}`);
            console.log(`[SCHEMA] Added index ${table}.${index}`);
        }

        const finalState = await inspect(connection);
        if (finalState.missingTables.length || finalState.missingColumns.length || finalState.missingIndexes.length) {
            throw new Error(`Schema remains incomplete: ${JSON.stringify(finalState)}`);
        }
        console.log('[SCHEMA] Schema is synchronized.');
    } finally {
        await connection.end();
    }
}

main().catch((error) => {
    console.error('[SCHEMA] Migration failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
});
