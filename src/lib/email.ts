import nodemailer from 'nodemailer';

/**
 * Antigravity Email Utility
 * Handles sending emails, default configuration expects standard SMTP setup.
 */

interface SendEmailOptions {
    to: string;
    subject: string;
    html: string;
}

/**
 * Send an email to a recipient
 */
export async function sendEmail({ to, subject, html }: SendEmailOptions): Promise<void> {
    // Read at runtime so Next.js or scripts pick up .env changes
    const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
    const smtpPort = Number(process.env.SMTP_PORT) || 465;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const fromEmail = process.env.EMAIL_FROM || smtpUser || 'no-reply@antigravity.com';

    if (!smtpUser || !smtpPass) {
        console.warn('[EMAIL WARNING] SMTP credentials not fully configured in .env. Email skipped.');
        console.warn(`[EMAIL SKIPPED] To: ${to} | Subject: ${subject}`);
        return;
    }

    const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465, // true for 465, false for other ports like 587
        auth: {
            user: smtpUser,
            pass: smtpPass,
        },
    });

    try {
        const info = await transporter.sendMail({
            from: `"LMS Antigravity" <${fromEmail}>`,
            to,
            subject,
            html,
        });
        console.log(`[EMAIL SENT] Message ID: ${info.messageId}`);
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown email error';
        console.error('[EMAIL ERROR]', message);
        throw new Error(`Failed to send email: ${message}`);
    }
}
