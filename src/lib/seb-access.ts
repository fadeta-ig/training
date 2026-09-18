import crypto from 'crypto';
import { jwtVerify, SignJWT } from 'jose';
import type { NextRequest } from 'next/server';
import { JWT_SECRET } from '@/lib/auth';
import { parseStoredSebConfigKeys } from '@/lib/seb-config';
import { getAppBaseUrl } from '@/lib/app-url';

const encodedKey = new TextEncoder().encode(JWT_SECRET);
const SEB_TOKEN_ISSUER = 'lms-seb-preflight';
const HASH_PATTERN = /^[a-f0-9]{64}$/;

export type SebAccessMode = 'verified' | 'admin_override';

export interface SebClientEvidence {
    configKeyHash?: string | null;
    browserExamKeyHash?: string | null;
    pageUrl?: string | null;
}

export interface SebHashVerification {
    valid: boolean;
    matchedUrl?: string;
    matchedKey?: string;
    source?: 'config_key';
}

function normalizeHash(value: string | null | undefined): string | null {
    const normalized = value?.trim().toLowerCase() || '';
    return HASH_PATTERN.test(normalized) ? normalized : null;
}

function safeAbsoluteUrl(value: string | null | undefined): string | null {
    if (!value) return null;
    try {
        const url = new URL(value);
        if (!['http:', 'https:'].includes(url.protocol)) return null;
        url.hash = '';
        return url.toString();
    } catch {
        return null;
    }
}

function requestUrlCandidates(request: NextRequest): string[] {
    const parsed = new URL(request.url);
    const origin = process.env.NODE_ENV === 'production' ? getAppBaseUrl() : parsed.origin;
    const candidates = [
        `${origin}${parsed.pathname}${parsed.search}`,
        `${origin}${parsed.pathname}`,
    ];
    return Array.from(new Set(candidates.map(safeAbsoluteUrl).filter((url): url is string => Boolean(url))));
}

function matchesUrlHash(clientHash: string, url: string, configKey: string): boolean {
    const expected = crypto.createHash('sha256').update(url + configKey, 'utf8').digest('hex');
    const left = Buffer.from(clientHash, 'hex');
    const right = Buffer.from(expected, 'hex');
    return left.length === right.length && crypto.timingSafeEqual(left, right);
}

export function verifySebHashes(
    request: NextRequest,
    storedConfigKeys: string | null | undefined,
    evidence: SebClientEvidence = {},
): SebHashVerification {
    const keys = parseStoredSebConfigKeys(storedConfigKeys);
    if (keys.length === 0) return { valid: false };

    const headerConfigHash = normalizeHash(request.headers.get('x-safeexambrowser-configkeyhash'));
    const evidenceConfigHash = normalizeHash(evidence.configKeyHash);

    const requestUrls = requestUrlCandidates(request);
    const requestOrigins = new Set(requestUrls.map((url) => new URL(url).origin));
    const rawPageUrl = safeAbsoluteUrl(evidence.pageUrl);
    const pageUrl = rawPageUrl && requestOrigins.has(new URL(rawPageUrl).origin) ? rawPageUrl : null;
    const checks: Array<{ hash: string; urls: string[]; source: 'config_key' }> = [];

    if (headerConfigHash) checks.push({ hash: headerConfigHash, urls: requestUrls, source: 'config_key' });
    if (pageUrl && evidenceConfigHash) checks.push({ hash: evidenceConfigHash, urls: [pageUrl], source: 'config_key' });

    for (const check of checks) {
        for (const key of keys) {
            for (const url of check.urls) {
                if (matchesUrlHash(check.hash, url, key)) {
                    return { valid: true, matchedUrl: url, matchedKey: key, source: check.source };
                }
            }
        }
    }

    return { valid: false };
}

export async function signSebAccessToken(input: {
    userId: string;
    sessionId: string;
    mode: SebAccessMode;
    expiresAt: Date;
}): Promise<string> {
    const expirationSeconds = Math.max(Math.floor(Date.now() / 1000) + 60, Math.floor(input.expiresAt.getTime() / 1000));
    return new SignJWT({ sid: input.sessionId, mode: input.mode, purpose: 'seb_access' })
        .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
        .setIssuer(SEB_TOKEN_ISSUER)
        .setSubject(input.userId)
        .setIssuedAt()
        .setExpirationTime(expirationSeconds)
        .sign(encodedKey);
}

export async function verifySebAccessToken(
    token: string | null | undefined,
    expected: { userId: string; sessionId: string },
): Promise<{ valid: boolean; mode?: SebAccessMode }> {
    if (!token) return { valid: false };
    try {
        const { payload } = await jwtVerify(token, encodedKey, { issuer: SEB_TOKEN_ISSUER });
        const mode = payload.mode;
        const validMode = mode === 'verified' || mode === 'admin_override';
        return {
            valid: payload.purpose === 'seb_access'
                && payload.sub === expected.userId
                && payload.sid === expected.sessionId
                && validMode,
            mode: validMode ? mode : undefined,
        };
    } catch {
        return { valid: false };
    }
}

export function looksLikeSebUserAgent(userAgent: string | null | undefined): boolean {
    const value = userAgent?.toLowerCase() || '';
    return value.includes('safeexambrowser') || value.includes('seb/') || /\bseb\b/i.test(value);
}
