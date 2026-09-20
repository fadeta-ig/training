import fs from 'node:fs';
import path from 'node:path';
import mysql from 'mysql2/promise';
import { randomUUID } from 'node:crypto';

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

const dbConfig = {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_NAME || 'lms_antigravity',
};

async function columnExists(connection, table, column) {
    const [rows] = await connection.execute(
        `SELECT COUNT(*) as cnt FROM information_schema.columns WHERE table_schema = ? AND table_name = ? AND column_name = ?`,
        [dbConfig.database, table, column]
    );
    return Number(rows[0]?.cnt || 0) > 0;
}

async function foreignKeyExists(connection, table, fkName) {
    const [rows] = await connection.execute(
        `SELECT COUNT(*) as cnt FROM information_schema.table_constraints WHERE table_schema = ? AND table_name = ? AND constraint_name = ? AND constraint_type = 'FOREIGN KEY'`,
        [dbConfig.database, table, fkName]
    );
    return Number(rows[0]?.cnt || 0) > 0;
}

async function indexExists(connection, table, indexName) {
    const [rows] = await connection.execute(
        `SELECT COUNT(*) as cnt FROM information_schema.statistics WHERE table_schema = ? AND table_name = ? AND index_name = ?`,
        [dbConfig.database, table, indexName]
    );
    return Number(rows[0]?.cnt || 0) > 0;
}

