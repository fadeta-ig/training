import { JWT_SECRET } from '@/lib/auth';
import {
    createSklVerificationTokenWithSecret,
    verifySklVerificationTokenWithSecret,
    type SklVerificationIdentity,
} from '@/lib/skl-verification-core';

export function createSklVerificationToken(input: SklVerificationIdentity): string {
    return createSklVerificationTokenWithSecret(input, JWT_SECRET as string);
}

export function verifySklVerificationToken(actual: string, input: SklVerificationIdentity): boolean {
    return verifySklVerificationTokenWithSecret(actual, input, JWT_SECRET as string);
}
