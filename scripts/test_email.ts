import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { sendEmail } from '../src/lib/email';

async function test() {
    console.log('Testing SMTP configuration...');
    try {
        await sendEmail({
            to: process.env.SMTP_USER || 'fadeta287@gmail.com', // send to self
            subject: 'Test Email from LMS Antigravity',
            html: '<h1>Success!</h1><p>Your SMTP configuration is working correctly.</p>'
        });
        console.log('Test email sent successfully!');
    } catch (error) {
        console.error('Failed to send test email:', error);
    }
}

test();
