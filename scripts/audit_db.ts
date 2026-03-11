import { executeQuery } from '../src/lib/db';

async function main() {
    try {
        const tables = ['users', 'questions', 'sessions', 'participant_profiles', 'module_items', 'trainings', 'exams', 'modules', 'session_participants', 'user_progress', 'exam_answers', 'proctor_snapshots'];

        for (const t of tables) {
            try {
                const rows = await executeQuery(`DESCRIBE ${t}`) as any[];
                const cols = rows.map((r: any) => `${r.Field} ${r.Type} ${r.Null === 'YES' ? 'NULL' : 'NOT NULL'} ${r.Default ? 'DEFAULT ' + r.Default : ''} ${r.Key || ''}`);
                console.log(`\n[${t}]`);
                cols.forEach((c: string) => console.log(`  ${c}`));
            } catch {
                console.log(`\n[${t}] ❌ DOES NOT EXIST`);
            }
        }

        // Check notifications specifically
        try {
            const rows = await executeQuery('DESCRIBE notifications') as any[];
            console.log('\n[notifications]');
            (rows as any[]).forEach((r: any) => console.log(`  ${r.Field} ${r.Type}`));
        } catch {
            console.log('\n[notifications] ❌ DOES NOT EXIST');
        }

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

main();
