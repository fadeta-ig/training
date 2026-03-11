import { executeQuery } from '../src/lib/db';

async function fixEnum() {
    try {
        console.log("Altering users table role ENUM...");
        await executeQuery("ALTER TABLE users MODIFY COLUMN role ENUM('admin', 'trainer', 'trainee') NOT NULL DEFAULT 'trainee'");
        console.log("Success! Role ENUM updated.");
    } catch (error) {
        console.error("Error altering table:", error);
    }
}

fixEnum();
