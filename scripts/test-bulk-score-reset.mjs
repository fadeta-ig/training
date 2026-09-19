import assert from 'node:assert/strict';
import { z } from 'zod';

// 1. Replicate the exact Zod schema used in the API route
const bulkAdjustScoreSchema = z.object({
    participant_ids: z.array(z.string().uuid()).min(1, 'Pilih minimal 1 peserta').max(1000)
        .refine((ids) => new Set(ids).size === ids.length, 'Daftar peserta mengandung ID duplikat'),
    module_item_id: z.string().uuid().optional(),
    adjustment_type: z.enum(['add', 'subtract', 'set', 'reset']),
    value: z.number().min(0).max(100).optional().default(0),
    reason: z.string().min(2, 'Alasan penyesuaian nilai wajib diisi (minimal 2 karakter)').max(255),
});

// Test schema validation
const validResetPayload = {
    participant_ids: ['a1111111-1111-4111-8111-111111111111', 'b2222222-2222-4222-8222-222222222222'],
    adjustment_type: 'reset',
    reason: 'Pembatalan bonus massal',
};

const parsed = bulkAdjustScoreSchema.safeParse(validResetPayload);
assert.equal(parsed.success, true, 'Schema should accept reset adjustment_type without value');
assert.equal(parsed.data.value, 0, 'Default value for reset should be 0');

const duplicateIdsPayload = {
    participant_ids: ['a1111111-1111-4111-8111-111111111111', 'a1111111-1111-4111-8111-111111111111'],
    adjustment_type: 'reset',
    reason: 'Pembatalan bonus massal',
};
assert.equal(bulkAdjustScoreSchema.safeParse(duplicateIdsPayload).success, false, 'Duplicate IDs must be rejected');

// 2. Logic testing function replicating route calculation
function calculateAdjustment(originalScore, currentAdjustment, adjustmentType, value) {
    let newAdjustment = currentAdjustment;
    let finalScore = 0;

    if (adjustmentType === 'add') {
        newAdjustment = Math.round((currentAdjustment + value) * 100) / 100;
        finalScore = Math.min(100, Math.max(0, Math.round((originalScore + newAdjustment) * 100) / 100));
    } else if (adjustmentType === 'subtract') {
        newAdjustment = Math.round((currentAdjustment - value) * 100) / 100;
        finalScore = Math.min(100, Math.max(0, Math.round((originalScore + newAdjustment) * 100) / 100));
    } else if (adjustmentType === 'set') {
        finalScore = Math.min(100, Math.max(0, Math.round(value * 100) / 100));
        newAdjustment = Math.round((finalScore - originalScore) * 100) / 100;
    } else if (adjustmentType === 'reset') {
        newAdjustment = 0.00;
        finalScore = originalScore;
    }

    return { newAdjustment, finalScore };
}

// Case 1: Participant had original score 65, received +10 bonus -> 75
const step1 = calculateAdjustment(65, 0, 'add', 10);
assert.equal(step1.newAdjustment, 10);
assert.equal(step1.finalScore, 75);

// Resetting back to original
const resetStep = calculateAdjustment(65, step1.newAdjustment, 'reset', 0);
assert.equal(resetStep.newAdjustment, 0);
assert.equal(resetStep.finalScore, 65, 'Final score must return to original score 65');

// Case 2: Idempotent reset for participant who never had an adjustment
const unadjustedReset = calculateAdjustment(80, 0, 'reset', 0);
assert.equal(unadjustedReset.newAdjustment, 0);
assert.equal(unadjustedReset.finalScore, 80);

// Case 3: Participant had penalty -15 (original 50 -> 35)
const stepPenalty = calculateAdjustment(50, 0, 'subtract', 15);
assert.equal(stepPenalty.newAdjustment, -15);
assert.equal(stepPenalty.finalScore, 35);

const resetPenalty = calculateAdjustment(50, stepPenalty.newAdjustment, 'reset', 0);
assert.equal(resetPenalty.newAdjustment, 0);
assert.equal(resetPenalty.finalScore, 50, 'Penalty must be completely removed on reset');

// Case 4: Multiple participants with varied original scores
const participants = [
    { id: '1', original: 45, currentAdj: 10 },
    { id: '2', original: 72, currentAdj: -5 },
    { id: '3', original: 90, currentAdj: 0 },
    { id: '4', original: 88, currentAdj: 12 },
];

const bulkResults = participants.map((p) => {
    return {
        id: p.id,
        ...calculateAdjustment(p.original, p.currentAdj, 'reset', 0),
    };
});

assert.deepEqual(bulkResults, [
    { id: '1', newAdjustment: 0, finalScore: 45 },
    { id: '2', newAdjustment: 0, finalScore: 72 },
    { id: '3', newAdjustment: 0, finalScore: 90 },
    { id: '4', newAdjustment: 0, finalScore: 88 },
]);

console.log('✅ All bulk score reset calculation and schema tests passed successfully!');
