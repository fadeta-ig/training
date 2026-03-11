import { executeQuery } from '../src/lib/db';
import fs from 'fs';

async function checkState() {
    try {
        const users = await executeQuery("SELECT id, username, full_name, role FROM users");
        const profiles = await executeQuery("SELECT id, user_id FROM participant_profiles");

        fs.writeFileSync('db_state.json', JSON.stringify({ users, profiles }, null, 2));
        console.log("State written to db_state.json");
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}

checkState();
