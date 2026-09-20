import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-for-testing';

function canonicalIdentity(input) {
    return [
        'answer-sheet-v1',
        input.sessionId,
        input.participantId,
        input.examId,
        String(input.attemptNumber),
        input.submittedAt || 'not-submitted',
    ].join(':');
}

function createAnswerSheetDocumentId(input) {
    const signature = crypto
        .createHmac('sha256', JWT_SECRET)
        .update(canonicalIdentity(input), 'utf8')
        .digest('hex')
        .slice(0, 24)
        .toUpperCase();
    return `ANS-${signature}`;
}

function verifyAnswerSheetDocumentId(actual, expected) {
    const left = Buffer.from(actual.trim().toUpperCase(), 'utf8');
    const right = Buffer.from(expected.trim().toUpperCase(), 'utf8');
    return left.length === right.length && crypto.timingSafeEqual(left, right);
}

// 1. Test Document ID Verification
console.log('🧪 Test 1: Document ID Generation & Tamper Resistance...');
const docA = createAnswerSheetDocumentId({
    sessionId: 'session-1',
    participantId: 'user-1',
    examId: 'exam-A',
    attemptNumber: 1,
    submittedAt: '2026-09-20 10:00:00',
});

const docB = createAnswerSheetDocumentId({
    sessionId: 'session-1',
    participantId: 'user-1',
    examId: 'exam-B',
    attemptNumber: 1,
    submittedAt: '2026-09-20 10:00:00',
});

assert.notEqual(docA, docB, 'Different exams must produce different document IDs');
assert.ok(verifyAnswerSheetDocumentId(docA, docA), 'Exact docId must pass verification');
assert.ok(!verifyAnswerSheetDocumentId(docA, docB), 'Mismatched docId must fail verification');
console.log('✅ Document ID verification tests passed.');

// 2. Test Exam Resolution Logic Simulation
console.log('\n🧪 Test 2: Exam Selection Resolution Simulation...');
function resolveTargetExamAndAttempt({
    requestedExamId,
    requestedAttempt,
    answeredSubmissions,
    moduleItems,
}) {
    let targetExamId;
    let targetAttemptNumber = requestedAttempt;

    if (requestedExamId) {
        const directMatch = answeredSubmissions.filter((s) => s.exam_id === requestedExamId);
        if (directMatch.length > 0) {
            targetExamId = requestedExamId;
            if (!targetAttemptNumber) {
                targetAttemptNumber = directMatch[0].attempt_number;
            }
        } else {
            // Remedial check fallback
            targetExamId = requestedExamId;
            targetAttemptNumber = targetAttemptNumber || 1;
        }
    } else {
        if (answeredSubmissions.length > 0) {
            targetExamId = answeredSubmissions[0].exam_id;
            targetAttemptNumber = targetAttemptNumber || answeredSubmissions[0].attempt_number;
        } else {
            targetExamId = moduleItems[0]?.item_id;
            targetAttemptNumber = targetAttemptNumber || 1;
        }
    }

    return {
        targetExamId,
        targetAttemptNumber: Number(targetAttemptNumber || 1),
    };
}

const answeredData = [
    { exam_id: 'exam-post-test', attempt_number: 2, last_answered: '2026-09-20 12:00:00' },
    { exam_id: 'exam-pre-test', attempt_number: 1, last_answered: '2026-09-20 09:00:00' },
];
const moduleItemsData = [
    { item_id: 'exam-pre-test', sequence_order: 1 },
    { item_id: 'exam-post-test', sequence_order: 2 },
];

// Case A: User explicitly requests exam-pre-test
const resA = resolveTargetExamAndAttempt({
    requestedExamId: 'exam-pre-test',
    requestedAttempt: undefined,
    answeredSubmissions: answeredData,
    moduleItems: moduleItemsData,
});
assert.equal(resA.targetExamId, 'exam-pre-test', 'Must return requested exam');
assert.equal(resA.targetAttemptNumber, 1, 'Must pick attempt from answered submissions');

// Case B: User explicitly requests exam-post-test
const resB = resolveTargetExamAndAttempt({
    requestedExamId: 'exam-post-test',
    requestedAttempt: 1,
    answeredSubmissions: answeredData,
    moduleItems: moduleItemsData,
});
assert.equal(resB.targetExamId, 'exam-post-test', 'Must return requested exam');
assert.equal(resB.targetAttemptNumber, 1, 'Must honor requested attempt');

// Case C: User does NOT specify examId (generic answer sheet link)
// Previously: ORDER BY sequence_order ASC blindly picked exam-pre-test!
// Now: Picks answeredData[0] which is exam-post-test (the latest exam submitted by the user)
const resC = resolveTargetExamAndAttempt({
    requestedExamId: undefined,
    requestedAttempt: undefined,
    answeredSubmissions: answeredData,
    moduleItems: moduleItemsData,
});
assert.equal(resC.targetExamId, 'exam-post-test', 'Without examId, must pick latest answered exam, not module first item');
assert.equal(resC.targetAttemptNumber, 2, 'Must pick latest attempt number');

console.log('✅ Exam selection resolution simulation tests passed.');
console.log('\n🎉 ALL ANSWER SHEET RESOLUTION TESTS PASSED!');
