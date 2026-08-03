import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { executeQuery } from '../src/lib/db';

async function runMigration() {
    console.log('🔄 Memulai eksekusi migrasi skema database...');

    const migrations: Array<{ name: string; query: string; ignoreMissingColumn?: boolean }> = [
        {
            name: 'Tambah kolom reset_token ke tabel users',
            query: `ALTER TABLE users ADD COLUMN reset_token VARCHAR(255) NULL;`
        },
        {
            name: 'Tambah kolom reset_token_expires ke tabel users',
            query: `ALTER TABLE users ADD COLUMN reset_token_expires DATETIME NULL;`
        },
        {
            name: 'Standardisasi enum role users ke trainee',
            query: `ALTER TABLE users MODIFY role ENUM('admin', 'trainer', 'trainee', 'participant') NOT NULL DEFAULT 'trainee';`
        },
        {
            name: 'Update data role participant ke trainee',
            query: `UPDATE users SET role = 'trainee' WHERE role = 'participant';`
        },
        {
            name: 'Kunci enum role users ke admin, trainer, trainee',
            query: `ALTER TABLE users MODIFY role ENUM('admin', 'trainer', 'trainee') NOT NULL DEFAULT 'trainee';`
        },
        {
            name: 'Tambah/Sesuaikan kolom image_url pada proctor_snapshots',
            query: `ALTER TABLE proctor_snapshots ADD COLUMN image_url VARCHAR(500) NULL;`
        },
        {
            name: 'Jadikan kolom proctor legacy nullable',
            query: `ALTER TABLE proctor_snapshots MODIFY COLUMN image_base64 LONGTEXT NULL;`,
            ignoreMissingColumn: true
        },
        {
            name: 'Buat tabel audit_logs',
            query: `CREATE TABLE IF NOT EXISTS audit_logs (
                id VARCHAR(36) PRIMARY KEY,
                user_id VARCHAR(36) NULL,
                action_type VARCHAR(50) NOT NULL,
                entity VARCHAR(50) NOT NULL,
                entity_id VARCHAR(36) NULL,
                details JSON NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB;`
        },
        {
            name: 'Izinkan audit event sistem tanpa user',
            query: `ALTER TABLE audit_logs MODIFY COLUMN user_id VARCHAR(36) NULL;`
        },
        {
            name: 'Index users role dan created_at',
            query: `ALTER TABLE users ADD INDEX idx_users_role_created (role, created_at);`
        },
        {
            name: 'Index users reset_token',
            query: `ALTER TABLE users ADD INDEX idx_users_reset_token (reset_token);`
        },
        {
            name: 'Index questions exam_id',
            query: `ALTER TABLE questions ADD INDEX idx_questions_exam (exam_id);`
        },
        {
            name: 'Index module_items urutan modul',
            query: `ALTER TABLE module_items ADD INDEX idx_module_items_module_order (module_id, sequence_order);`
        },
        {
            name: 'Index module_items lookup item',
            query: `ALTER TABLE module_items ADD INDEX idx_module_items_lookup (module_id, item_type, item_id);`
        },
        {
            name: 'Index sessions modul dan waktu',
            query: `ALTER TABLE sessions ADD INDEX idx_sessions_module_time (module_id, start_time, end_time);`
        },
        {
            name: 'Index session_participants user',
            query: `ALTER TABLE session_participants ADD INDEX idx_session_participants_user (user_id);`
        },
        {
            name: 'Index user_progress session item',
            query: `ALTER TABLE user_progress ADD INDEX idx_progress_session_item (session_id, module_item_id);`
        },
        {
            name: 'Unique progress per user, session, dan item',
            query: `ALTER TABLE user_progress ADD UNIQUE INDEX uq_progress (user_id, session_id, module_item_id);`
        },
        {
            name: 'Index proctor_snapshots monitoring',
            query: `ALTER TABLE proctor_snapshots ADD INDEX idx_proctor_session_user_time (session_id, user_id, captured_at);`
        },
        {
            name: 'Index notifications user created',
            query: `ALTER TABLE notifications ADD INDEX idx_notifications_user_created (user_id, created_at);`
        },
        {
            name: 'Index notifications user read',
            query: `ALTER TABLE notifications ADD INDEX idx_notifications_user_read (user_id, is_read);`
        },
        {
            name: 'Index audit created',
            query: `ALTER TABLE audit_logs ADD INDEX idx_audit_created (created_at);`
        },
        {
            name: 'Index audit user created',
            query: `ALTER TABLE audit_logs ADD INDEX idx_audit_user_created (user_id, created_at);`
        },
        {
            name: 'Index audit entity',
            query: `ALTER TABLE audit_logs ADD INDEX idx_audit_entity (entity, entity_id);`
        }
    ];

    let hasUnexpectedError = false;
    for (const m of migrations) {
        try {
            console.log(`⏳ Menjalankan: ${m.name}...`);
            await executeQuery(m.query);
            console.log(`✅ Berhasil: ${m.name}`);
        } catch (err: any) {
            const isAlreadyApplied = err.message?.includes('Duplicate column name')
                || err.message?.includes('Duplicate key name')
                || err.message?.includes('already exists')
                || (m.ignoreMissingColumn && err.message?.includes('Unknown column'));
            if (isAlreadyApplied) {
                console.log(`ℹ️ Dilewati (sudah ada): ${m.name}`);
            } else {
                hasUnexpectedError = true;
                console.log(`⚠️ Catatan: ${err.message}`);
            }
        }
    }

    console.log('🎉 Migrasi database selesai disinkronkan!');
    if (hasUnexpectedError) {
        throw new Error('Migrasi selesai dengan error yang memerlukan penanganan.');
    }
}

runMigration().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
