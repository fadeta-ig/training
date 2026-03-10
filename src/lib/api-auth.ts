import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';

export type AuthRole = 'admin' | 'participant';

export interface AuthenticatedUser {
    id: string;
    username: string;
    role: AuthRole;
}

interface AuthOptions {
    /** Roles allowed to access this route. Empty = any authenticated user. */
    allowedRoles?: AuthRole[];
}

/**
 * Higher-order function to protect API routes with JWT authentication.
 * Extracts user from JWT cookie and passes it to the handler.
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
        try {
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

            const user: AuthenticatedUser = {
                id: payload.sub,
                username: payload.username,
                role: payload.role as AuthRole,
            };

            // Role-based access control
            if (options.allowedRoles && options.allowedRoles.length > 0) {
                if (!options.allowedRoles.includes(user.role)) {
                    return NextResponse.json(
                        { success: false, error: 'Anda tidak memiliki akses ke resource ini' },
                        { status: 403 }
                    );
                }
            }

            return handler(request, user, context);
        } catch (error) {
            return NextResponse.json(
                { success: false, error: 'Kesalahan autentikasi' },
                { status: 401 }
            );
        }
    };
}
