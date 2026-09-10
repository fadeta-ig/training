import { NextRequest, NextResponse } from 'next/server';

/**
 * In-memory sliding-window rate limiter.
 * Tracks request timestamps per IP and rejects excess traffic
 * beyond the configured threshold.
 *
 * WARNING: This is per-process. In a multi-instance deployment,
 * use Redis-based rate limiting instead.
 */

interface RateLimitEntry {
    timestamps: number[];
}

const store = new Map<string, RateLimitEntry>();

/** Purge stale entries every 5 minutes to prevent memory leaks. */
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanupStaleEntries(windowMs: number): void {
    const now = Date.now();
    if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;

    lastCleanup = now;
    queueMicrotask(() => {
        const cutoff = Date.now() - windowMs;
        for (const [key, entry] of store) {
            entry.timestamps = entry.timestamps.filter((t) => t > cutoff);
            if (entry.timestamps.length === 0) {
                store.delete(key);
            }
        }
    });
}

interface RateLimitConfig {
    /** Time window in milliseconds */
    windowMs: number;
    /** Max requests allowed within the window */
    maxRequests: number;
    /** Custom error message */
    message?: string;
    /** Stable authenticated identifier; falls back to client IP when omitted. */
    identifier?: string;
}

/**
 * Extracts the client IP from a Next.js request.
 * Prioritizes proxy headers for deployments behind reverse proxies (Nginx / Cloudflare).
 */
export function getClientIp(request: NextRequest): string {
    return (
        request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        request.headers.get('x-real-ip') ||
        '127.0.0.1'
    );
}

/**
 * Rate limit check — returns null if allowed, or a NextResponse (429) if exceeded.
 *
 * @example
 * const blocked = checkRateLimit(request, { windowMs: 60_000, maxRequests: 5 });
 * if (blocked) return blocked;
 */
