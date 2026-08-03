import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    throw new Error('[FATAL] JWT_SECRET environment variable is not set. Proxy cannot start.');
}
const encodedKey = new TextEncoder().encode(JWT_SECRET);

export async function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const isProtectedAdminRoute = pathname.startsWith('/admin');
    const isProtectedDashboardRoute = pathname.startsWith('/dashboard');

    if (isProtectedAdminRoute || isProtectedDashboardRoute) {
        const token = request.cookies.get('training_session')?.value;

        if (!token) {
            return NextResponse.redirect(new URL('/auth/login', request.url));
        }

        try {
            const { payload } = await jwtVerify(token, encodedKey);
            const role = payload.role as string;

            if (isProtectedAdminRoute && role !== 'admin' && role !== 'trainer') {
                return NextResponse.redirect(new URL('/dashboard', request.url));
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
                const { payload } = await jwtVerify(token, encodedKey);
                if (payload.role === 'admin' || payload.role === 'trainer') {
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
                const { payload } = await jwtVerify(token, encodedKey);
                if (payload.role === 'admin' || payload.role === 'trainer') {
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

export const config = {
    matcher: ['/', '/admin/:path*', '/dashboard/:path*', '/auth/login'],
};
