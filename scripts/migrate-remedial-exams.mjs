import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';

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
        console.log('--- Starting Migration: Add remedial_exam_id to exams table ---');

        // Check if column exists
        const [columns] = await connection.query(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'exams' AND COLUMN_NAME = 'remedial_exam_id'
        `, [poolConfig.database]);

        if (Array.isArray(columns) && columns.length > 0) {
            console.log('Column "remedial_exam_id" already exists in "exams" table. Skipping column addition.');
        } else {
            console.log('Adding column "remedial_exam_id" to "exams" table...');
            await connection.query(`
                ALTER TABLE exams 
                ADD COLUMN remedial_exam_id VARCHAR(36) NULL AFTER max_attempts
            `);
            console.log('Column "remedial_exam_id" added successfully.');
        }

        // Check index
        const [indexes] = await connection.query(`
            SHOW INDEX FROM exams WHERE Key_name = 'idx_exams_remedial'
        `);

        if (!Array.isArray(indexes) || indexes.length === 0) {
            console.log('Adding index "idx_exams_remedial"...');
            await connection.query(`
                ALTER TABLE exams 
                ADD INDEX idx_exams_remedial (remedial_exam_id)
            `);
            console.log('Index "idx_exams_remedial" added.');
        }

        // Check foreign key constraint
        const [fks] = await connection.query(`
            SELECT CONSTRAINT_NAME 
            FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS 
            WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'exams' AND CONSTRAINT_NAME = 'fk_exams_remedial'
        `, [poolConfig.database]);

        if (!Array.isArray(fks) || fks.length === 0) {
            try {
                console.log('Adding foreign key constraint "fk_exams_remedial"...');
                await connection.query(`
                    ALTER TABLE exams 
                    ADD CONSTRAINT fk_exams_remedial 
                    FOREIGN KEY (remedial_exam_id) REFERENCES exams(id) ON DELETE SET NULL
                `);
                console.log('Foreign key constraint "fk_exams_remedial" added.');
            } catch (fkErr) {
                console.log('Note on FK constraint:', fkErr.message);
            }
        }

        console.log('--- Migration Finished Successfully ---');
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    } finally {
        await connection.end();
    }
}

migrate();
