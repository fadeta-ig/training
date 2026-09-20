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
    trainings: {
        category_id: 'VARCHAR(36) NULL',
    },
    exams: {
        category_id: 'VARCHAR(36) NULL',
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
        category_id: 'VARCHAR(36) NULL',
        enforce_sequence: 'BOOLEAN NOT NULL DEFAULT FALSE',
    },
    sessions: {
        session_type: "ENUM('regular','remedial') NOT NULL DEFAULT 'regular'",
        parent_session_id: 'VARCHAR(36) NULL',
        remedial_cycle: 'INT NOT NULL DEFAULT 0',
        result_state: "ENUM('draft','published') NOT NULL DEFAULT 'draft'",
        result_published_at: 'DATETIME NULL',
        result_published_by: 'VARCHAR(36) NULL',
        result_publication_version: 'INT NOT NULL DEFAULT 0',
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
        grading_pending: 'BOOLEAN NOT NULL DEFAULT FALSE',
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
    ['module_items', 'uq_module_items_item', '(module_id, item_type, item_id)', true],
    ['module_items', 'uq_module_items_sequence', '(module_id, sequence_order)', true],
    ['sessions', 'uq_sessions_parent_cycle', '(parent_session_id, remedial_cycle)', true],
    ['session_participants', 'idx_sp_graduation', '(graduation_status)'],
    ['session_participants', 'idx_sp_session_status', '(session_id, graduation_status)'],
    ['session_participants', 'uq_session_participants_skl_number', '(skl_number)', true],
    ['user_progress', 'idx_user_progress_status_updated', '(status, updated_at)'],
    ['proctor_snapshots', 'idx_proctor_captured_at', '(captured_at)'],
    ['email_outbox', 'idx_email_outbox_dispatch', '(status, available_at, created_at)'],
    ['session_reminder_runs', 'idx_session_reminder_cooldown', '(session_id, created_at)'],
    ['session_reminder_runs', 'uq_session_reminder_bucket', '(session_id, cooldown_bucket)', true],
    ['trainings', 'idx_trainings_category_created', '(category_id, created_at)'],
    ['exams', 'idx_exams_category_created', '(category_id, created_at)'],
    ['modules', 'idx_modules_category_created', '(category_id, created_at)'],
];

