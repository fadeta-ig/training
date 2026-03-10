import { executeQuery } from '../src/lib/db';
import bcrypt from 'bcryptjs';
import { signToken } from '../src/lib/auth';

async function testLogin() {
    try {
        console.log('Testing login logic...');
        const username = 'admin';
        const password = 'admin123';

        const users = await executeQuery<any[]>(
            `SELECT id, username, password_hash, role, full_name FROM users WHERE username = ?`,
            [username]
        );
        console.log('Users found:', users.length);
        if (!users || users.length === 0) {
            console.log('Invalid credentials');
            process.exit(0);
        }

        const user = users[0];
        console.log('Comparing bcrypt...');
        const passwordMatch = await bcrypt.compare(password, user.password_hash);
        console.log('Match:', passwordMatch);

        console.log('Signing token...');
        const token = await signToken({
            sub: user.id,
            username: user.username,
            role: user.role,
        });

        console.log('Token created successfully. First 20 chars:', token.substring(0, 20));
    } catch (e) {
        console.error('ERROR OCCURRED:', e);
    } finally {
        process.exit(0);
    }
}

testLogin();
