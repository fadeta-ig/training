import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';

process.env.JWT_SECRET ||= 'lms-hardening-test-secret';

const { moduleSchema } = await import('../src/lib/validations/moduleSchema.ts');
const { escapeHtml, isSafePublicUrl, parsePagination } = await import('../src/lib/sanitize.ts');
const {
    createSklVerificationTokenWithSecret,
    verifySklVerificationTokenWithSecret,
} = await import('../src/lib/skl-verification-core.ts');
const { hashPasswordsBounded } = await import('../src/lib/password-batch.ts');
const { getSklPeriod } = await import('../src/lib/skl.ts');

const validItem = {
    item_type: 'exam',
    item_id: '11111111-1111-4111-8111-111111111111',
    sequence_order: 1,
};

assert.equal(moduleSchema.safeParse({ title: 'Modul aman', items: [validItem] }).success, true);
assert.equal(moduleSchema.safeParse({ title: 'Modul aman', items: [validItem, validItem] }).success, false);
assert.equal(moduleSchema.safeParse({
    title: 'Modul aman',
    items: [validItem, { ...validItem, item_id: '22222222-2222-4222-8222-222222222222' }],
}).success, false, 'Sequence order must be unique');

assert.equal(escapeHtml(`<img src=x onerror="alert('x')">`), '&lt;img src=x onerror=&quot;alert(&#x27;x&#x27;)&quot;&gt;');
assert.equal(isSafePublicUrl('/uploads/document.pdf'), true);
assert.equal(isSafePublicUrl('//evil.example/path'), false);
assert.equal(isSafePublicUrl('/uploads/file.png" onerror="alert(1)'), false);
assert.equal(isSafePublicUrl('/uploads/../.env.local'), false);
assert.equal(isSafePublicUrl('/uploads/%2e%2e/.env.local'), false);
assert.equal(isSafePublicUrl('javascript:alert(1)'), false);
assert.deepEqual(
    parsePagination(new URLSearchParams('page=-2&limit=999'), 20, 50),
    { page: 1, limit: 50, offset: 0 },
);

const identity = {
    enrollmentId: 'enrollment-1',
    sklNumber: '001/SKL/IX/2026',
    decidedAt: '2026-09-18T00:00:00.000Z',
};
const token = createSklVerificationTokenWithSecret(identity, process.env.JWT_SECRET);
assert.equal(token.length, 64);
assert.equal(verifySklVerificationTokenWithSecret(token, identity, process.env.JWT_SECRET), true);
assert.equal(verifySklVerificationTokenWithSecret(token, { ...identity, sklNumber: '002/SKL/IX/2026' }, process.env.JWT_SECRET), false);
assert.equal(verifySklVerificationTokenWithSecret('not-a-token', identity, process.env.JWT_SECRET), false);
assert.equal(
    createSklVerificationTokenWithSecret({ ...identity, decidedAt: '2026-09-18 07:00:00' }, process.env.JWT_SECRET),
    createSklVerificationTokenWithSecret({ ...identity, decidedAt: '2026-09-18T00:00:00.000Z' }, process.env.JWT_SECRET),
);
assert.deepEqual(getSklPeriod('2026-09-18 08:00:00'), { romanMonth: 'IX', year: 2026 });
assert.deepEqual(getSklPeriod(new Date('2026-08-31T17:30:00.000Z')), { romanMonth: 'IX', year: 2026 });

const passwords = ['Alpha!123456', 'Beta!123456'];
const hashes = await hashPasswordsBounded(passwords, 0);
assert.equal(hashes.length, passwords.length);
assert.equal(await bcrypt.compare(passwords[0], hashes[0]), true);
assert.equal(await bcrypt.compare(passwords[1], hashes[1]), true);

console.log('LMS hardening tests passed: module integrity, output safety, signed SKL verification, pagination, and bounded password hashing verified.');
