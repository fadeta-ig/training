import { NextRequest, NextResponse } from 'next/server';
import { validateMutationOrigin } from '@/lib/api-auth';

export async function POST(request: NextRequest) {
    const invalidOrigin = validateMutationOrigin(request);
    if (invalidOrigin) return invalidOrigin;

    const response = NextResponse.json({ success: true, message: 'Berhasil logout' });

    // Clear the cookie
    response.cookies.delete('training_session');

    return response;
}
