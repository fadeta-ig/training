import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

// Parse .env.local if exists
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    for (const line of envContent.split('\n')) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
            const [k, ...v] = trimmed.split('=');
            const key = k.trim();
            const val = v.join('=').trim().replace(/^["'](.*)["']$/, '$1');
            if (!process.env[key]) {
                process.env[key] = val;
            }
        }
    }
}

const poolConfig = {
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_NAME || 'lms_antigravity',
    multipleStatements: true
};

async function connectWithFallback() {
    const portsToTry = [
        Number(process.env.DB_PORT) || 3306,
        3306,
        3307
    ];
    const uniquePorts = [...new Set(portsToTry)];
    let lastError = null;

    for (const port of uniquePorts) {
        try {
            console.log(`Connecting to MySQL at ${poolConfig.host}:${port}...`);
            const conn = await mysql.createConnection({
                ...poolConfig,
                port: port
            });
            console.log(`Connected successfully on port ${port}!`);
            return conn;
        } catch (err) {
            lastError = err;
            console.log(`Port ${port} failed: ${err.message}`);
        }
    }
    throw lastError;
}

async function migrate() {
    const connection = await connectWithFallback();

    try {
        console.log('1. Creating certification_programs table if not exists...');
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS certification_programs (
                id VARCHAR(36) PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                code VARCHAR(50) UNIQUE NULL,
                description TEXT NULL,
                is_active BOOLEAN NOT NULL DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB;
        `);

        console.log('2. Checking & adding approval columns to users table...');
        const [userCols] = await connection.execute(`
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'approval_status';
        `, [poolConfig.database]);

        if (!Array.isArray(userCols) || userCols.length === 0) {
            await connection.execute(`
                ALTER TABLE users 
                ADD COLUMN approval_status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'approved',
                ADD COLUMN rejection_reason VARCHAR(255) NULL,
                ADD COLUMN approved_at DATETIME NULL;
            `);
            console.log('   -> Added approval_status, rejection_reason, approved_at to users table.');
        } else {
            console.log('   -> approval_status column already exists on users table.');
        }

        console.log('3. Checking & adding certification & target period columns to participant_profiles table...');
        const [profileCols] = await connection.execute(`
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'participant_profiles' AND COLUMN_NAME = 'target_certification_id';
        `, [poolConfig.database]);

        if (!Array.isArray(profileCols) || profileCols.length === 0) {
            await connection.execute(`
                ALTER TABLE participant_profiles
                ADD COLUMN target_certification_id VARCHAR(36) NULL,
                ADD COLUMN target_certification_name VARCHAR(255) NULL,
                ADD COLUMN target_period VARCHAR(50) NULL;
            `);
            console.log('   -> Added target_certification_id, target_certification_name, target_period to participant_profiles table.');
        } else {
            console.log('   -> target_certification_id column already exists on participant_profiles table.');
        }

        console.log('4. Seeding foundational certification programs if empty...');
        const [existingPrograms] = await connection.execute(`SELECT COUNT(*) as count FROM certification_programs`);
        const count = existingPrograms[0]?.count || 0;

        if (count === 0) {
            const seedPrograms = [
                {
                    id: uuidv4(),
                    name: 'Pelatihan & Sertifikasi Transformasi Digital & Tata Kelola IT',
                    code: 'CERT-TDIT',
                    description: 'Program komprehensif standardisasi keahlian arsitektur teknologi, transformasi digital institusi, dan tata kelola sistem informasi.',
                    is_active: 1
                },
                {
                    id: uuidv4(),
                    name: 'Sertifikasi Manajemen Data, Analitik & Cloud Architecture',
                    code: 'CERT-MDCA',
                    description: 'Standardisasi kompetensi rekayasa data perusahaan, arsitektur komputasi awan, dan manajemen basis data skala tinggi.',
                    is_active: 1
                },
                {
                    id: uuidv4(),
                    name: 'Sertifikasi Keamanan Informasi & Cyber Security Specialist',
                    code: 'CERT-CSIS',
                    description: 'Program sertifikasi pertahanan siber, audit keamanan informasi ISO 27001, dan mitigasi ancaman keamanan sistem digital.',
                    is_active: 1
                },
                {
                    id: uuidv4(),
                    name: 'Sertifikasi Analisis Bisnis & Manajemen Proyek Teknologi',
                    code: 'CERT-BAPM',
                    description: 'Pengembangan kapasitas profesional dalam merancang analisis kebutuhan sistem, manajemen siklus hidup proyek, dan mitigasi risiko IT.',
                    is_active: 1
                }
            ];

            for (const p of seedPrograms) {
                await connection.execute(
                    `INSERT INTO certification_programs (id, name, code, description, is_active) VALUES (?, ?, ?, ?, ?)`,
                    [p.id, p.name, p.code, p.description, p.is_active]
                );
            }
            console.log(`   -> Seeded ${seedPrograms.length} foundational certification programs.`);
        } else {
            console.log(`   -> Table certification_programs already has ${count} records.`);
        }

        console.log('✅ Registration & Certification migration completed successfully!');
    } catch (err) {
        console.error('❌ Migration error:', err);
        throw err;
    } finally {
        await connection.end();
    }
}

migrate().catch((err) => {
    console.error(err);
    process.exit(1);
});