export function checkRateLimit(
    request: NextRequest,
    config: RateLimitConfig
): NextResponse | null {
    const { windowMs, maxRequests, message, identifier } = config;
    const clientKey = identifier || getClientIp(request);
    const key = `${clientKey}:${request.nextUrl.pathname}`;
    const now = Date.now();

    cleanupStaleEntries(windowMs);

    const entry = store.get(key) || { timestamps: [] };

    // Remove timestamps outside the current window
    entry.timestamps = entry.timestamps.filter((t) => t > now - windowMs);

    if (entry.timestamps.length >= maxRequests) {
        return NextResponse.json(
            {
                success: false,
                error: message || 'Terlalu banyak permintaan. Silakan coba beberapa saat lagi.',
            },
            {
                status: 429,
                headers: {
                    'Retry-After': String(Math.ceil(windowMs / 1000)),
                },
            }
        );
    }

    entry.timestamps.push(now);
    store.set(key, entry);

    return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// FAILURE-BASED ADAPTIVE RATE LIMITING (LOGIN SECURITY)
// ─────────────────────────────────────────────────────────────────────────────
// Legitimate users with valid credentials are NEVER throttled or queued.
// Throttling triggers ONLY upon consecutive failed authentication attempts.
// ─────────────────────────────────────────────────────────────────────────────

interface FailureEntry {
    timestamps: number[];
    lockedUntil?: number;
}

const failureStore = new Map<string, FailureEntry>();

/** 5 consecutive failed passwords on the same username triggers a 2-minute cooldown */
const MAX_FAILED_PER_ACCOUNT = 5;
const ACCOUNT_LOCKOUT_MS = 2 * 60 * 1000;

/** 50 accumulated failures across the same IP triggers a 2-minute subnet cooldown */
const MAX_FAILED_PER_IP = 50;
const IP_LOCKOUT_MS = 2 * 60 * 1000;

function cleanupFailureStore(): void {
    const now = Date.now();
    for (const [key, entry] of failureStore) {
        if (entry.lockedUntil && entry.lockedUntil < now) {
            entry.lockedUntil = undefined;
        }
        entry.timestamps = entry.timestamps.filter((t) => t > now - Math.max(ACCOUNT_LOCKOUT_MS, IP_LOCKOUT_MS));
        if (entry.timestamps.length === 0 && !entry.lockedUntil) {
            failureStore.delete(key);
        }
    }
}

/**
 * Pre-login check: verifies if this account or IP is currently locked due to previous failures.
 * Returns HTTP 429 if locked, or null if clear to proceed with authentication.
 */
export function checkLoginLockout(request: NextRequest, username: string): NextResponse | null {
    cleanupFailureStore();
    const now = Date.now();
    const cleanUsername = (username || '').trim().toLowerCase();
    const clientIp = getClientIp(request);

    // 1. Check per-account lockout
    if (cleanUsername) {
        const accountEntry = failureStore.get(`acc:${cleanUsername}`);
        if (accountEntry?.lockedUntil && accountEntry.lockedUntil > now) {
            const secondsLeft = Math.ceil((accountEntry.lockedUntil - now) / 1000);
            return NextResponse.json(
                {
                    success: false,
                    error: `Akun ini terkunci sementara karena ${MAX_FAILED_PER_ACCOUNT} kali kesalahan password berturut-turut. Silakan coba ${secondsLeft} detik lagi.`,
                },
                {
                    status: 429,
                    headers: { 'Retry-After': String(secondsLeft) },
                }
            );
        }
    }

    // 2. Check per-IP mass attack lockout (anti-credential spraying)
    const ipEntry = failureStore.get(`ip:${clientIp}`);
    if (ipEntry?.lockedUntil && ipEntry.lockedUntil > now) {
        const secondsLeft = Math.ceil((ipEntry.lockedUntil - now) / 1000);
        return NextResponse.json(
            {
                success: false,
                error: `Terlalu banyak kegagalan login dari jaringan ini. Silakan tunggu ${secondsLeft} detik sebelum mencoba kembali.`,
            },
            {
                status: 429,
                headers: { 'Retry-After': String(secondsLeft) },
            }
        );
    }

    return null;
}

/**
 * Records a failed login attempt (wrong password or account not found).
 * Increments failure count and locks account/IP if threshold is breached.
 */
export function recordLoginFailure(request: NextRequest, username: string): void {
    const now = Date.now();
    const cleanUsername = (username || '').trim().toLowerCase();
    const clientIp = getClientIp(request);

    // Record account failure
    if (cleanUsername) {
        const key = `acc:${cleanUsername}`;
        const entry = failureStore.get(key) || { timestamps: [] };
        entry.timestamps = entry.timestamps.filter((t) => t > now - ACCOUNT_LOCKOUT_MS);
        entry.timestamps.push(now);

        if (entry.timestamps.length >= MAX_FAILED_PER_ACCOUNT) {
            entry.lockedUntil = now + ACCOUNT_LOCKOUT_MS;
        }
        failureStore.set(key, entry);
    }

    // Record IP failure
    const ipKey = `ip:${clientIp}`;
    const ipEntry = failureStore.get(ipKey) || { timestamps: [] };
    ipEntry.timestamps = ipEntry.timestamps.filter((t) => t > now - IP_LOCKOUT_MS);
    ipEntry.timestamps.push(now);

    if (ipEntry.timestamps.length >= MAX_FAILED_PER_IP) {
        ipEntry.lockedUntil = now + IP_LOCKOUT_MS;
    }
    failureStore.set(ipKey, ipEntry);
}

/**
 * Resets the failed attempt counter for a username upon successful authentication.
 * Guarantees zero penalty accumulation for legitimate users.
 */
export function recordLoginSuccess(username: string): void {
    const cleanUsername = (username || '').trim().toLowerCase();
    if (cleanUsername) {
        failureStore.delete(`acc:${cleanUsername}`);
    }
}

