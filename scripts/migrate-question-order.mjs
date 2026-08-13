import mysql from 'mysql2/promise';
import fs from 'node:fs';
import path from 'node:path';

function loadEnv() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return;

  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadEnv();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'lms_antigravity',
};

async function migrateQuestionOrder() {
  console.log('🕊️  [MIGRATE-QUESTION-ORDER] Connecting to database...');
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log('✅  Database connection established successfully.\n');

    // 1. Check if sequence_order column exists
    const [cols] = await connection.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'questions' AND COLUMN_NAME = 'sequence_order'
    `, [dbConfig.database]);

    if (cols.length === 0) {
      console.log('📌  Adding `sequence_order` column to `questions` table...');
      await connection.query(`
        ALTER TABLE questions 
        ADD COLUMN sequence_order INT NOT NULL DEFAULT 0
      `);
      console.log('✅  Column `sequence_order` added successfully.');
    } else {
      console.log('ℹ️   Column `sequence_order` already exists.');
    }

    // 2. Check if index idx_questions_exam_order exists
    const [indexes] = await connection.query(`
      SELECT INDEX_NAME 
      FROM INFORMATION_SCHEMA.STATISTICS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'questions' AND INDEX_NAME = 'idx_questions_exam_order'
    `, [dbConfig.database]);

    if (indexes.length === 0) {
      console.log('📌  Creating index `idx_questions_exam_order`...');
      await connection.query(`
        CREATE INDEX idx_questions_exam_order ON questions (exam_id, sequence_order)
      `);
      console.log('✅  Index `idx_questions_exam_order` created successfully.');
    } else {
      console.log('ℹ️   Index `idx_questions_exam_order` already exists.');
    }

    // 3. Back-fill sequence_order for each exam
    console.log('📌  Back-filling `sequence_order` for existing questions per exam...');
    const [exams] = await connection.query(`SELECT DISTINCT exam_id FROM questions`);
    
    let totalUpdated = 0;
    for (const examRow of exams) {
      const examId = examRow.exam_id;
      const [questions] = await connection.query(
        `SELECT id FROM questions WHERE exam_id = ? ORDER BY id ASC`,
        [examId]
      );

      for (let idx = 0; idx < questions.length; idx++) {
        await connection.query(
          `UPDATE questions SET sequence_order = ? WHERE id = ?`,
          [idx + 1, questions[idx].id]
        );
        totalUpdated++;
      }
    }

    console.log(`✅  Back-fill complete. Updated ${totalUpdated} questions across ${exams.length} exams.`);
    console.log('\n🎉  Question order migration finished successfully!');
  } catch (error) {
    console.error('❌  Migration failed:', error.message);
    process.exitCode = 1;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

migrateQuestionOrder();
