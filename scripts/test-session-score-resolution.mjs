import assert from 'node:assert/strict';
import { pickHighestAttempt, resolveExamResultView } from '../src/lib/exam-results.ts';

const regularAttempt = {
    id: 'regular',
    final_score: 50,
    original_score: 25,
    score_adjustment: 25,
    adjustment_reason: 'Penyesuaian regular',
    attempt_number: 1,
};
const remedialAttempt = {
    id: 'remedial',
    final_score: 0,
    original_score: 0,
    score_adjustment: 0,
    attempt_number: 2,
};

assert.equal(
    pickHighestAttempt([regularAttempt, remedialAttempt])?.id,
    'regular',
    'nilai remedial yang lebih rendah tidak boleh menggantikan nilai terbaik regular',
);

const adjustedAttempt = {
    ...regularAttempt,
    final_score: 75,
    score_adjustment: 50,
    adjustment_reason: 'Tambahan 25 setelah remedial',
};
const liveDraft = resolveExamResultView({
    resultState: 'draft',
    published: {
        best_score: 50,
        passing_grade: 70,
        outcome: 'remedial_required',
        remedial_session_id: 'remedial-session-1',
        attempts_used: 1,
    },
    publishedAttempt: adjustedAttempt,
    bestAttempt: adjustedAttempt,
    hasPending: false,
    currentCycleComplete: true,
    passingGrade: 70,
    hasNextRemedialSession: false,
    nextRemedialSessionId: null,
});

assert.equal(liveDraft.finalScore, 75, 'mode draft harus menggunakan skor live terbaru');
assert.equal(liveDraft.scoreAdjustment, 50, 'badge draft harus berasal dari attempt live yang sama');
assert.equal(liveDraft.outcome, 'passed', 'outcome draft harus berubah menjadi passed setelah mencapai passing grade');
assert.equal(liveDraft.published, false);

const officialPublication = resolveExamResultView({
    resultState: 'published',
    published: {
        best_score: 50,
        passing_grade: 70,
        outcome: 'remedial_required',
        remedial_session_id: 'remedial-session-1',
        attempts_used: 1,
    },
    publishedAttempt: adjustedAttempt,
    bestAttempt: adjustedAttempt,
    hasPending: true,
    currentCycleComplete: true,
    passingGrade: 70,
    hasNextRemedialSession: false,
    nextRemedialSessionId: null,
});

assert.equal(officialPublication.finalScore, 50, 'mode published harus mempertahankan skor snapshot resmi');
assert.equal(officialPublication.scoreAdjustment, 25, 'badge published harus konsisten dengan skor snapshot, bukan adjustment live');
assert.equal(officialPublication.outcome, 'remedial_required');
assert.equal(officialPublication.gradingPending, false, 'pending live tidak boleh menimpa status snapshot resmi');
assert.equal(officialPublication.published, true);

const missingPublishedSnapshot = resolveExamResultView({
    resultState: 'published',
    published: null,
    publishedAttempt: null,
    bestAttempt: adjustedAttempt,
    hasPending: false,
    currentCycleComplete: true,
    passingGrade: 70,
    hasNextRemedialSession: false,
    nextRemedialSessionId: null,
});
assert.equal(missingPublishedSnapshot.finalScore, null, 'snapshot yang hilang tidak boleh digantikan data live seolah-olah resmi');
assert.equal(missingPublishedSnapshot.published, false);

const pendingDraft = resolveExamResultView({
    resultState: 'draft',
    published: null,
    publishedAttempt: null,
    bestAttempt: adjustedAttempt,
    hasPending: true,
    currentCycleComplete: true,
    passingGrade: 70,
    hasNextRemedialSession: false,
    nextRemedialSessionId: null,
});
assert.equal(pendingDraft.outcome, 'grading_pending', 'penilaian esai pending harus mengalahkan klasifikasi skor draft');

const failedDraft = resolveExamResultView({
    resultState: 'draft',
    published: null,
    publishedAttempt: null,
    bestAttempt: regularAttempt,
    hasPending: false,
    currentCycleComplete: true,
    passingGrade: 70,
    hasNextRemedialSession: true,
    nextRemedialSessionId: 'remedial-session-2',
});
assert.equal(failedDraft.outcome, 'remedial_required');
assert.equal(failedDraft.remedialSessionId, 'remedial-session-2');

const incompleteRemedialDraft = resolveExamResultView({
    resultState: 'draft',
    published: null,
    publishedAttempt: null,
    bestAttempt: regularAttempt,
    hasPending: false,
    currentCycleComplete: false,
    passingGrade: 70,
    hasNextRemedialSession: false,
    nextRemedialSessionId: null,
});
assert.equal(incompleteRemedialDraft.outcome, 'draft', 'remedial yang belum dikerjakan belum boleh disebut habis');

console.log('Session score resolution tests passed.');
