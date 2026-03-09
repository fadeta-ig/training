import mysql, { Pool, PoolOptions } from 'mysql2/promise';

/**
 * Antigravity MySQL Connection Pool (Singleton Pattern)
 * Prevents multiple pools during Next.js HMR (Hot Module Replacement).
 * Host: localhost | Port: 3306 (XAMPP default)
 */
const poolConfig: PoolOptions = {
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT) ?? 3306,
  user: process.env.DB_USER ?? 'root',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_NAME ?? 'lms_antigravity',
  waitForConnections: true,
  connectionLimit: 20,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
};

declare global {
  // eslint-disable-next-line no-var
  var __dbPool: Pool | undefined;
}

function getPool(): Pool {
  if (process.env.NODE_ENV === 'production') {
    return mysql.createPool(poolConfig);
  }

  if (!global.__dbPool) {
    global.__dbPool = mysql.createPool(poolConfig);
  }
  return global.__dbPool;
}

const pool = getPool();

/**
 * Type-safe query executor with defensive error handling.
 * Wraps `pool.execute` to avoid repetitive try/catch throughout the codebase.
 */
export async function executeQuery<T>(
  query: string,
  values: (string | number | boolean | null)[] = [],
): Promise<T> {
  try {
    const [results] = await pool.execute(query, values);
    return results as T;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown DB error';
    console.error('[DB_ERROR]', message);
    throw new Error(`Database operation failed: ${message}`);
  }
}

export default pool;
