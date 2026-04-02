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
    const cutoff = now - windowMs;
    for (const [key, entry] of store) {
        entry.timestamps = entry.timestamps.filter((t) => t > cutoff);
        if (entry.timestamps.length === 0) {
            store.delete(key);
        }
    }
}

interface RateLimitConfig {
    /** Time window in milliseconds */
    windowMs: number;
    /** Max requests allowed within the window */
    maxRequests: number;
    /** Custom error message */
    message?: string;
}

/**
 * Extracts the client IP from a Next.js request.
 * Prioritizes proxy headers for deployments behind reverse proxies.
 */
function getClientIp(request: NextRequest): string {
    return (
        request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        request.headers.get('x-real-ip') ||
        'unknown'
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
    const { windowMs, maxRequests, message } = config;
    const ip = getClientIp(request);
    const key = `${ip}:${request.nextUrl.pathname}`;
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
