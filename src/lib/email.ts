import nodemailer from 'nodemailer';
import { escapeHtml } from '@/lib/sanitize';
import { getAppBaseUrl } from '@/lib/app-url';

function sanitizeEmailSubject(subject: string): string {
    return subject.replace(/[\r\n]+/g, ' ').trim().slice(0, 200);
}

const smtpPort = parseInt(process.env.SMTP_PORT || '465', 10);
const isSecure = process.env.SMTP_SECURE !== undefined
    ? process.env.SMTP_SECURE === 'true'
    : smtpPort === 465;

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'mail.nusamitraconsulting.com',
    port: smtpPort,
    secure: isSecure,
    auth: {
        user: process.env.SMTP_USER || 'lms@nusamitraconsulting.com',
        pass: process.env.SMTP_PASS || '',
    },
    tls: {
        rejectUnauthorized: false,
    },
});

function getFromAddress(customSenderName?: string): string {
    const senderName = customSenderName || process.env.SMTP_FROM_NAME || 'LMS Nusamitra Consulting';
    const senderEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || 'lms@nusamitraconsulting.com';
    return `"${senderName}" <${senderEmail}>`;
}

const defaultReplyTo = process.env.SMTP_REPLY_TO || 'support@nusamitraconsulting.com';

export async function sendEmail({
    to,
    subject,
    html,
    text,
}: {
    to: string;
    subject: string;
    html: string;
    text?: string;
}) {
    // Generate fallback text jika tidak disediakan untuk memenuhi standar anti-spam MIME
    const plainText = text || html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

    const mailOptions = {
        from: getFromAddress(),
        replyTo: defaultReplyTo,
        to,
        subject: sanitizeEmailSubject(subject),
        text: plainText,
        html,
        headers: {
            'X-Auto-Response-Suppress': 'OOF, AutoReply',
            'Precedence': 'bulk',
        },
    };
    return transporter.sendMail(mailOptions);
}

