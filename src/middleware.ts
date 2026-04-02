import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

// Cannot reuse /lib/auth.ts verifyToken directly if it relies on Node APIs like env directly
// but jose is edge-compatible, so we must recreate decoding here explicitly for Edge Runtime
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    throw new Error('[FATAL] JWT_SECRET environment variable is not set. Middleware cannot start.');
}
const encodedKey = new TextEncoder().encode(JWT_SECRET);

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Defined protected routes prefixes
    const isProtectedAdminRoute = pathname.startsWith('/admin');
    const isProtectedDashboardRoute = pathname.startsWith('/dashboard');

    if (isProtectedAdminRoute || isProtectedDashboardRoute) {
        const token = request.cookies.get('training_session')?.value;

        if (!token) {
            return NextResponse.redirect(new URL('/auth/login', request.url));
        }

        try {
            const { payload } = await jwtVerify(token, encodedKey);

            // Check roles
            const role = payload.role as string;

            if (isProtectedAdminRoute && role !== 'admin' && role !== 'trainer') {
                // If attempting to access /admin but not an admin/trainer, redirect to general dashboard
                return NextResponse.redirect(new URL('/dashboard', request.url));
            }

            // Valid session, continue
            return NextResponse.next();
        } catch (error) {
            // Token is invalid/expired
            const response = NextResponse.redirect(new URL('/auth/login', request.url));
            response.cookies.delete('training_session'); // Clear invalid token
            return response;
        }
    }

    // Redirect guest users from / to /auth/login or /dashboard
    if (pathname === '/') {
        const token = request.cookies.get('training_session')?.value;
        if (token) {
            try {
                const { payload } = await jwtVerify(token, encodedKey);
                if (payload.role === 'admin' || payload.role === 'trainer') {
                    return NextResponse.redirect(new URL('/admin', request.url));
                }
                return NextResponse.redirect(new URL('/dashboard', request.url));
            } catch (err) {
                return NextResponse.redirect(new URL('/auth/login', request.url));
            }
        }
        return NextResponse.redirect(new URL('/auth/login', request.url));
    }

    // Redirect authenticated users away from the login page (prevent back-navigation)
    if (pathname === '/auth/login') {
        const token = request.cookies.get('training_session')?.value;
        if (token) {
            try {
                const { payload } = await jwtVerify(token, encodedKey);
                if (payload.role === 'admin' || payload.role === 'trainer') {
                    return NextResponse.redirect(new URL('/admin', request.url));
                }
                return NextResponse.redirect(new URL('/dashboard', request.url));
            } catch (err) {
                // Token is invalid, let them access the login page
                return NextResponse.next();
            }
        }
        return NextResponse.next();
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/', '/admin/:path*', '/dashboard/:path*', '/auth/login'],
};
