import { executeQuery } from '../src/lib/db';

async function checkTrainees() {
    console.log("Checking users table...");
    const users = await executeQuery("SELECT id, username, full_name, role FROM users");
    console.log("Users found:", users);

    console.log("Checking participant_profiles table...");
    const profiles = await executeQuery("SELECT * FROM participant_profiles");
    console.log("Profiles found:", profiles);
}

checkTrainees();
