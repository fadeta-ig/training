import { jwtVerify, SignJWT } from 'jose';

export const JWT_SECRET = process.env.JWT_SECRET || 'secret-key-super-secure-change-in-prod';
const encodedKey = new TextEncoder().encode(JWT_SECRET);

export interface TokenPayload {
    sub: string; // id
    username: string;
    role: string;
}

export async function signToken(payload: TokenPayload, expiresIn = '1d'): Promise<string> {
    const token = await new SignJWT({ ...payload })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime(expiresIn)
        .sign(encodedKey);

    return token;
}

export async function verifyToken(token: string): Promise<TokenPayload | null> {
    try {
        const { payload } = await jwtVerify(token, encodedKey);
        return payload as unknown as TokenPayload;
    } catch (error) {
        return null;
    }
}
