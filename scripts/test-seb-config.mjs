import assert from 'node:assert/strict';
import crypto from 'node:crypto';

process.env.JWT_SECRET ||= 'seb-config-test-secret';

const {
    buildSebConfig,
    calculateSebConfigKey,
    mergeStoredSebConfigKeys,
    parseStoredSebConfigKeys,
    serializeSebConfigForKey,
    serializeSebConfigPlist,
} = await import('../src/lib/seb-config.ts');

const config = buildSebConfig({
    sessionId: 'session-test-1',
    startUrl: 'https://lms.example.test/dashboard/sesi/session-test-1',
    quitUrl: 'https://lms.example.test/quit-seb',
    enableProctoring: true,
});

const serialized = serializeSebConfigForKey(config);
const configKey = calculateSebConfigKey(config);
const plist = serializeSebConfigPlist(config);

assert.equal(configKey, crypto.createHash('sha256').update(serialized, 'utf8').digest('hex'));
assert.equal(configKey.length, 64);
assert.equal(calculateSebConfigKey(config), configKey, 'Config Key must be stable for identical settings');
assert.ok(!serialized.includes('originatorVersion'), 'originatorVersion must not affect Config Key');
assert.ok(plist.includes('<key>allowVideoCapture</key>'), 'Windows camera permission is required');
assert.ok(plist.includes('<key>browserMediaCaptureCamera</key>'), 'macOS camera permission is required');
assert.ok(plist.includes('<string>Win.3.10.2.min</string>'), 'Windows minimum version must be present');
assert.ok(plist.includes('<string>Mac.3.7.1.min</string>'), 'macOS minimum version must be present');
assert.ok(!plist.includes('<key>browserExamKey</key>'), 'Calculated Browser Exam Key must not be injected as a static setting');

const secondKey = 'b'.repeat(64);
const stored = mergeStoredSebConfigKeys(configKey, secondKey);
assert.deepEqual(parseStoredSebConfigKeys(stored), [secondKey, configKey]);

console.log('SEB config tests passed: canonical key, version policy, and Windows/macOS camera settings verified.');