const requiredTables = {
    learning_categories: `CREATE TABLE learning_categories (
        id VARCHAR(36) PRIMARY KEY,
        name VARCHAR(150) NOT NULL,
        code VARCHAR(50) UNIQUE NOT NULL,
        description TEXT NULL,
        color VARCHAR(30) NOT NULL DEFAULT '#0ea5e9',
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_by VARCHAR(36) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_learning_cat_active (is_active),
        INDEX idx_learning_cat_code (code)
    ) ENGINE=InnoDB`,
    category_trainers: `CREATE TABLE category_trainers (
        id VARCHAR(36) PRIMARY KEY,
        category_id VARCHAR(36) NOT NULL,
        trainer_id VARCHAR(36) NOT NULL,
        assigned_by VARCHAR(36) NULL,
        assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_category_trainer (category_id, trainer_id),
        INDEX idx_cat_trainers_trainer (trainer_id),
        INDEX idx_cat_trainers_category (category_id)
    ) ENGINE=InnoDB`,
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
    document_sequences: `CREATE TABLE document_sequences (
        scope_key VARCHAR(100) PRIMARY KEY,
        next_value BIGINT UNSIGNED NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB`,
    email_outbox: `CREATE TABLE email_outbox (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        template ENUM('credential') NOT NULL,
        status ENUM('pending','processing','retry','sent','failed') NOT NULL DEFAULT 'pending',
        attempts INT NOT NULL DEFAULT 0,
        available_at DATETIME NOT NULL,
        locked_at DATETIME NULL,
        sent_at DATETIME NULL,
        last_error VARCHAR(500) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_email_outbox_dispatch (status, available_at, created_at),
        CONSTRAINT fk_email_outbox_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB`,
    session_reminder_runs: `CREATE TABLE session_reminder_runs (
        id VARCHAR(36) PRIMARY KEY,
        session_id VARCHAR(36) NOT NULL,
        triggered_by VARCHAR(36) NOT NULL,
        cooldown_bucket BIGINT NOT NULL,
        status ENUM('processing','completed','failed') NOT NULL DEFAULT 'processing',
        recipient_count INT NOT NULL DEFAULT 0,
        sent_count INT NOT NULL DEFAULT 0,
        error_message VARCHAR(500) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME NULL,
        INDEX idx_session_reminder_cooldown (session_id, created_at),
        UNIQUE KEY uq_session_reminder_bucket (session_id, cooldown_bucket),
        CONSTRAINT fk_session_reminder_session FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
        CONSTRAINT fk_session_reminder_user FOREIGN KEY (triggered_by) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB`,
    exam_attempt_results: `CREATE TABLE exam_attempt_results (
        id VARCHAR(36) PRIMARY KEY,
        root_session_id VARCHAR(36) NOT NULL,
        session_id VARCHAR(36) NOT NULL,
        user_id VARCHAR(36) NOT NULL,
        module_item_id VARCHAR(36) NOT NULL,
        exam_id VARCHAR(36) NOT NULL,
        source_exam_id VARCHAR(36) NOT NULL,
        attempt_number INT NOT NULL,
        original_score DECIMAL(5,2) NULL,
        score_adjustment DECIMAL(5,2) NOT NULL DEFAULT 0.00,
        final_score DECIMAL(5,2) NULL,
        adjustment_reason VARCHAR(255) NULL,
        adjusted_by VARCHAR(36) NULL,
        adjusted_at DATETIME NULL,
        grading_pending BOOLEAN NOT NULL DEFAULT FALSE,
        completed_at DATETIME NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_exam_attempt_result (user_id, session_id, module_item_id, attempt_number),
        INDEX idx_exam_attempt_best (root_session_id, user_id, source_exam_id, grading_pending, final_score),
        INDEX idx_exam_attempt_session_item (session_id, module_item_id, user_id),
        CONSTRAINT fk_attempt_root_session FOREIGN KEY (root_session_id) REFERENCES sessions(id) ON DELETE CASCADE,
        CONSTRAINT fk_attempt_session FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
        CONSTRAINT fk_attempt_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_attempt_module_item FOREIGN KEY (module_item_id) REFERENCES module_items(id) ON DELETE CASCADE,
        CONSTRAINT fk_attempt_exam FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE RESTRICT,
        CONSTRAINT fk_attempt_source_exam FOREIGN KEY (source_exam_id) REFERENCES exams(id) ON DELETE RESTRICT,
        CONSTRAINT fk_attempt_adjusted_by FOREIGN KEY (adjusted_by) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB`,
    session_result_publications: `CREATE TABLE session_result_publications (
        id VARCHAR(36) PRIMARY KEY,
        session_id VARCHAR(36) NOT NULL,
        root_session_id VARCHAR(36) NOT NULL,
        version INT NOT NULL,
        status ENUM('active','superseded') NOT NULL DEFAULT 'active',
        published_by VARCHAR(36) NOT NULL,
        published_at DATETIME NOT NULL,
        superseded_at DATETIME NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_result_publication_version (root_session_id, version),
        INDEX idx_result_publication_active (root_session_id, status, published_at),
        CONSTRAINT fk_result_publication_session FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
        CONSTRAINT fk_result_publication_root FOREIGN KEY (root_session_id) REFERENCES sessions(id) ON DELETE CASCADE,
        CONSTRAINT fk_result_publication_user FOREIGN KEY (published_by) REFERENCES users(id) ON DELETE RESTRICT
    ) ENGINE=InnoDB`,
    session_result_publication_items: `CREATE TABLE session_result_publication_items (
        id VARCHAR(36) PRIMARY KEY,
        publication_id VARCHAR(36) NOT NULL,
        user_id VARCHAR(36) NOT NULL,
        source_exam_id VARCHAR(36) NOT NULL,
        best_attempt_result_id VARCHAR(36) NULL,
        best_score DECIMAL(5,2) NULL,
        passing_grade DECIMAL(5,2) NOT NULL,
        outcome ENUM('passed','remedial_required','remedial_exhausted','absent') NOT NULL,
        remedial_session_id VARCHAR(36) NULL,
        attempts_used INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_publication_user_exam (publication_id, user_id, source_exam_id),
        INDEX idx_publication_item_user (user_id, outcome),
        CONSTRAINT fk_publication_item_publication FOREIGN KEY (publication_id) REFERENCES session_result_publications(id) ON DELETE CASCADE,
        CONSTRAINT fk_publication_item_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_publication_item_exam FOREIGN KEY (source_exam_id) REFERENCES exams(id) ON DELETE RESTRICT,
        CONSTRAINT fk_publication_item_attempt FOREIGN KEY (best_attempt_result_id) REFERENCES exam_attempt_results(id) ON DELETE SET NULL,
        CONSTRAINT fk_publication_item_remedial_session FOREIGN KEY (remedial_session_id) REFERENCES sessions(id) ON DELETE SET NULL
    ) ENGINE=InnoDB`,
    session_participant_exam_assignments: `CREATE TABLE session_participant_exam_assignments (
        id VARCHAR(36) PRIMARY KEY,
        session_id VARCHAR(36) NOT NULL,
        user_id VARCHAR(36) NOT NULL,
        module_item_id VARCHAR(36) NOT NULL,
        source_exam_id VARCHAR(36) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_participant_exam_assignment (session_id, user_id, module_item_id),
        INDEX idx_participant_exam_assignment_user (session_id, user_id),
        CONSTRAINT fk_exam_assignment_session FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
        CONSTRAINT fk_exam_assignment_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_exam_assignment_item FOREIGN KEY (module_item_id) REFERENCES module_items(id) ON DELETE CASCADE,
        CONSTRAINT fk_exam_assignment_source FOREIGN KEY (source_exam_id) REFERENCES exams(id) ON DELETE RESTRICT
    ) ENGINE=InnoDB`,
};

