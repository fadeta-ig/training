import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';

// Baca .env.local manual jika ada
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

async function testConnection(host, port, secure, user, pass) {
    console.log(`\n--- Menguji ${host}:${port} (secure: ${secure}) sebagai ${user} ---`);
    const transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: {
            user,
            pass,
        },
        tls: {
            rejectUnauthorized: false,
        },
        connectionTimeout: 10000,
    });

    try {
        const verified = await transporter.verify();
        console.log(`✅ BERHASIL! Koneksi & Kredensial Valid di Port ${port} (verify: ${verified})`);
        return true;
    } catch (err) {
        console.error(`❌ GAGAL di Port ${port}: ${err.message}`);
        return false;
    }
}

async function run() {
    const user = envConfig.SMTP_USER || process.env.SMTP_USER;
    const pass = envConfig.SMTP_PASS || process.env.SMTP_PASS;
    const host = envConfig.SMTP_HOST || process.env.SMTP_HOST || 'mail.nusamitraconsulting.com';
    const port = parseInt(envConfig.SMTP_PORT || process.env.SMTP_PORT || '465', 10);
    const secure = envConfig.SMTP_SECURE === 'true' || process.env.SMTP_SECURE === 'true' || port === 465;

    if (!user || !pass) {
        console.error('❌ Error: SMTP_USER dan SMTP_PASS harus didefinisikan di .env.local!');
        process.exit(1);
    }

    console.log(`[TEST-SMTP] Memulai uji verifikasi SMTP dari konfigurasi .env.local...`);
    console.log(`Target: ${host}:${port} (secure: ${secure}) sebagai ${user}`);
    
    const success = await testConnection(host, port, secure, user, pass);

    console.log('\n--- RANGKUMAN HASIL ---');
    console.log(`Status Koneksi SMTP (.env.local): ${success ? '✅ AKTIF, TERVERIFIKASI & SIAP DIGUNAKAN' : '❌ GAGAL'}`);
}

run();