export async function sendPasswordResetEmail(to: string, resetLink: string) {
    const safeResetLink = escapeHtml(resetLink);
    const plainText = `Reset Password LMS Nusamitra Consulting\n\nHalo,\n\nKami menerima permintaan untuk mereset password akun Anda di LMS Nusamitra Consulting. Jika Anda tidak merasa melakukan permintaan ini, silakan abaikan email ini.\n\nBuka tautan berikut untuk membuat password baru:\n${resetLink}\n\nTautan ini hanya berlaku selama 1 jam.\n\nSalam Hormat,\nTim Manajemen Pelatihan LMS Nusamitra Consulting\nhttps://nusamitraconsulting.com`;

    const mailOptions = {
        from: getFromAddress(),
        replyTo: defaultReplyTo,
        to,
        subject: 'Permintaan Reset Password - LMS Nusamitra Consulting',
        text: plainText,
        html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; padding: 24px;">
            <h2 style="color: #047857; border-bottom: 2px solid #059669; padding-bottom: 12px;">Reset Password LMS Nusamitra Consulting</h2>
            <p style="color: #334155;">Halo,</p>
            <p style="color: #334155;">Kami menerima permintaan untuk mereset password akun Anda di LMS Nusamitra Consulting. Jika Anda tidak melakukan permintaan ini, abaikan email ini.</p>
            <p style="color: #334155;">Klik tombol di bawah ini untuk membuat password baru:</p>
            <div style="text-align: center; margin: 32px 0;">
                <a href="${safeResetLink}" style="background-color: #059669; color: white; padding: 12px 24px; text-decoration: none; font-weight: bold; border-radius: 6px; display: inline-block;">Reset Password Sekarang</a>
            </div>
            <p style="color: #334155; font-size: 14px;">Atau copy-paste link berikut ke browser Anda:</p>
            <p style="background-color: #f1f5f9; padding: 12px; border-radius: 4px; word-break: break-all; font-size: 14px; color: #475569;">
                ${safeResetLink}
            </p>
            <p style="color: #64748b; font-size: 12px; margin-top: 32px; border-top: 1px solid #e2e8f0; padding-top: 16px;">
                Link ini hanya berlaku selama 1 jam.<br/>
                Nusamitra Consulting | Website: <a href="https://nusamitraconsulting.com" style="color: #059669;">nusamitraconsulting.com</a>
            </p>
        </div>
        `,
        headers: {
            'X-Auto-Response-Suppress': 'OOF, AutoReply',
        },
    };

    return transporter.sendMail(mailOptions);
}

export async function sendCredentialEmail(to: string, participantName: string, pass: string) {
    const baseUrl = getAppBaseUrl();
    const safeName = escapeHtml(participantName);
    const safeTo = escapeHtml(to);
    const safePass = escapeHtml(pass);
    const safeLoginUrl = escapeHtml(`${baseUrl}/auth/login`);
    const plainText = `Kredensial Akun LMS Nusamitra Consulting\n\nHalo ${participantName},\n\nAkun Anda untuk platform pembelajaran LMS Nusamitra Consulting telah didaftarkan oleh administrator. Berikut adalah rincian informasi login Anda:\n\nUsername (Email): ${to}\nPassword: ${pass}\n\nSilakan masuk melalui portal kami:\n${baseUrl}/auth/login\n\nPenting: Segera ganti password Anda setelah pertama kali login demi keamanan akun!\n\nSalam Hormat,\nTim Manajemen Pelatihan LMS Nusamitra Consulting\nhttps://nusamitraconsulting.com`;

    const mailOptions = {
        from: getFromAddress(),
        replyTo: defaultReplyTo,
        to,
        subject: 'Informasi Kredensial Akun LMS Nusamitra Consulting',
        text: plainText,
        html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; padding: 24px;">
            <h2 style="color: #047857; border-bottom: 2px solid #059669; padding-bottom: 12px;">Kredensial Akun LMS Nusamitra Consulting</h2>
            <p style="color: #334155;">Halo <b>${safeName}</b>,</p>
            <p style="color: #334155;">Akun Anda untuk platform pembelajaran LMS Nusamitra Consulting telah berhasil didaftarkan oleh administrator. Berikut adalah rincian informasi login Anda:</p>
            
            <div style="background-color: #f1f5f9; padding: 16px; border-radius: 8px; margin: 24px 0; border: 1px solid #cbd5e1;">
                <p style="margin: 0 0 8px 0; color: #475569; font-size: 13px; text-transform: uppercase; font-weight: bold;">Username (Email)</p>
                <p style="margin: 0 0 16px 0; font-size: 18px; color: #047857; font-weight: bold;">${safeTo}</p>
                
                <p style="margin: 0 0 8px 0; color: #475569; font-size: 13px; text-transform: uppercase; font-weight: bold;">Password</p>
                <p style="margin: 0; font-size: 18px; color: #0f172a; font-family: monospace; letter-spacing: 2px; font-weight: bold;">${safePass}</p>
            </div>

            <p style="color: #334155;">Silakan masuk melalui portal utama kami menggunakan kredensial di atas:</p>
            
            <div style="text-align: center; margin: 32px 0;">
                <a href="${safeLoginUrl}" style="background-color: #0f172a; color: white; padding: 12px 24px; text-decoration: none; font-weight: bold; border-radius: 6px; display: inline-block;">Login ke Dashboard</a>
            </div>

            <p style="color: #b91c1c; font-size: 14px; font-weight: bold;">
                Penting: Segera ganti password Anda setelah pertama kali login demi keamanan akun!
            </p>
            
            <p style="color: #64748b; font-size: 12px; margin-top: 32px; border-top: 1px solid #e2e8f0; padding-top: 16px;">
                Jika Anda merasa tidak berafiliasi dengan program pelatihan ini, harap abaikan pesan email ini.<br/><br/>
                Nusamitra Consulting | Website: <a href="https://nusamitraconsulting.com" style="color: #059669;">nusamitraconsulting.com</a>
            </p>
        </div>
        `,
        headers: {
            'X-Auto-Response-Suppress': 'OOF, AutoReply',
        },
    };

    return transporter.sendMail(mailOptions);
}


export async function sendSessionReminderEmail(bccEmails: string[], sessionDetail: { title: string, startTime: string, endTime: string }) {
    const baseUrl = getAppBaseUrl();
    
    // Formatting date neatly
    const startDate = new Date(sessionDetail.startTime);
    const dateStr = startDate.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const timeStr = startDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';
    const safeTitle = escapeHtml(sessionDetail.title);
    const safeDate = escapeHtml(dateStr);
    const safeTime = escapeHtml(timeStr);
    const safeDashboardUrl = escapeHtml(`${baseUrl}/dashboard`);

    const plainText = `[Pengingat] Jadwal Sesi Pelatihan: ${sessionDetail.title}\n\nHalo Peserta,\n\nMengingatkan Anda bahwa sesi pembelajaran ${sessionDetail.title} akan/sedang berlangsung:\n- Modul/Sesi: ${sessionDetail.title}\n- Tanggal: ${dateStr}\n- Waktu Mulai: ${timeStr}\n\nPastikan Anda telah bersiap dengan jaringan koneksi yang stabil sebelum sesi ujian / materi dieksekusi secara terawasi.\n\nAkses Dashboard Anda di: ${baseUrl}/dashboard\n\nSalam Hormat,\nTim Manajemen Pelatihan LMS Nusamitra Consulting\nhttps://nusamitraconsulting.com`;

    const mailOptions = {
        from: getFromAddress('LMS System Admin'),
        replyTo: defaultReplyTo,
        bcc: bccEmails, // Use BCC to hide recipients from each other
        subject: sanitizeEmailSubject(`[Pengingat] Jadwal Sesi Pelatihan: ${sessionDetail.title}`),
        text: plainText,
        html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; padding: 24px;">
            <h2 style="color: #0369a1; border-bottom: 2px solid #0284c7; padding-bottom: 12px;">Panggilan Sesi Pelatihan Aktif</h2>
            <p style="color: #334155;">Halo Peserta,</p>
            <p style="color: #334155;">Mengingatkan Anda bahwa sesi pembelajaran <b>${safeTitle}</b> akan/sedang berlangsung sesuai dengan jadwal berikut:</p>
            
            <table style="width: 100%; border-collapse: collapse; margin: 24px 0; background-color: #f8fafc; border-radius: 8px; overflow: hidden;">
                <tbody>
                    <tr>
                        <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; width: 30%; font-weight: bold; color: #475569;">Modul/Sesi</td>
                        <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-weight: bold;">${safeTitle}</td>
                    </tr>
                    <tr>
                        <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; width: 30%; font-weight: bold; color: #475569;">Tanggal</td>
                        <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; color: #0f172a;">${safeDate}</td>
                    </tr>
                    <tr>
                        <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; width: 30%; font-weight: bold; color: #475569;">Waktu Mulai</td>
                        <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; color: #0f172a;">${safeTime}</td>
                    </tr>
                </tbody>
            </table>

            <p style="color: #334155;">Pastikan Anda telah bersiap dengan jaringan koneksi yang stabil sebelum sesi ujian / materi dieksekusi secara terawasi.</p>
            
            <div style="text-align: center; margin: 32px 0;">
                <a href="${safeDashboardUrl}" style="background-color: #0369a1; color: white; padding: 12px 24px; text-decoration: none; font-weight: bold; border-radius: 6px; display: inline-block;">Akses Dashboard Anda</a>
            </div>
            
            <p style="color: #64748b; font-size: 12px; margin-top: 32px; border-top: 1px solid #e2e8f0; padding-top: 16px;">
                Anda menerima rincian notifikasi email sistem ini karena Administrator telah mengaitkan Anda ke dalam Sesi.<br/>
                Nusamitra Consulting | Website: <a href="https://nusamitraconsulting.com" style="color: #0284c7;">nusamitraconsulting.com</a>
            </p>
        </div>
        `,
        headers: {
            'X-Auto-Response-Suppress': 'OOF, AutoReply',
        },
    };

    return transporter.sendMail(mailOptions);
}
