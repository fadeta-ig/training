import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { executeQuery } from '../src/lib/db';

async function runMigration() {
    console.log('🔄 Memulai eksekusi migrasi skema database...');

    const migrations = [
        {
            name: 'Tambah kolom reset_token ke tabel users',
            query: `ALTER TABLE users ADD COLUMN reset_token VARCHAR(255) NULL, ADD COLUMN reset_token_expires DATETIME NULL;`
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
        }
    ];

    for (const m of migrations) {
        try {
            console.log(`⏳ Menjalankan: ${m.name}...`);
            await executeQuery(m.query);
            console.log(`✅ Berhasil: ${m.name}`);
        } catch (err: any) {
            if (err.message?.includes('Duplicate column name') || err.message?.includes('already exists')) {
                console.log(`ℹ️ Dilewati (sudah ada): ${m.name}`);
            } else {
                console.log(`⚠️ Catatan: ${err.message}`);
            }
        }
    }

    console.log('🎉 Migrasi database selesai disinkronkan!');
    process.exit(0);
}

runMigration();
