import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';

// Load .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
let envConfig = {};
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
            const idx = trimmed.indexOf('=');
            if (idx > 0) {
                const key = trimmed.substring(0, idx).trim();
                const val = trimmed.substring(idx + 1).trim().replace(/^["']|["']$/g, '');
                envConfig[key] = val;
            }
        }
    });
}

const targetRecipient = process.argv[2];

if (!targetRecipient) {
    console.log('Penggunaan: node scripts/test-send-email.mjs <alamat_email_tujuan>');
    console.log('Contoh: node scripts/test-send-email.mjs nama@gmail.com');
    process.exit(1);
}

const host = envConfig.SMTP_HOST || process.env.SMTP_HOST || 'mail.nusamitraconsulting.com';
const port = parseInt(envConfig.SMTP_PORT || process.env.SMTP_PORT || '465', 10);
const secure = envConfig.SMTP_SECURE === 'true' || process.env.SMTP_SECURE === 'true' || port === 465;
const user = envConfig.SMTP_USER || process.env.SMTP_USER;
const pass = envConfig.SMTP_PASS || process.env.SMTP_PASS;
const fromName = envConfig.SMTP_FROM_NAME || process.env.SMTP_FROM_NAME || 'LMS Nusamitra Consulting';
const replyTo = envConfig.SMTP_REPLY_TO || process.env.SMTP_REPLY_TO || 'support@nusamitraconsulting.com';

if (!user || !pass) {
    console.error('❌ Error: SMTP_USER dan SMTP_PASS harus didefinisikan di .env.local!');
    process.exit(1);
}

const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    tls: { rejectUnauthorized: false },
});

async function main() {
    console.log(`Mengirim email uji coba ke ${targetRecipient}...`);
    try {
        const info = await transporter.sendMail({
            from: `"${fromName}" <${user}>`,
            replyTo,
            to: targetRecipient,
            subject: 'Uji Coba Pengiriman Email Sistem - LMS Nusamitra Consulting',
            text: `Halo,\n\nIni adalah email uji coba untuk memverifikasi deliverability dan reputasi domain nusamitraconsulting.com.\n\nJika email ini masuk ke Inbox utama Anda, konfigurasi SPF, DMARC, dan Multipart MIME telah berfungsi dengan optimal.\n\nSalam,\nLMS Nusamitra Consulting\nhttps://nusamitraconsulting.com`,
            html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.6; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; padding: 24px;">
                <h2 style="color: #047857; border-bottom: 2px solid #059669; padding-bottom: 12px;">Uji Deliverability Email LMS</h2>
                <p style="color: #334155;">Halo,</p>
                <p style="color: #334155;">Ini adalah email pengujian untuk memverifikasi autentikasi SPF, DMARC, dan reputasi domain resmi <b>nusamitraconsulting.com</b>.</p>
                <div style="background-color: #ecfdf5; border-left: 4px solid #059669; padding: 16px; margin: 20px 0;">
                    <p style="margin: 0; color: #065f46; font-weight: bold;">Status: Pengiriman Berhasil</p>
                    <p style="margin: 4px 0 0 0; color: #047857; font-size: 14px;">Email ini dikirim langsung melalui mail server <code>${host}</code> dengan enkripsi SSL/TLS.</p>
                </div>
                <p style="color: #64748b; font-size: 12px; border-top: 1px solid #e2e8f0; padding-top: 16px;">
                    Nusamitra Consulting | Website: <a href="https://nusamitraconsulting.com" style="color: #059669;">nusamitraconsulting.com</a>
                </p>
            </div>
            `,
            headers: {
                'X-Auto-Response-Suppress': 'OOF, AutoReply',
            },
        });
        console.log('✅ Email berhasil dikirim!');
        console.log('Message ID:', info.messageId);
        console.log('Response:', info.response);
    } catch (err) {
        console.error('❌ Gagal mengirim email:', err);
    }
}

main();
