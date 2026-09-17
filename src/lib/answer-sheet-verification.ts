import crypto from 'crypto';
import { JWT_SECRET } from '@/lib/auth';

interface AnswerSheetIdentity {
    sessionId: string;
    participantId: string;
    examId: string;
    attemptNumber: number;
    submittedAt: string | null;
}

function canonicalIdentity(input: AnswerSheetIdentity): string {
    return [
        'answer-sheet-v1',
        input.sessionId,
        input.participantId,
        input.examId,
        String(input.attemptNumber),
        input.submittedAt || 'not-submitted',
    ].join(':');
}

export function createAnswerSheetDocumentId(input: AnswerSheetIdentity): string {
    const signature = crypto
        .createHmac('sha256', JWT_SECRET as string)
        .update(canonicalIdentity(input), 'utf8')
        .digest('hex')
        .slice(0, 24)
        .toUpperCase();
    return `ANS-${signature}`;
}

export function verifyAnswerSheetDocumentId(actual: string, expected: string): boolean {
    const left = Buffer.from(actual.trim().toUpperCase(), 'utf8');
    const right = Buffer.from(expected.trim().toUpperCase(), 'utf8');
    return left.length === right.length && crypto.timingSafeEqual(left, right);
}
