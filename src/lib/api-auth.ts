import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { executeQuery } from '@/lib/db';

export type AuthRole = 'admin' | 'trainer' | 'trainee';

export interface AuthenticatedUser {
    id: string;
    username: string;
    role: AuthRole;
}

interface AuthOptions {
    /** Roles allowed to access this route. Empty = any authenticated user. */
    allowedRoles?: AuthRole[];
    /** If true, skip CSRF origin check (e.g., for GET-only routes). Default: false */
    skipCsrf?: boolean;
}

function normalizeOrigin(value: string | null | undefined): string | null {
    if (!value) return null;
    try {
        return new URL(value).origin;
    } catch {
        return null;
    }
}

function getAllowedOrigins(request: NextRequest): Set<string> {
    const origins = new Set<string>();
    const envOrigin = normalizeOrigin(process.env.NEXT_PUBLIC_APP_URL);

    if (envOrigin) {
        origins.add(envOrigin);
    }

    if (process.env.NODE_ENV !== 'production') {
        const requestOrigin = normalizeOrigin(request.nextUrl.origin);
        if (requestOrigin) origins.add(requestOrigin);
    }

    return origins;
}

export function validateMutationOrigin(request: NextRequest): NextResponse | null {
    const originHeader = request.headers.get('origin');
    const refererHeader = request.headers.get('referer');
    const origin = normalizeOrigin(originHeader) || normalizeOrigin(refererHeader);
    const allowedOrigins = getAllowedOrigins(request);

    if (origin && !allowedOrigins.has(origin)) {
        return NextResponse.json(
            { success: false, error: 'Request origin tidak diizinkan' },
            { status: 403 }
        );
    }

    return null;
}

/**
 * Higher-order function to protect API routes with JWT authentication.
 * Extracts user from JWT cookie and passes it to the handler.
 * Includes CSRF Origin validation for mutation methods.
 *
 * @example
 * export const POST = withAuth(async (request, user) => {
 *     // user is guaranteed to be authenticated
 *     return NextResponse.json({ hello: user.username });
 * }, { allowedRoles: ['admin'] });
 */
export function withAuth(
    handler: (
        request: NextRequest,
        user: AuthenticatedUser,
        context?: any
    ) => Promise<NextResponse>,
    options: AuthOptions = {}
) {
    return async (request: NextRequest, context?: any): Promise<NextResponse> => {
        // CSRF Protection: validate Origin header on mutation methods
        const method = request.method.toUpperCase();
        const isMutation = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method);

        if (isMutation && !options.skipCsrf) {
            const invalidOrigin = validateMutationOrigin(request);
            if (invalidOrigin) return invalidOrigin;
        }

        const token = request.cookies.get('training_session')?.value;

        if (!token) {
            return NextResponse.json(
                { success: false, error: 'Autentikasi diperlukan' },
                { status: 401 }
            );
        }

        const payload = await verifyToken(token);
        if (!payload || !payload.sub) {
            return NextResponse.json(
                { success: false, error: 'Token tidak valid atau kedaluwarsa' },
                { status: 401 }
            );
        }

        let currentUsers: Array<{ id: string; username: string; role: AuthRole }>;
        try {
            currentUsers = await executeQuery(
                `SELECT id, username, role FROM users WHERE id = ? LIMIT 1`,
                [payload.sub],
            );
        } catch {
            return NextResponse.json(
                { success: false, error: 'Layanan autentikasi sementara tidak tersedia' },
                { status: 503 }
            );
        }

        const user = currentUsers[0];
        if (!user || !['admin', 'trainer', 'trainee'].includes(user.role)) {
            return NextResponse.json(
                { success: false, error: 'Akun tidak aktif atau tidak ditemukan' },
                { status: 401 }
            );
        }

        if (options.allowedRoles?.length && !options.allowedRoles.includes(user.role)) {
            return NextResponse.json(
                { success: false, error: 'Anda tidak memiliki akses ke resource ini' },
                { status: 403 }
            );
        }

        return handler(request, user, context);
    };
}

