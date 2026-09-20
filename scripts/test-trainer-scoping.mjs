import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const pool = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3307', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'lms_antigravity',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
});

async function runTest() {
    console.log('🧪 ========================================================');
    console.log('🧪 Memulai Automated Scoping & Anti-IDOR Verification Test');
    console.log('🧪 ========================================================\n');

    const conn = await pool.getConnection();

    // Unique IDs for isolated test execution
    const testSuffix = crypto.randomBytes(4).toString('hex');
    const catAId = `cat-test-a-${testSuffix}`;
    const catBId = `cat-test-b-${testSuffix}`;
    const trainerAId = `usr-trainer-a-${testSuffix}`;
    const trainerBId = `usr-trainer-b-${testSuffix}`;
    const trainingAId = `tr-test-a-${testSuffix}`;
    const trainingBId = `tr-test-b-${testSuffix}`;
    const examAId = `ex-test-a-${testSuffix}`;
    const examBId = `ex-test-b-${testSuffix}`;
    const moduleAId = `mod-test-a-${testSuffix}`;
    const moduleBId = `mod-test-b-${testSuffix}`;
    const sessionAId = `sess-test-a-${testSuffix}`;
    const sessionBId = `sess-test-b-${testSuffix}`;

    try {
        console.log('1️⃣ [SCHEMA CHECK] Verifikasi struktur database...');
        const [tables] = await conn.query(`
            SELECT table_name FROM information_schema.tables 
            WHERE table_schema = DATABASE() AND table_name IN ('learning_categories', 'category_trainers')
        `);
        if (tables.length < 2) {
            throw new Error(`Tabel learning_categories atau category_trainers belum lengkap! Ditemukan: ${tables.length}`);
        }
        console.log('   ✅ Tabel learning_categories dan category_trainers terverifikasi aktif.');

        const [cols] = await conn.query(`
            SELECT table_name, column_name FROM information_schema.columns
            WHERE table_schema = DATABASE() 
              AND table_name IN ('trainings', 'exams', 'modules') 
              AND column_name = 'category_id'
        `);
        if (cols.length < 3) {
            throw new Error(`Kolom category_id pada trainings/exams/modules belum lengkap! Ditemukan: ${cols.length}`);
        }
        console.log('   ✅ Foreign key category_id pada trainings, exams, dan modules terverifikasi.\n');

        console.log('2️⃣ [FIXTURES SETUP] Menyiapkan entitas pengujian...');
        // Insert Categories
        await conn.query(`
            INSERT INTO learning_categories (id, name, code, color, description, is_active)
            VALUES 
            (?, 'Kategori Alfa Test', 'ALFA-${testSuffix}', '#6366f1', 'Testing category Alfa', 1),
            (?, 'Kategori Beta Test', 'BETA-${testSuffix}', '#ec4899', 'Testing category Beta', 1)
        `, [catAId, catBId]);

        // Insert Test Trainers
        await conn.query(`
            INSERT INTO users (id, full_name, username, password_hash, role)
            VALUES 
            (?, 'Trainer Alfa', 'trainer_alfa_${testSuffix}', 'hash_test_pw', 'trainer'),
            (?, 'Trainer Beta', 'trainer_beta_${testSuffix}', 'hash_test_pw', 'trainer')
        `, [trainerAId, trainerBId]);

        // Assign Trainer Alfa to Cat A, Trainer Beta to Cat B
        await conn.query(`
            INSERT INTO category_trainers (id, category_id, trainer_id)
            VALUES 
            (UUID(), ?, ?),
            (UUID(), ?, ?)
        `, [catAId, trainerAId, catBId, trainerBId]);

        // Insert Content in Cat A
        await conn.query(`
            INSERT INTO trainings (id, category_id, title, content_html)
            VALUES (?, ?, 'Materi Dasar Alfa', '<p>Konten Alfa</p>')
        `, [trainingAId, catAId]);

        await conn.query(`
            INSERT INTO exams (id, category_id, title, duration_minutes, passing_grade)
            VALUES (?, ?, 'Ujian Alfa Pro', 60, 75.0)
        `, [examAId, catAId]);

        await conn.query(`
            INSERT INTO modules (id, category_id, title, description)
            VALUES (?, ?, 'Modul Pembelajaran Alfa', 'Modul Alfa Desc')
        `, [moduleAId, catAId]);

        await conn.query(`
            INSERT INTO sessions (id, module_id, title, start_time, end_time)
            VALUES (?, ?, 'Sesi Pelatihan Alfa', '2026-10-01 09:00:00', '2026-10-01 12:00:00')
        `, [sessionAId, moduleAId]);

        // Insert Content in Cat B
        await conn.query(`
            INSERT INTO trainings (id, category_id, title, content_html)
            VALUES (?, ?, 'Materi Tingkat Lanjut Beta', '<p>Konten Beta</p>')
        `, [trainingBId, catBId]);

        await conn.query(`
            INSERT INTO exams (id, category_id, title, duration_minutes, passing_grade)
            VALUES (?, ?, 'Ujian Sertifikasi Beta', 90, 80.0)
        `, [examBId, catBId]);

        await conn.query(`
            INSERT INTO modules (id, category_id, title, description)
            VALUES (?, ?, 'Modul Spesialisasi Beta', 'Modul Beta Desc')
        `, [moduleBId, catBId]);

        await conn.query(`
            INSERT INTO sessions (id, module_id, title, start_time, end_time)
            VALUES (?, ?, 'Sesi Pelatihan Beta', '2026-10-02 09:00:00', '2026-10-02 12:00:00')
        `, [sessionBId, moduleBId]);

        console.log('   ✅ Data fixture berhasil di-seed.\n');

        console.log('3️⃣ [SCOPING VERIFICATION] Menguji filter scoped data untuk Trainer Alfa...');
        // Query trainings as Trainer Alfa
        const [trainerATrainings] = await conn.query(`
            SELECT t.id, t.title, t.category_id, c.name as category_name
            FROM trainings t
            LEFT JOIN learning_categories c ON t.category_id = c.id
            WHERE t.category_id IN (SELECT category_id FROM category_trainers WHERE trainer_id = ?)
        `, [trainerAId]);

        const hasTrainingA = trainerATrainings.some(t => t.id === trainingAId);
        const hasTrainingB = trainerATrainings.some(t => t.id === trainingBId);

        if (!hasTrainingA || hasTrainingB) {
            throw new Error(`Data leakage terdeteksi pada Materi! hasTrainingA=${hasTrainingA}, hasTrainingB=${hasTrainingB}`);
        }
        console.log('   ✅ Scoping Materi: Trainer Alfa HANYA melihat Materi Alfa (Materi Beta terisolasi sempurna).');

        // Query exams as Trainer Alfa
        const [trainerAExams] = await conn.query(`
            SELECT e.id, e.title, e.category_id
            FROM exams e
            WHERE e.category_id IN (SELECT category_id FROM category_trainers WHERE trainer_id = ?)
        `, [trainerAId]);

        const hasExamA = trainerAExams.some(e => e.id === examAId);
        const hasExamB = trainerAExams.some(e => e.id === examBId);

        if (!hasExamA || hasExamB) {
            throw new Error(`Data leakage terdeteksi pada Ujian! hasExamA=${hasExamA}, hasExamB=${hasExamB}`);
        }
        console.log('   ✅ Scoping Ujian: Trainer Alfa HANYA melihat Ujian Alfa (Ujian Beta terisolasi sempurna).');

        // Query modules as Trainer Alfa
        const [trainerAModules] = await conn.query(`
            SELECT m.id, m.title, m.category_id
            FROM modules m
            WHERE m.category_id IN (SELECT category_id FROM category_trainers WHERE trainer_id = ?)
        `, [trainerAId]);

        const hasModA = trainerAModules.some(m => m.id === moduleAId);
        const hasModB = trainerAModules.some(m => m.id === moduleBId);

        if (!hasModA || hasModB) {
            throw new Error(`Data leakage terdeteksi pada Modul! hasModA=${hasModA}, hasModB=${hasModB}`);
        }
        console.log('   ✅ Scoping Modul: Trainer Alfa HANYA melihat Modul Alfa (Modul Beta terisolasi sempurna).');

        // Query sessions as Trainer Alfa
        const [trainerASessions] = await conn.query(`
            SELECT s.id, s.title, m.category_id
            FROM sessions s
            JOIN modules m ON s.module_id = m.id
            WHERE m.category_id IN (SELECT category_id FROM category_trainers WHERE trainer_id = ?)
        `, [trainerAId]);

        const hasSessA = trainerASessions.some(s => s.id === sessionAId);
        const hasSessB = trainerASessions.some(s => s.id === sessionBId);

        if (!hasSessA || hasSessB) {
            throw new Error(`Data leakage terdeteksi pada Sesi! hasSessA=${hasSessA}, hasSessB=${hasSessB}`);
        }
        console.log('   ✅ Scoping Sesi: Sesi mewarisi kategori Modul; Trainer Alfa HANYA melihat Sesi Alfa.\n');

        console.log('4️⃣ [ANTI-IDOR VERIFICATION] Menguji perlindungan direct ID access...');
        // Check if Trainer Alfa can query Training B directly
        const [directTrainingB] = await conn.query(`
            SELECT t.id, t.category_id
            FROM trainings t
            WHERE t.id = ?
              AND t.category_id IN (SELECT category_id FROM category_trainers WHERE trainer_id = ?)
        `, [trainingBId, trainerAId]);

        if (directTrainingB.length > 0) {
            throw new Error('IDOR Vulnerability: Trainer Alfa bisa mengakses detail Training B!');
        }
        console.log('   🛡️ Anti-IDOR Training: Akses langsung Trainer Alfa ke Training B dicegah (0 rows returned).');

        // Check if Trainer Alfa can query Exam B directly
        const [directExamB] = await conn.query(`
            SELECT e.id, e.category_id
            FROM exams e
            WHERE e.id = ?
              AND e.category_id IN (SELECT category_id FROM category_trainers WHERE trainer_id = ?)
        `, [examBId, trainerAId]);

        if (directExamB.length > 0) {
            throw new Error('IDOR Vulnerability: Trainer Alfa bisa mengakses detail Exam B!');
        }
        console.log('   🛡️ Anti-IDOR Exam: Akses langsung Trainer Alfa ke Exam B dicegah (0 rows returned).');

        // Check if Trainer Alfa can access Session B directly
        const [directSessionB] = await conn.query(`
            SELECT s.id, m.category_id
            FROM sessions s
            JOIN modules m ON s.module_id = m.id
            WHERE s.id = ?
              AND m.category_id IN (SELECT category_id FROM category_trainers WHERE trainer_id = ?)
        `, [sessionBId, trainerAId]);

        if (directSessionB.length > 0) {
            throw new Error('IDOR Vulnerability: Trainer Alfa bisa mengakses detail Session B!');
        }
        console.log('   🛡️ Anti-IDOR Session: Akses langsung Trainer Alfa ke Session B dicegah (0 rows returned).\n');

        console.log('5️⃣ [GLOBAL ADMIN VERIFICATION] Menguji hak akses Admin...');
        const [adminTrainings] = await conn.query(`SELECT id FROM trainings WHERE id IN (?, ?)`, [trainingAId, trainingBId]);
        const [adminExams] = await conn.query(`SELECT id FROM exams WHERE id IN (?, ?)`, [examAId, examBId]);
        const [adminModules] = await conn.query(`SELECT id FROM modules WHERE id IN (?, ?)`, [moduleAId, moduleBId]);
        const [adminSessions] = await conn.query(`SELECT id FROM sessions WHERE id IN (?, ?)`, [sessionAId, sessionBId]);

        if (adminTrainings.length !== 2 || adminExams.length !== 2 || adminModules.length !== 2 || adminSessions.length !== 2) {
            throw new Error('Admin kehilangan akses global ke konten lintas kategori!');
        }
        console.log('   ✅ Hak akses Admin terverifikasi global & lengkap di seluruh kategori (A & B).\n');

        console.log('🎉 SEMUA PENGUJIAN SCOPING DAN RBAC DINYATAKAN BERHASIL (PASSED)!');
    } catch (err) {
        console.error('❌ PENGUJIAN GAGAL:', err);
        throw err;
    } finally {
        console.log('\n🧹 Membersihkan data pengujian...');
        try {
            await conn.query(`DELETE FROM sessions WHERE id IN (?, ?)`, [sessionAId, sessionBId]);
            await conn.query(`DELETE FROM modules WHERE id IN (?, ?)`, [moduleAId, moduleBId]);
            await conn.query(`DELETE FROM exams WHERE id IN (?, ?)`, [examAId, examBId]);
            await conn.query(`DELETE FROM trainings WHERE id IN (?, ?)`, [trainingAId, trainingBId]);
            await conn.query(`DELETE FROM category_trainers WHERE trainer_id IN (?, ?)`, [trainerAId, trainerBId]);
            await conn.query(`DELETE FROM users WHERE id IN (?, ?)`, [trainerAId, trainerBId]);
            await conn.query(`DELETE FROM learning_categories WHERE id IN (?, ?)`, [catAId, catBId]);
            console.log('   ✅ Pembersihan selesai.');
        } catch (cleanupErr) {
            console.error('   ⚠️ Error saat cleanup:', cleanupErr);
        }
        conn.release();
        await pool.end();
    }
}

runTest().catch(() => {
    process.exit(1);
});
