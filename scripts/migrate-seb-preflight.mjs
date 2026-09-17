import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';

function loadEnvFile(filePath) {
    if (!fs.existsSync(filePath)) return;
    for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const separator = trimmed.indexOf('=');
        if (separator < 1) continue;
        const key = trimmed.slice(0, separator).trim();
        const value = trimmed.slice(separator + 1).trim().replace(/^['"]|['"]$/g, '');
        if (!(key in process.env)) process.env[key] = value;
    }
}

loadEnvFile(path.join(process.cwd(), '.env.local'));
loadEnvFile(path.join(process.cwd(), '.env'));

const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
});

try {
    await connection.execute(`
        CREATE TABLE IF NOT EXISTS seb_access_overrides (
          id          VARCHAR(36) PRIMARY KEY,
          session_id  VARCHAR(36) NOT NULL,
          user_id     VARCHAR(36) NOT NULL,
          granted_by  VARCHAR(36) NOT NULL,
          reason      VARCHAR(500) NOT NULL,
          expires_at  DATETIME NOT NULL,
          revoked_at  DATETIME NULL,
          created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_seb_override_lookup (session_id, user_id, expires_at, revoked_at),
          INDEX idx_seb_override_granted_by (granted_by, created_at),
          CONSTRAINT fk_seb_override_session FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
          CONSTRAINT fk_seb_override_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          CONSTRAINT fk_seb_override_admin FOREIGN KEY (granted_by) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB
    `);
    console.log('SEB preflight override migration completed.');
} finally {
    await connection.end();
}