const requiredColumnDefinitions = [
    {
        table: 'user_progress',
        column: 'status',
        matches: (row) => String(row.COLUMN_TYPE || '').toLowerCase().includes('grading_pending'),
        definition: "ENUM('locked','open','grading_pending','completed') DEFAULT 'locked'",
    },
    {
        table: 'participant_profiles',
        column: 'gender',
        matches: (row) => row.IS_NULLABLE === 'YES',
        definition: "ENUM('L','P') NULL DEFAULT NULL",
    },
];

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
    const invalidDefinitions = [];
    for (const requirement of requiredColumnDefinitions) {
        if (!tables.has(requirement.table)) continue;
        const [rows] = await connection.execute(
            `SELECT COLUMN_TYPE, IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1`,
            [dbConfig.database, requirement.table, requirement.column],
        );
        if (rows.length > 0 && !requirement.matches(rows[0])) {
            invalidDefinitions.push(`${requirement.table}.${requirement.column}`);
        }
    }
    const dataConflicts = [];
    const conflictChecks = [
        {
            table: 'sessions',
            index: 'uq_sessions_parent_cycle',
            columns: ['parent_session_id', 'remedial_cycle'],
            label: 'duplicate remedial cycles per parent session',
            sql: `SELECT COUNT(*) AS total FROM (
                SELECT parent_session_id, remedial_cycle
                FROM sessions
                WHERE parent_session_id IS NOT NULL
                GROUP BY parent_session_id, remedial_cycle
                HAVING COUNT(*) > 1
            ) duplicates`,
        },
        {
            table: 'module_items',
            index: 'uq_module_items_item',
            label: 'duplicate module item references',
            sql: `SELECT COUNT(*) AS total FROM (
                SELECT module_id, item_type, item_id
                FROM module_items
                GROUP BY module_id, item_type, item_id
                HAVING COUNT(*) > 1
            ) duplicates`,
        },
        {
            table: 'module_items',
            index: 'uq_module_items_sequence',
            label: 'duplicate module sequence orders',
            sql: `SELECT COUNT(*) AS total FROM (
                SELECT module_id, sequence_order
                FROM module_items
                GROUP BY module_id, sequence_order
                HAVING COUNT(*) > 1
            ) duplicates`,
        },
        {
            table: 'session_participants',
            index: 'uq_session_participants_skl_number',
            columns: ['skl_number'],
            label: 'duplicate SKL numbers',
            sql: `SELECT COUNT(*) AS total FROM (
                SELECT skl_number
                FROM session_participants
                WHERE skl_number IS NOT NULL AND skl_number <> ''
                GROUP BY skl_number
                HAVING COUNT(*) > 1
            ) duplicates`,
        },
    ];
    for (const check of conflictChecks) {
        if (!tables.has(check.table) || !missingIndexes.includes(`${check.table}.${check.index}`)) continue;
        if (check.columns?.some((col) => missingColumns.includes(`${check.table}.${col}`))) continue;
        const [rows] = await connection.query(check.sql);
        const total = Number(rows[0]?.total || 0);
        if (total > 0) dataConflicts.push(`${check.label}: ${total} group(s)`);
    }
    return { tables, missingTables, missingColumns, missingIndexes, invalidDefinitions, dataConflicts };
}

