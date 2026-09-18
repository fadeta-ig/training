import crypto from 'crypto';

export interface SklVerificationIdentity {
    enrollmentId: string;
    sklNumber: string;
    decidedAt: string | Date | null;
}

function canonicalIdentity(input: SklVerificationIdentity): string {
    let decisionDate = 'no-decision-date';
    if (input.decidedAt) {
        const raw = input.decidedAt instanceof Date ? input.decidedAt.toISOString() : input.decidedAt.trim();
        const sqlDate = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})$/.exec(raw);
        const parsed = new Date(sqlDate ? `${sqlDate[1]}T${sqlDate[2]}+07:00` : raw);
        if (!Number.isFinite(parsed.getTime())) throw new Error('Tanggal keputusan SKL tidak valid');
        decisionDate = parsed.toISOString();
    }
    return [
        'skl-verification-v1',
        input.enrollmentId,
        input.sklNumber.trim(),
        decisionDate,
    ].join(':');
}

export function createSklVerificationTokenWithSecret(
    input: SklVerificationIdentity,
    secret: string,
): string {
    return crypto
        .createHmac('sha256', secret)
        .update(canonicalIdentity(input), 'utf8')
        .digest('hex');
}

export function verifySklVerificationTokenWithSecret(
    actual: string,
    input: SklVerificationIdentity,
    secret: string,
): boolean {
    if (!/^[a-f0-9]{64}$/i.test(actual)) return false;
    const expected = createSklVerificationTokenWithSecret(input, secret);
    const left = Buffer.from(actual.toLowerCase(), 'utf8');
    const right = Buffer.from(expected.toLowerCase(), 'utf8');
    return left.length === right.length && crypto.timingSafeEqual(left, right);
}