async function runMigration() {
    console.log('🕊️ [MIGRATION] Memulai migrasi Kategori Manajemen Pembelajaran & Scoped Trainer...');
    const connection = await mysql.createConnection(dbConfig);

    try {
        await connection.beginTransaction();

        // 1. Buat Tabel learning_categories
        console.log('-> Memastikan tabel learning_categories...');
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS learning_categories (
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
                INDEX idx_learning_cat_code (code),
                CONSTRAINT fk_learning_cat_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
            ) ENGINE=InnoDB;
        `);

        // 2. Buat Tabel category_trainers
        console.log('-> Memastikan tabel category_trainers...');
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS category_trainers (
                id VARCHAR(36) PRIMARY KEY,
                category_id VARCHAR(36) NOT NULL,
                trainer_id VARCHAR(36) NOT NULL,
                assigned_by VARCHAR(36) NULL,
                assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY uq_category_trainer (category_id, trainer_id),
                INDEX idx_cat_trainers_trainer (trainer_id),
                INDEX idx_cat_trainers_category (category_id),
                CONSTRAINT fk_ct_category FOREIGN KEY (category_id) REFERENCES learning_categories(id) ON DELETE CASCADE,
                CONSTRAINT fk_ct_trainer FOREIGN KEY (trainer_id) REFERENCES users(id) ON DELETE CASCADE,
                CONSTRAINT fk_ct_assigned_by FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL
            ) ENGINE=InnoDB;
        `);

        // 3. Modifikasi tabel trainings (+ category_id)
        if (!await columnExists(connection, 'trainings', 'category_id')) {
            console.log('-> Menambahkan kolom category_id ke tabel trainings...');
            await connection.execute(`ALTER TABLE trainings ADD COLUMN category_id VARCHAR(36) NULL AFTER id`);
        }
        if (!await foreignKeyExists(connection, 'trainings', 'fk_trainings_category')) {
            console.log('-> Menambahkan foreign key fk_trainings_category...');
            await connection.execute(`ALTER TABLE trainings ADD CONSTRAINT fk_trainings_category FOREIGN KEY (category_id) REFERENCES learning_categories(id) ON DELETE RESTRICT`);
        }
        if (!await indexExists(connection, 'trainings', 'idx_trainings_category_created')) {
            console.log('-> Menambahkan index idx_trainings_category_created...');
            await connection.execute(`ALTER TABLE trainings ADD INDEX idx_trainings_category_created (category_id, created_at)`);
        }

        // 4. Modifikasi tabel exams (+ category_id)
        if (!await columnExists(connection, 'exams', 'category_id')) {
            console.log('-> Menambahkan kolom category_id ke tabel exams...');
            await connection.execute(`ALTER TABLE exams ADD COLUMN category_id VARCHAR(36) NULL AFTER id`);
        }
        if (!await foreignKeyExists(connection, 'exams', 'fk_exams_category')) {
            console.log('-> Menambahkan foreign key fk_exams_category...');
            await connection.execute(`ALTER TABLE exams ADD CONSTRAINT fk_exams_category FOREIGN KEY (category_id) REFERENCES learning_categories(id) ON DELETE RESTRICT`);
        }
        if (!await indexExists(connection, 'exams', 'idx_exams_category_created')) {
            console.log('-> Menambahkan index idx_exams_category_created...');
            await connection.execute(`ALTER TABLE exams ADD INDEX idx_exams_category_created (category_id, created_at)`);
        }

        // 5. Modifikasi tabel modules (+ category_id)
        if (!await columnExists(connection, 'modules', 'category_id')) {
            console.log('-> Menambahkan kolom category_id ke tabel modules...');
            await connection.execute(`ALTER TABLE modules ADD COLUMN category_id VARCHAR(36) NULL AFTER id`);
        }
        if (!await foreignKeyExists(connection, 'modules', 'fk_modules_category')) {
            console.log('-> Menambahkan foreign key fk_modules_category...');
            await connection.execute(`ALTER TABLE modules ADD CONSTRAINT fk_modules_category FOREIGN KEY (category_id) REFERENCES learning_categories(id) ON DELETE RESTRICT`);
        }
        if (!await indexExists(connection, 'modules', 'idx_modules_category_created')) {
            console.log('-> Menambahkan index idx_modules_category_created...');
            await connection.execute(`ALTER TABLE modules ADD INDEX idx_modules_category_created (category_id, created_at)`);
        }

        // 6. Buat Kategori Default jika belum ada (Safe Data Backfill)
        const defaultCategoryId = '00000000-0000-0000-0000-000000000001';
        const [existingCategory] = await connection.execute(
            `SELECT id FROM learning_categories WHERE id = ? OR code = 'UMUM' LIMIT 1`,
            [defaultCategoryId]
        );

        let finalDefaultCatId = defaultCategoryId;
        if (existingCategory.length === 0) {
            console.log('-> Membuat kategori default "Kategori Umum" (code: UMUM)...');
            await connection.execute(
                `INSERT INTO learning_categories (id, name, code, description, color, is_active)
                 VALUES (?, 'Kategori Umum', 'UMUM', 'Kategori default untuk materi, bank soal, dan modul umum.', '#0ea5e9', TRUE)`,
                [defaultCategoryId]
            );
        } else {
            finalDefaultCatId = existingCategory[0].id;
        }

        // 7. Backfill data eksisting yang category_id nya masih NULL
        console.log('-> Melakukan backfill category_id pada trainings eksisting...');
        await connection.execute(`UPDATE trainings SET category_id = ? WHERE category_id IS NULL`, [finalDefaultCatId]);

        console.log('-> Melakukan backfill category_id pada exams eksisting...');
        await connection.execute(`UPDATE exams SET category_id = ? WHERE category_id IS NULL`, [finalDefaultCatId]);

        console.log('-> Melakukan backfill category_id pada modules eksisting...');
        await connection.execute(`UPDATE modules SET category_id = ? WHERE category_id IS NULL`, [finalDefaultCatId]);

        // 8. Assign semua trainer eksisting ke Kategori Default agar tidak kehilangan akses data awal
        console.log('-> Memberikan assignment Kategori Default ke semua user dengan role "trainer"...');
        const [trainers] = await connection.execute(`SELECT id FROM users WHERE role = 'trainer'`);
        for (const t of trainers) {
            await connection.execute(
                `INSERT IGNORE INTO category_trainers (id, category_id, trainer_id, assigned_at)
                 VALUES (?, ?, ?, NOW())`,
                [randomUUID(), finalDefaultCatId, t.id]
            );
        }

        await connection.commit();
        console.log('✅ [MIGRATION SUCCESS] Migrasi Kategori dan Scoped Trainer selesai dengan sukses!');
    } catch (err) {
        await connection.rollback();
        console.error('❌ [MIGRATION FAILED] Terjadi kesalahan saat migrasi:', err);
        throw err;
    } finally {
        await connection.end();
    }
}

runMigration().catch(() => process.exit(1));