async function main() {
    const connection = await mysql.createConnection(dbConfig);
    try {
        let state = await inspect(connection);
        console.log(`[SCHEMA] Missing tables: ${state.missingTables.length ? state.missingTables.join(', ') : 'none'}`);
        console.log(`[SCHEMA] Missing columns: ${state.missingColumns.length ? state.missingColumns.join(', ') : 'none'}`);
        console.log(`[SCHEMA] Missing indexes: ${state.missingIndexes.length ? state.missingIndexes.join(', ') : 'none'}`);
        console.log(`[SCHEMA] Invalid definitions: ${state.invalidDefinitions.length ? state.invalidDefinitions.join(', ') : 'none'}`);
        console.log(`[SCHEMA] Data conflicts: ${state.dataConflicts.length ? state.dataConflicts.join(', ') : 'none'}`);

        if (!apply) {
            if (state.missingTables.length || state.missingColumns.length || state.missingIndexes.length || state.invalidDefinitions.length || state.dataConflicts.length) process.exitCode = 1;
            return;
        }

        if (state.dataConflicts.length) {
            throw new Error(`Unique indexes cannot be created until data conflicts are resolved: ${state.dataConflicts.join(', ')}`);
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
        for (const requirement of requiredColumnDefinitions) {
            if (!state.invalidDefinitions.includes(`${requirement.table}.${requirement.column}`)) continue;
            await connection.query(
                `ALTER TABLE \`${requirement.table}\` MODIFY COLUMN \`${requirement.column}\` ${requirement.definition}`,
            );
            console.log(`[SCHEMA] Updated definition ${requirement.table}.${requirement.column}`);
        }

        state = await inspect(connection);
        for (const [table, index, columns] of requiredIndexes) {
            if (!state.missingIndexes.includes(`${table}.${index}`)) continue;
            const unique = requiredIndexes.find((entry) => entry[0] === table && entry[1] === index)?.[3];
            await connection.query(`CREATE ${unique ? 'UNIQUE ' : ''}INDEX \`${index}\` ON \`${table}\` ${columns}`);
            console.log(`[SCHEMA] Added index ${table}.${index}`);
        }

        // Preserve existing completed scores as one legacy attempt so the new
        // highest-score policy can be introduced without discarding history.
        const [backfillResult] = await connection.query(`
            INSERT IGNORE INTO exam_attempt_results
                (id, root_session_id, session_id, user_id, module_item_id, exam_id,
                 source_exam_id, attempt_number, original_score, score_adjustment,
                 final_score, adjustment_reason, adjusted_by, adjusted_at,
                 grading_pending, completed_at)
            SELECT UUID(),
                   CASE WHEN COALESCE(s.session_type, 'regular') = 'remedial'
                        THEN COALESCE(s.parent_session_id, s.id) ELSE s.id END,
                   up.session_id, up.user_id, up.module_item_id, e.id, e.id,
                   GREATEST(COALESCE(up.attempts_count, 1), 1),
                   COALESCE(up.original_score, up.score),
                   COALESCE(up.score_adjustment, 0),
                   up.score, up.adjustment_reason, up.adjusted_by, up.adjusted_at,
                   COALESCE(up.grading_pending, 0),
                   CASE WHEN up.score IS NOT NULL THEN up.updated_at ELSE NULL END
            FROM user_progress up
            JOIN sessions s ON s.id = up.session_id
            JOIN module_items mi ON mi.id = up.module_item_id AND mi.item_type = 'exam'
            JOIN exams e ON e.id = mi.item_id
            WHERE up.score IS NOT NULL OR COALESCE(up.grading_pending, 0) = 1
        `);
        if (Number(backfillResult.affectedRows || 0) > 0) {
            console.log(`[SCHEMA] Backfilled ${backfillResult.affectedRows} legacy exam attempt result(s)`);
        }

        const finalState = await inspect(connection);
        if (finalState.missingTables.length || finalState.missingColumns.length || finalState.missingIndexes.length || finalState.invalidDefinitions.length || finalState.dataConflicts.length) {
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
