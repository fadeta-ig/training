import mysql, { Pool, PoolOptions } from 'mysql2/promise';

/**
 * LMS Nusamitra Consulting MySQL Connection Pool (Singleton Pattern)
 * Prevents multiple pools during Next.js HMR (Hot Module Replacement).
 */
const configuredConnectionLimit = Number.parseInt(process.env.DB_CONNECTION_LIMIT || '20', 10);
const connectionLimit = Number.isFinite(configuredConnectionLimit)
  ? Math.min(Math.max(configuredConnectionLimit, 2), 50)
  : 20;

const poolConfig: PoolOptions = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_NAME || 'lms_antigravity',
  waitForConnections: true,
  connectionLimit,
  maxIdle: Math.min(connectionLimit, 10),
  idleTimeout: 60_000,
  queueLimit: 500,
  connectTimeout: 10_000,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  dateStrings: true,
  timezone: '+07:00',
};

declare global {
  var __dbPool: Pool | undefined;
}

/** Module-scope cache for production — avoids leaking pools on every call. */
let productionPool: Pool | undefined;

function getPool(): Pool {
  if (process.env.NODE_ENV === 'production') {
    if (!productionPool) {
      productionPool = mysql.createPool(poolConfig);
    }
    return productionPool;
  }

  if (!global.__dbPool) {
    global.__dbPool = mysql.createPool(poolConfig);
  }
  return global.__dbPool;
}

const pool = getPool();

export class DatabaseError extends Error {
  public readonly code?: string;
  public readonly errno?: number;
  public readonly sqlState?: string;

  constructor(message: string, originalError?: any) {
    super(message);
    this.name = 'DatabaseError';
    if (originalError && typeof originalError === 'object') {
      this.code = originalError.code;
      this.errno = originalError.errno;
      this.sqlState = originalError.sqlState;
    }
  }
}

/**
 * Type-safe query executor with defensive error handling.
 * Wraps `pool.execute` to avoid repetitive try/catch throughout the codebase.
 */
export async function executeQuery<T>(
  query: string,
  values: (string | number | boolean | Date | Buffer | null)[] = [],
): Promise<T> {
  try {
    const [results] = await pool.execute(query, values);
    return results as T;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown DB error';
    console.error('[DB_ERROR]', message);
    throw new DatabaseError('Operasi database gagal', error);
  }
}

export default pool;
