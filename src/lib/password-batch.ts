import bcrypt from 'bcryptjs';

/** Hash passwords with bounded CPU concurrency before opening a DB transaction. */
export async function hashPasswordsBounded(passwords: string[], concurrency = 4): Promise<string[]> {
    const workerCount = Number.isFinite(concurrency) ? Math.max(1, Math.floor(concurrency)) : 4;
    const results = new Array<string>(passwords.length);
    for (let offset = 0; offset < passwords.length; offset += workerCount) {
        const batch = passwords.slice(offset, offset + workerCount);
        const hashes = await Promise.all(batch.map((password) => bcrypt.hash(password, 10)));
        hashes.forEach((hash, index) => {
            results[offset + index] = hash;
        });
    }
    return results;
}
