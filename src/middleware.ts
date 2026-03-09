import { NextRequest, NextResponse } from 'next/server';

/**
 * SEB (Safe Exam Browser) Middleware
 *
 * Intercepts all requests to `/session/exam/*`.
 * Validates the `x-safeexambrowser-configkeyhash` header
 * against the stored SEB_CONFIG_KEY_HASH environment variable.
 *
 * If the session does NOT require SEB (determined by query param),
 * the request is allowed through.
 */

const SEB_HEADER_KEY = 'x-safeexambrowser-configkeyhash';
const UNAUTHORIZED_PATH = '/unauthorized';
const EXAM_ROUTE_PREFIX = '/session/exam';

export function middleware(request: NextRequest): NextResponse {
    const { pathname, searchParams } = request.nextUrl;

    // Only intercept exam routes
    if (!pathname.startsWith(EXAM_ROUTE_PREFIX)) {
        return NextResponse.next();
    }

    // Check if SEB is required for this session (passed as query or will be
    // resolved server-side; default to required for maximum security)
    const sebRequired = searchParams.get('seb') !== 'false';

    if (!sebRequired) {
        return NextResponse.next();
    }

    // Validate SEB config key hash
    const clientHash = request.headers.get(SEB_HEADER_KEY);
    const serverHash = process.env.SEB_CONFIG_KEY_HASH;

    if (!serverHash) {
        console.warn('[SEB_MIDDLEWARE] SEB_CONFIG_KEY_HASH not configured in environment.');
        return NextResponse.redirect(new URL(UNAUTHORIZED_PATH, request.url));
    }

    if (!clientHash || clientHash !== serverHash) {
        const clientIp = request.headers.get('x-forwarded-for') ?? 'unknown';
        console.warn('[SEB_MIDDLEWARE] Invalid or missing SEB header from:', clientIp);
        return NextResponse.redirect(new URL(UNAUTHORIZED_PATH, request.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/session/exam/:path*'],
};
