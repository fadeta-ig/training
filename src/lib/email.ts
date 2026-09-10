import nodemailer from 'nodemailer';
import { escapeHtml } from '@/lib/sanitize';
import { getAppBaseUrl } from '@/lib/app-url';

export const SEB_DOWNLOAD_URL = 'https://drive.google.com/drive/folders/1b37BRs2aURCPe5rwEKxbzMC2ZMxStYa0?usp=sharing';

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
        rejectUnauthorized: process.env.SMTP_ALLOW_INSECURE_TLS === 'true' ? false : true,
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
    const sebDownloadUrl = SEB_DOWNLOAD_URL;
    const safeSebUrl = escapeHtml(sebDownloadUrl);

    const flyerUrl = `${baseUrl}/images/Flyer%20Panduan%20LMS.jpeg`;
    const safeFlyerUrl = escapeHtml(flyerUrl);

    const plainText = `Halo ${participantName},

Akun Anda telah terdaftar pada platform LMS Nusamitra Consulting untuk pelaksanaan ujian sertifikasi online. Berikut adalah rincian informasi login serta petunjuk pelaksanaan ujian Anda.

INFORMASI KREDENSIAL AKUN
- Username (Email) : ${to}
- Password         : ${pass}
- Tautan Portal    : ${baseUrl}/auth/login

Catatan: Demi keamanan akun, silakan ganti password Anda setelah pertama kali berhasil masuk ke portal.

APLIKASI UJIAN: SAFE EXAM BROWSER (SEB)
Ujian dilaksanakan menggunakan aplikasi Safe Exam Browser (SEB) pada laptop untuk memastikan integritas dan ketertiban sesi ujian.
Harap mengunduh dan memasang aplikasi SEB pada laptop Anda sebelum hari pelaksanaan ujian:
Tautan Unduh: ${sebDownloadUrl}
(Tersedia installer untuk sistem operasi Windows dan macOS).

TAHAPAN PELAKSANAAN UJIAN
1. Instalasi SEB: Unduh dan pasang aplikasi SEB pada laptop Anda sebelum jadwal ujian berlangsung.
2. Pengawasan Zoom via Ponsel: Bergabung ke ruang Zoom melalui ponsel 20 menit sebelum ujian dengan format nama [NIP/No.Peserta] - [Nama Lengkap]. Kamera wajib aktif dan diposisikan menyorot peserta serta layar laptop.
3. Unduh Konfigurasi Ujian: Buka portal LMS melalui browser laptop, masuk ke akun Anda, pilih Sesi Ujian, lalu unduh file konfigurasi (.seb).
4. Pengerjaan Soal: Buka file .seb yang telah diunduh di laptop. Layar akan terkunci ke dalam mode ujian yang aman.
5. Penyelesaian Ujian: Klik "Kirim Jawaban Ujian", keluar dari aplikasi SEB (Windows: Ctrl+Q / macOS: Cmd+Q), dan lakukan konfirmasi ke pengawas Zoom sebelum meninggalkan ruangan.

KETENTUAN PENTING:
- Kamera pengawasan Zoom pada ponsel wajib aktif selama sesi berlangsung.
- Dilarang membuka catatan, tab peramban lain, atau meminta bantuan pihak ketiga.
- Jawaban tersimpan secara berkala dan akan terkirim otomatis saat batas waktu ujian berakhir.

Bagan panduan langkah-langkah pelaksanaan ujian dapat diakses melalui tautan berikut:
${flyerUrl}

Hormat kami,
Tim Manajemen Pelatihan LMS Nusamitra Consulting
Website: https://nusamitraconsulting.com
`;

    const mailOptions = {
        from: getFromAddress(),
        replyTo: defaultReplyTo,
        to,
        subject: sanitizeEmailSubject(`Informasi Akun dan Panduan Ujian Sertifikasi - ${participantName}`),
        text: plainText,
        headers: {
            'X-Auto-Response-Suppress': 'OOF, AutoReply',
        },
        html: `
        <div style="background-color: #f8fafc; padding: 36px 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; color: #0f172a; line-height: 1.6;">
            <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 4px;">
                
                <!-- Header -->
                <div style="padding: 28px 32px 22px 32px; border-bottom: 1px solid #e2e8f0;">
                    <div style="font-size: 11px; font-weight: 700; letter-spacing: 1.2px; text-transform: uppercase; color: #64748b;">Nusamitra Consulting</div>
                    <h1 style="margin: 6px 0 0 0; font-size: 18px; font-weight: 600; color: #0f172a; line-height: 1.4;">Informasi Akun dan Panduan Pelaksanaan Ujian</h1>
                </div>

                <!-- Body Content -->
                <div style="padding: 32px;">
                    <p style="margin: 0 0 14px 0; font-size: 14px; color: #334155;">
                        Halo <b>${safeName}</b>,
                    </p>
                    <p style="margin: 0 0 24px 0; font-size: 14px; color: #334155; line-height: 1.6;">
                        Akun Anda telah terdaftar pada platform LMS Nusamitra Consulting untuk pelaksanaan ujian sertifikasi online. Berikut adalah rincian informasi login serta petunjuk pelaksanaan ujian Anda.
                    </p>

                    <!-- Section: Kredensial Akun -->
                    <div style="border: 1px solid #e2e8f0; border-radius: 4px; padding: 20px; margin-bottom: 24px;">
                        <div style="font-size: 11px; font-weight: 700; letter-spacing: 0.8px; text-transform: uppercase; color: #64748b; margin-bottom: 12px;">Kredensial Akses Portal</div>
                        <table style="width: 100%; border-collapse: collapse;">
                            <tr>
                                <td style="padding: 6px 0; font-size: 13px; color: #64748b; width: 140px;">Username / Email</td>
                                <td style="padding: 6px 0; font-size: 14px; color: #0f172a; font-weight: 600;">${safeTo}</td>
                            </tr>
                            <tr>
                                <td style="padding: 6px 0; font-size: 13px; color: #64748b;">Password</td>
                                <td style="padding: 6px 0; font-size: 14px; font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace; color: #0f172a; font-weight: 600; letter-spacing: 1px;">${safePass}</td>
                            </tr>
                        </table>
                        <div style="margin-top: 18px; padding-top: 16px; border-top: 1px solid #f1f5f9;">
                            <a href="${safeLoginUrl}" target="_blank" style="display: inline-block; background-color: #0f172a; color: #ffffff; padding: 9px 18px; font-size: 13px; font-weight: 500; text-decoration: none; border-radius: 4px;">Masuk ke Portal Ujian</a>
                        </div>
                    </div>

                    <!-- Section: Unduh Aplikasi SEB -->
                    <div style="border: 1px solid #e2e8f0; border-radius: 4px; padding: 20px; margin-bottom: 24px; background-color: #f8fafc;">
                        <div style="font-size: 11px; font-weight: 700; letter-spacing: 0.8px; text-transform: uppercase; color: #64748b; margin-bottom: 8px;">Aplikasi Ujian: Safe Exam Browser (SEB)</div>
                        <p style="margin: 0 0 14px 0; font-size: 13px; color: #334155; line-height: 1.5;">
                            Pelaksanaan ujian menggunakan aplikasi Safe Exam Browser (SEB) pada perangkat laptop untuk menjaga ketertiban dan fokus selama sesi ujian berlangsung. Harap mengunduh dan memasang aplikasi ini sebelum jadwal ujian Anda.
                        </p>
                        <a href="${safeSebUrl}" target="_blank" style="display: inline-block; background-color: #ffffff; color: #0f172a; border: 1px solid #cbd5e1; padding: 9px 18px; font-size: 13px; font-weight: 600; text-decoration: none; border-radius: 4px;">Unduh Safe Exam Browser (Google Drive)</a>
                    </div>

                    <!-- Section: Tahapan Pelaksanaan Ujian -->
                    <div style="margin-bottom: 28px;">
                        <div style="font-size: 11px; font-weight: 700; letter-spacing: 0.8px; text-transform: uppercase; color: #64748b; margin-bottom: 14px;">Tahapan Pelaksanaan Ujian</div>
                        <table style="width: 100%; border-collapse: collapse;">
                            <tr>
                                <td style="padding: 10px 12px 10px 0; vertical-align: top; width: 24px; color: #64748b; font-size: 13px; font-weight: 600;">1.</td>
                                <td style="padding: 10px 0; vertical-align: top; border-bottom: 1px solid #f1f5f9;">
                                    <div style="font-size: 13px; font-weight: 600; color: #0f172a;">Instalasi SEB pada Laptop</div>
                                    <div style="font-size: 13px; color: #475569; margin-top: 2px;">Unduh dan pasang aplikasi SEB melalui tautan di atas sebelum hari pelaksanaan ujian.</div>
                                </td>
                            </tr>
                            <tr>
                                <td style="padding: 10px 12px 10px 0; vertical-align: top; width: 24px; color: #64748b; font-size: 13px; font-weight: 600;">2.</td>
                                <td style="padding: 10px 0; vertical-align: top; border-bottom: 1px solid #f1f5f9;">
                                    <div style="font-size: 13px; font-weight: 600; color: #0f172a;">Pengawasan Zoom via Ponsel</div>
                                    <div style="font-size: 13px; color: #475569; margin-top: 2px;">Bergabung ke ruang Zoom melalui ponsel 20 menit sebelum jadwal. Gunakan format nama [NIP/No.Peserta] - [Nama Lengkap] dan aktifkan kamera menyorot peserta dan layar laptop.</div>
                                </td>
                            </tr>
                            <tr>
                                <td style="padding: 10px 12px 10px 0; vertical-align: top; width: 24px; color: #64748b; font-size: 13px; font-weight: 600;">3.</td>
                                <td style="padding: 10px 0; vertical-align: top; border-bottom: 1px solid #f1f5f9;">
                                    <div style="font-size: 13px; font-weight: 600; color: #0f172a;">Unduh Konfigurasi Ujian</div>
                                    <div style="font-size: 13px; color: #475569; margin-top: 2px;">Buka portal LMS melalui peramban laptop, masuk ke akun Anda, buka sesi ujian terkait, lalu unduh file konfigurasi SEB (.seb).</div>
                                </td>
                            </tr>
                            <tr>
                                <td style="padding: 10px 12px 10px 0; vertical-align: top; width: 24px; color: #64748b; font-size: 13px; font-weight: 600;">4.</td>
                                <td style="padding: 10px 0; vertical-align: top; border-bottom: 1px solid #f1f5f9;">
                                    <div style="font-size: 13px; font-weight: 600; color: #0f172a;">Mengerjakan Soal Ujian</div>
                                    <div style="font-size: 13px; color: #475569; margin-top: 2px;">Buka file .seb yang telah diunduh di laptop. Layar laptop akan otomatis terkunci ke dalam mode ujian yang aman.</div>
                                </td>
                            </tr>
                            <tr>
                                <td style="padding: 10px 12px 10px 0; vertical-align: top; width: 24px; color: #64748b; font-size: 13px; font-weight: 600;">5.</td>
                                <td style="padding: 10px 0; vertical-align: top;">
                                    <div style="font-size: 13px; font-weight: 600; color: #0f172a;">Penyelesaian dan Konfirmasi</div>
                                    <div style="font-size: 13px; color: #475569; margin-top: 2px;">Setelah selesai, klik "Kirim Jawaban Ujian", keluar dari aplikasi SEB (Windows: Ctrl+Q / macOS: Cmd+Q), dan lakukan konfirmasi ke pengawas di Zoom.</div>
                                </td>
                            </tr>
                        </table>
                    </div>

                    <!-- Section: Bagan Panduan -->
                    <div style="margin-bottom: 28px; border-top: 1px solid #e2e8f0; padding-top: 24px;">
                        <div style="font-size: 11px; font-weight: 700; letter-spacing: 0.8px; text-transform: uppercase; color: #64748b; margin-bottom: 6px;">Bagan Panduan Pelaksanaan Ujian</div>
                        <div style="font-size: 13px; color: #475569; margin-bottom: 14px;">Bagan alur langkah-langkah pelaksanaan ujian sertifikasi dapat Anda pelajari dan unduh:</div>
                        <div style="border: 1px solid #e2e8f0; border-radius: 4px; overflow: hidden; background-color: #ffffff; margin-bottom: 12px;">
                            <img src="${safeFlyerUrl}" alt="Panduan Pelaksanaan Ujian LMS" style="display: block; width: 100%; height: auto;" />
                        </div>
                        <div>
                            <a href="${safeFlyerUrl}" target="_blank" style="display: inline-block; background-color: #ffffff; color: #0f172a; border: 1px solid #cbd5e1; padding: 7px 16px; font-size: 12px; font-weight: 600; text-decoration: none; border-radius: 4px;">Lihat / Unduh Gambar Panduan</a>
                        </div>
                    </div>

                    <!-- Section: Ketentuan Penting -->
                    <div style="border-left: 3px solid #0f172a; background-color: #f8fafc; padding: 14px 16px; margin-bottom: 24px;">
                        <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #0f172a; margin-bottom: 6px;">Ketentuan Penting:</div>
                        <ul style="margin: 0; padding-left: 18px; color: #475569; font-size: 12.5px; line-height: 1.6;">
                            <li>Kamera pada perangkat Zoom (ponsel) wajib tetap aktif selama ujian berlangsung.</li>
                            <li>Dilarang membuka tab peramban lain, catatan, atau berkomunikasi dengan pihak ketiga.</li>
                            <li>Pastikan koneksi internet stabil dan daya baterai laptop maupun ponsel mencukupi.</li>
                            <li>Jawaban tersimpan secara berkala dan akan terkirim otomatis apabila batas waktu pengerjaan berakhir.</li>
                        </ul>
                    </div>

                    <!-- Penutup -->
                    <p style="margin: 0 0 4px 0; font-size: 13.5px; color: #334155;">
                        Apabila Anda membutuhkan bantuan atau informasi lebih lanjut, silakan menghubungi narahubung panitia pelatihan.
                    </p>
                    <p style="margin: 16px 0 0 0; font-size: 13px; color: #64748b;">
                        Hormat kami,<br/>
                        <b style="color: #0f172a;">Tim Manajemen Pelatihan LMS Nusamitra Consulting</b>
                    </p>
                </div>

                <!-- Footer -->
                <div style="padding: 16px 32px; border-top: 1px solid #e2e8f0; background-color: #f8fafc; text-align: center; font-size: 11.5px; color: #64748b;">
                    Nusamitra Consulting &bull; <a href="https://nusamitraconsulting.com" target="_blank" style="color: #0f172a; text-decoration: none;">nusamitraconsulting.com</a><br/>
                    Email ini diterbitkan secara otomatis oleh sistem LMS kepada peserta yang terdaftar resmi.
                </div>
            </div>
        </div>
        `,
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
