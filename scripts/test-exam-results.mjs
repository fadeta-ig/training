import assert from 'node:assert/strict';
import { classifyPublishedOutcome, pickHighestAttempt } from '../src/lib/exam-results.ts';

const attempts = [
    { id: 'first', final_score: 72.5, attempt_number: 1 },
    { id: 'lower-remedial', final_score: 68, attempt_number: 2 },
    { id: 'highest', final_score: 84, attempt_number: 3 },
];

assert.equal(pickHighestAttempt(attempts)?.id, 'highest', 'attempt tertinggi harus dipilih');
assert.equal(
    pickHighestAttempt([
        { id: 'older', final_score: 80, attempt_number: 1 },
        { id: 'newer', final_score: 80, attempt_number: 2 },
    ])?.id,
    'newer',
    'attempt terbaru harus menjadi tie breaker',
);
assert.equal(pickHighestAttempt([{ id: 'pending', final_score: null, attempt_number: 1 }]), null);

assert.equal(classifyPublishedOutcome({ bestScore: 75, passingGrade: 75, hasNextRemedialSession: false }), 'passed');
assert.equal(classifyPublishedOutcome({ bestScore: 74.99, passingGrade: 75, hasNextRemedialSession: true }), 'remedial_required');
assert.equal(classifyPublishedOutcome({ bestScore: 74.99, passingGrade: 75, hasNextRemedialSession: false }), 'remedial_exhausted');
assert.equal(classifyPublishedOutcome({ bestScore: null, passingGrade: 75, hasNextRemedialSession: true }), 'absent');

console.log('Exam result policy tests passed.');
