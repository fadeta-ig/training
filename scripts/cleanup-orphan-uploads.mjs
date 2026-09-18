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

function walkUploadFiles(root, current = root) {
    if (!fs.existsSync(current)) return [];
    const files = [];
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
        const absolute = path.join(current, entry.name);
        const relative = path.relative(root, absolute);
        if (entry.isDirectory()) {
            if (relative.split(path.sep)[0].toLowerCase() === 'proctor') continue;
            files.push(...walkUploadFiles(root, absolute));
        } else if (entry.isFile()) {
            files.push(absolute);
        }
    }
    return files;
}

loadEnv();

const apply = process.argv.includes('--apply');
const minimumAgeHours = Math.max(1, Number(process.env.ORPHAN_UPLOAD_MIN_AGE_HOURS) || 24);
const uploadsRoot = path.resolve(process.cwd(), 'public', 'uploads');
const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_NAME || 'lms_antigravity',
});

try {
    const [directRows] = await connection.query(`
        SELECT media_url AS reference_url FROM training_media WHERE media_url LIKE '/uploads/%'
        UNION SELECT question_image FROM questions WHERE question_image LIKE '/uploads/%'
        UNION SELECT certificate_file_url FROM session_participants WHERE certificate_file_url LIKE '/uploads/%'
    `);
    const directReferences = new Set(directRows.map((row) => String(row.reference_url)));

    const [embeddedRows] = await connection.query(`
        SELECT content_html AS content FROM trainings WHERE content_html LIKE '%/uploads/%'
        UNION ALL SELECT question_text FROM questions WHERE question_text LIKE '%/uploads/%'
        UNION ALL SELECT CAST(options_json AS CHAR) FROM questions WHERE CAST(options_json AS CHAR) LIKE '%/uploads/%'
        UNION ALL SELECT question_snapshot FROM exam_answers WHERE question_snapshot LIKE '%/uploads/%'
        UNION ALL SELECT payload_json FROM question_import_batches WHERE payload_json LIKE '%/uploads/%'
    `);
    const embeddedReferences = embeddedRows.map((row) => String(row.content || ''));
    const cutoff = Date.now() - (minimumAgeHours * 60 * 60 * 1000);
    const candidates = [];

    for (const filePath of walkUploadFiles(uploadsRoot)) {
        const stat = fs.statSync(filePath);
        if (stat.mtimeMs > cutoff) continue;
        const relative = path.relative(uploadsRoot, filePath).split(path.sep).join('/');
        const publicUrl = `/uploads/${relative}`;
        const referenced = directReferences.has(publicUrl)
            || embeddedReferences.some((content) => content.includes(publicUrl));
        if (!referenced) candidates.push({ filePath, publicUrl, size: stat.size });
    }

    const totalBytes = candidates.reduce((sum, item) => sum + item.size, 0);
    console.log(`[UPLOADS] Mode: ${apply ? 'apply' : 'dry-run'}`);
    console.log(`[UPLOADS] Orphan candidates older than ${minimumAgeHours}h: ${candidates.length}`);
    console.log(`[UPLOADS] Reclaimable bytes: ${totalBytes}`);
    for (const item of candidates) console.log(`[UPLOADS] ${item.publicUrl}`);

    if (apply) {
        for (const item of candidates) fs.unlinkSync(item.filePath);
        console.log(`[UPLOADS] Deleted: ${candidates.length}`);
    } else if (candidates.length > 0) {
        console.log('[UPLOADS] Dry-run only. Review the list, then run npm run uploads:orphan-clean to delete.');
    }
} finally {
    await connection.end();
}
