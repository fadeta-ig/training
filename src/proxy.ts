import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

function getEncodedKey(): Uint8Array {
    const secret = process.env.JWT_SECRET || 'fallback-secret-for-build-time-only-change-in-env';
    return new TextEncoder().encode(secret);
}

export async function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const isProtectedAdminRoute = pathname.startsWith('/admin');
    const isProtectedDashboardRoute = pathname.startsWith('/dashboard');

    if (isProtectedAdminRoute || isProtectedDashboardRoute) {
        const token = request.cookies.get('training_session')?.value;

        if (!token) {
            const redirectUrl = new URL('/auth/login', request.url);
            redirectUrl.searchParams.set('redirect', pathname);
            return NextResponse.redirect(redirectUrl);
        }

        try {
            const { payload } = await jwtVerify(token, getEncodedKey());
            const role = String(payload.role || '');

            // Admin routes: only admin & trainer allowed
            if (isProtectedAdminRoute && role !== 'admin' && role !== 'trainer') {
                return NextResponse.redirect(new URL('/dashboard', request.url));
            }

            // Dashboard routes (participant portal): admins & trainers must be redirected to admin portal
            if (isProtectedDashboardRoute && (role === 'admin' || role === 'trainer')) {
                return NextResponse.redirect(new URL('/admin', request.url));
            }

            return NextResponse.next();
        } catch {
            const response = NextResponse.redirect(new URL('/auth/login', request.url));
            response.cookies.delete('training_session');
            return response;
        }
    }

    if (pathname === '/') {
        const token = request.cookies.get('training_session')?.value;
        if (token) {
            try {
                const { payload } = await jwtVerify(token, getEncodedKey());
                const role = String(payload.role || '');
                if (role === 'admin' || role === 'trainer') {
                    return NextResponse.redirect(new URL('/admin', request.url));
                }
                return NextResponse.redirect(new URL('/dashboard', request.url));
            } catch {
                return NextResponse.redirect(new URL('/auth/login', request.url));
            }
        }
        return NextResponse.redirect(new URL('/auth/login', request.url));
    }

    if (pathname === '/auth/login') {
        const token = request.cookies.get('training_session')?.value;
        if (token) {
            try {
                const { payload } = await jwtVerify(token, getEncodedKey());
                const role = String(payload.role || '');
                if (role === 'admin' || role === 'trainer') {
                    return NextResponse.redirect(new URL('/admin', request.url));
                }
                return NextResponse.redirect(new URL('/dashboard', request.url));
            } catch {
                return NextResponse.next();
            }
        }
    }

    return NextResponse.next();
}

export default proxy;

export const config = {
    matcher: ['/', '/admin/:path*', '/dashboard/:path*', '/auth/login'],
};
