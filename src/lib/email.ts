import fs from 'fs';
import path from 'path';
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
    const sebDownloadUrl = SEB_DOWNLOAD_URL;
    const safeSebUrl = escapeHtml(sebDownloadUrl);

    // Flyer panduan pelaksanaan ujian di direktori public/images
    const flyerPath = path.join(process.cwd(), 'public', 'images', 'Flyer Panduan LMS.jpeg');
    const flyerExists = fs.existsSync(flyerPath);

    const attachments: Array<{ filename: string; path: string; cid?: string }> = [];
    if (flyerExists) {
        attachments.push({
            filename: 'Flyer_Panduan_Pelaksanaan_Ujian_LMS.jpeg',
            path: flyerPath,
            cid: 'flyerPanduanLMS',
        });
    }

    const plainText = `Halo ${participantName},

Selamat datang di Program Sertifikasi & Pelatihan LMS Nusamitra Consulting!
Akun Anda telah berhasil didaftarkan dan siap digunakan untuk mengikuti ujian sertifikasi online.

==================================================
1. INFORMASI AKUN LOGIN ANDA
==================================================
- Username (Email Login) : ${to}
- Password Sementara     : ${pass}
- Link Masuk ke Portal   : ${baseUrl}/auth/login

Catatan: Demi keamanan akun, Anda dapat mengganti password ini setelah pertama kali berhasil login ke portal.

==================================================
2. UNDUH APLIKASI UJIAN (SAFE EXAM BROWSER / SEB)
==================================================
Ujian sertifikasi ini menggunakan aplikasi khusus bernama Safe Exam Browser (SEB) di laptop Anda. Aplikasi ini menjaga agar ujian berlangsung dengan tertib, tenang, dan bebas dari gangguan notifikasi aplikasi lain di laptop.

Mohon unduh dan pasang aplikasi SEB ini di laptop Anda sebelum hari-H ujian:
👉 Link Download SEB: ${sebDownloadUrl}
(Tersedia pilihan installer untuk laptop Windows dan Mac).

==================================================
3. 5 LANGKAH MUDAH PELAKSANAAN UJIAN
==================================================
1. Pasang SEB di Laptop (Sebelum Hari-H):
   Unduh dan selesaikan instalasi aplikasi SEB dari tautan Google Drive di atas.

2. Masuk Zoom via HP (20 Menit Sebelum Ujian):
   Buka aplikasi Zoom di HP Anda, gunakan format nama: [NIP/No.Peserta] - [Nama Lengkap].
   Nyalakan kamera HP dan posisikan di samping/belakang agar pengawas dapat melihat Anda serta layar laptop Anda secara jelas.

3. Login ke LMS di Laptop & Ambil File Ujian:
   Buka browser di laptop (Chrome/Edge/Firefox), masuk ke ${baseUrl}/auth/login.
   Pilih Sesi Ujian Anda di dashboard, lalu klik tombol "Unduh Konfigurasi SEB" (file .seb akan otomatis terunduh).

4. Buka Aplikasi Ujian:
   Klik ganda (double-click) file .seb yang baru diunduh tadi.
   Layar laptop akan otomatis terkunci dan langsung membuka lembar soal ujian secara aman.
   Jawaban Anda akan tersimpan otomatis setiap kali berpindah nomor soal.

5. Selesai Ujian & Keluar:
   Setelah semua soal dijawab, klik tombol "Kirim Jawaban Ujian".
   Keluar dari aplikasi SEB (Windows: Ctrl + Q | Mac: Cmd + Q).
   Konfirmasikan kepada pengawas di Zoom sebelum Anda meninggalkan ruang Zoom.

==================================================
💡 HAL PENTING UNTUK DIINGAT:
==================================================
- Kamera HP wajib selalu dalam posisi menyala (ON) selama ujian berlangsung.
- Dilarang membuka catatan, tab browser lain, atau meminta bantuan pihak ketiga.
- Jawaban ujian akan terkirim otomatis saat waktu hitung mundur selesai.

*Flyer panduan langkah pelaksanaan ujian bergambar lengkap telah kami lampirkan pada email ini agar dapat Anda simpan di perangkat Anda.

Jika Anda memiliki pertanyaan atau kendala instalasi, silakan menghubungi tim panitia pelatihan.

Salam Hangat,
Tim Pelatihan & Sertifikasi LMS Nusamitra Consulting
Website: https://nusamitraconsulting.com
`;

    const mailOptions = {
        from: getFromAddress(),
        replyTo: defaultReplyTo,
        to,
        subject: sanitizeEmailSubject(`Informasi Akun Login & Panduan Ujian Sertifikasi - ${participantName}`),
        text: plainText,
        attachments,
        headers: {
            'X-Auto-Response-Suppress': 'OOF, AutoReply',
        },
        html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; max-width: 620px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
            
            <!-- Header Banner -->
            <div style="background: linear-gradient(135deg, #065f46 0%, #047857 100%); padding: 28px 24px; text-align: center; color: #ffffff;">
                <h1 style="margin: 0; font-size: 22px; font-weight: 700; letter-spacing: 0.3px; color: #ffffff;">LMS Nusamitra Consulting</h1>
                <p style="margin: 6px 0 0 0; font-size: 14px; opacity: 0.95; color: #e6f4ea;">Informasi Akun Peserta & Panduan Pelaksanaan Ujian Sertifikasi</p>
            </div>

            <div style="padding: 24px;">
                <!-- Sapaan Hangat -->
                <p style="color: #1e293b; font-size: 15px; margin-top: 0;">
                    Halo <b>${safeName}</b>,
                </p>
                <p style="color: #334155; font-size: 14px; margin-bottom: 22px;">
                    Selamat datang di Program Sertifikasi LMS Nusamitra Consulting! Akun Anda telah siap digunakan untuk mengikuti seluruh tahapan pembelajaran dan ujian sertifikasi online.
                </p>

                <!-- Box 1: Informasi Akun Login -->
                <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 10px; padding: 20px; margin-bottom: 24px;">
                    <div style="border-bottom: 1px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 14px;">
                        <span style="background-color: #047857; color: #ffffff; font-size: 11px; font-weight: bold; text-transform: uppercase; padding: 3px 8px; border-radius: 4px; display: inline-block;">Akun Anda</span>
                        <h3 style="margin: 6px 0 0 0; color: #0f172a; font-size: 16px;">Kredensial Akun untuk Masuk ke Portal</h3>
                    </div>
                    
                    <div style="margin-bottom: 12px;">
                        <span style="color: #64748b; font-size: 12px; font-weight: 600; text-transform: uppercase; display: block;">Username / Email:</span>
                        <span style="color: #047857; font-size: 16px; font-weight: 700; word-break: break-all;">${safeTo}</span>
                    </div>

                    <div style="margin-bottom: 16px;">
                        <span style="color: #64748b; font-size: 12px; font-weight: 600; text-transform: uppercase; display: block;">Password Sementara:</span>
                        <span style="color: #0f172a; font-size: 18px; font-weight: 700; font-family: Consolas, Monaco, monospace; letter-spacing: 2px; background-color: #e2e8f0; padding: 4px 10px; border-radius: 6px; display: inline-block;">${safePass}</span>
                    </div>

                    <div style="text-align: center; margin-top: 18px;">
                        <a href="${safeLoginUrl}" target="_blank" style="background-color: #0f172a; color: #ffffff; padding: 11px 22px; text-decoration: none; font-size: 14px; font-weight: 600; border-radius: 6px; display: inline-block;">
                            🌐 Masuk ke Portal Ujian
                        </a>
                    </div>

                    <p style="margin: 12px 0 0 0; font-size: 12px; color: #64748b; text-align: center;">
                        *Demi keamanan akun, Anda dapat mengganti password ini setelah berhasil masuk.
                    </p>
                </div>

                <!-- Box 2: Download Safe Exam Browser (SEB) -->
                <div style="background-color: #f0fdf4; border: 1px solid #86efac; border-radius: 10px; padding: 20px; margin-bottom: 24px;">
                    <div style="border-bottom: 1px solid #bbf7d0; padding-bottom: 10px; margin-bottom: 12px;">
                        <span style="background-color: #0284c7; color: #ffffff; font-size: 11px; font-weight: bold; text-transform: uppercase; padding: 3px 8px; border-radius: 4px; display: inline-block;">Wajib Sebelum Hari-H</span>
                        <h3 style="margin: 6px 0 0 0; color: #166534; font-size: 16px;">Unduh & Pasang Aplikasi Ujian (Safe Exam Browser / SEB)</h3>
                    </div>

                    <p style="color: #1e3a29; font-size: 13.5px; margin: 0 0 12px 0;">
                        Ujian sertifikasi akan dilaksanakan menggunakan aplikasi khusus bernama <b>Safe Exam Browser (SEB)</b> di laptop Anda agar suasana ujian tetap tenang, tertib, dan bebas dari gangguan notifikasi atau aplikasi lain.
                    </p>

                    <p style="color: #1e3a29; font-size: 13.5px; margin: 0 0 16px 0;">
                        <b>Penting:</b> Mohon unduh dan pasang aplikasi SEB ini di laptop Anda sebelum hari pelaksanaan ujian (tersedia pilihan installer untuk laptop Windows dan Mac).
                    </p>

                    <div style="text-align: center; margin: 18px 0 10px 0;">
                        <a href="${safeSebUrl}" target="_blank" style="background-color: #059669; color: #ffffff; padding: 12px 24px; text-decoration: none; font-size: 14px; font-weight: 700; border-radius: 6px; display: inline-block; box-shadow: 0 2px 5px rgba(5, 150, 105, 0.3);">
                            📥 Download Safe Exam Browser (SEB) di Google Drive
                        </a>
                    </div>
                    
                    <p style="text-align: center; font-size: 12px; color: #4b5563; margin-top: 8px;">
                        Tautan cadangan: <a href="${safeSebUrl}" target="_blank" style="color: #059669; word-break: break-all;">Buka Folder Google Drive SEB</a>
                    </p>
                </div>

                <!-- Box 3: 5 Langkah Mudah Mengikuti Ujian -->
                <div style="margin-bottom: 24px;">
                    <h3 style="color: #0f172a; font-size: 16px; margin: 0 0 14px 0; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">
                        📝 5 Langkah Mudah Mengikuti Ujian
                    </h3>
                    
                    <table style="width: 100%; border-collapse: separate; border-spacing: 0 12px;">
                        <tr>
                            <td style="width: 34px; vertical-align: top;">
                                <div style="background-color: #047857; color: #ffffff; border-radius: 50%; width: 26px; height: 26px; text-align: center; line-height: 26px; font-weight: bold; font-size: 13px;">1</div>
                            </td>
                            <td style="padding-left: 8px; vertical-align: middle;">
                                <b style="color: #0f172a; font-size: 13.5px;">Instal SEB di Laptop:</b>
                                <span style="color: #475569; font-size: 13px; display: block;">Unduh dan instal aplikasi SEB di laptop Anda dari link di atas sebelum hari ujian tiba.</span>
                            </td>
                        </tr>
                        <tr>
                            <td style="width: 34px; vertical-align: top;">
                                <div style="background-color: #047857; color: #ffffff; border-radius: 50%; width: 26px; height: 26px; text-align: center; line-height: 26px; font-weight: bold; font-size: 13px;">2</div>
                            </td>
                            <td style="padding-left: 8px; vertical-align: middle;">
                                <b style="color: #0f172a; font-size: 13.5px;">Masuk Zoom via HP (Pengawasan):</b>
                                <span style="color: #475569; font-size: 13px; display: block;">20 menit sebelum ujian, masuk Zoom melalui HP Anda dengan format nama <i>[NIP/No.Peserta] - [Nama Lengkap]</i>. Nyalakan kamera HP menyorot Anda dan layar laptop.</span>
                            </td>
                        </tr>
                        <tr>
                            <td style="width: 34px; vertical-align: top;">
                                <div style="background-color: #047857; color: #ffffff; border-radius: 50%; width: 26px; height: 26px; text-align: center; line-height: 26px; font-weight: bold; font-size: 13px;">3</div>
                            </td>
                            <td style="padding-left: 8px; vertical-align: middle;">
                                <b style="color: #0f172a; font-size: 13.5px;">Login LMS & Unduh Kunci Ujian:</b>
                                <span style="color: #475569; font-size: 13px; display: block;">Buka browser laptop (Chrome/Edge), login ke portal LMS, buka Sesi Ujian Anda, lalu klik tombol <b>"Unduh Konfigurasi SEB"</b>.</span>
                            </td>
                        </tr>
                        <tr>
                            <td style="width: 34px; vertical-align: top;">
                                <div style="background-color: #047857; color: #ffffff; border-radius: 50%; width: 26px; height: 26px; text-align: center; line-height: 26px; font-weight: bold; font-size: 13px;">4</div>
                            </td>
                            <td style="padding-left: 8px; vertical-align: middle;">
                                <b style="color: #0f172a; font-size: 13.5px;">Buka Lembar Soal Ujian:</b>
                                <span style="color: #475569; font-size: 13px; display: block;">Klik ganda (double-click) file <i>.seb</i> yang baru Anda unduh di laptop. Layar laptop akan otomatis terkunci dan langsung menampilkan soal ujian.</span>
                            </td>
                        </tr>
                        <tr>
                            <td style="width: 34px; vertical-align: top;">
                                <div style="background-color: #047857; color: #ffffff; border-radius: 50%; width: 26px; height: 26px; text-align: center; line-height: 26px; font-weight: bold; font-size: 13px;">5</div>
                            </td>
                            <td style="padding-left: 8px; vertical-align: middle;">
                                <b style="color: #0f172a; font-size: 13.5px;">Selesai & Keluar Aplikasi:</b>
                                <span style="color: #475569; font-size: 13px; display: block;">Setelah selesai, klik <b>"Kirim Jawaban Ujian"</b>, keluar dari SEB (Windows: Ctrl + Q | Mac: Cmd + Q), dan konfirmasikan ke pengawas di Zoom.</span>
                            </td>
                        </tr>
                    </table>
                </div>

                <!-- Box 4: Flyer Panduan Visual -->
                <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 18px; margin-bottom: 24px; text-align: center;">
                    <h3 style="margin: 0 0 6px 0; color: #0f172a; font-size: 15px;">
                        🖼️ Flyer Panduan Pelaksanaan Ujian
                    </h3>
                    <p style="color: #64748b; font-size: 12.5px; margin: 0 0 14px 0;">
                        Berikut panduan visual lengkap langkah-langkah pelaksanaan ujian yang dapat Anda pelajari:
                    </p>
                    
                    ${flyerExists ? `
                    <div style="border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden; background: #ffffff; margin-bottom: 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.04);">
                        <img src="cid:flyerPanduanLMS" alt="Flyer Panduan Langkah Pelaksanaan Ujian LMS" style="width: 100%; max-width: 570px; height: auto; display: block; margin: 0 auto;" />
                    </div>
                    <p style="font-size: 12px; color: #64748b; margin: 0;">
                        📎 <i>Gambar panduan di atas juga kami sertakan sebagai lampiran (attachment) email ini agar dapat Anda simpan di perangkat.</i>
                    </p>
                    ` : `
                    <p style="font-size: 13px; color: #475569;">
                        Panduan pelaksanaan ujian dapat dilihat langsung pada portal LMS Nusamitra Consulting.
                    </p>
                    `}
                </div>

                <!-- Box 5: Tips Tambahan -->
                <div style="background-color: #fefce8; border: 1px solid #fef08a; border-radius: 8px; padding: 14px 16px; margin-bottom: 24px;">
                    <b style="color: #854d0e; font-size: 13px; display: block; margin-bottom: 6px;">💡 Tips Penting Selama Ujian:</b>
                    <ul style="margin: 0; padding-left: 18px; color: #713f12; font-size: 12.5px; line-height: 1.6;">
                        <li>Pastikan koneksi internet di laptop dan HP Anda stabil sebelum memulai ujian.</li>
                        <li>Siapkan charger untuk laptop dan HP agar daya baterai tetap mencukupi sepanjang sesi.</li>
                        <li>Kamera HP wajib selalu dalam posisi menyala (ON) selama ujian berlangsung.</li>
                        <li>Jangan ragu bertanya kepada pengawas di Zoom jika Anda menemui kendala teknis.</li>
                    </ul>
                </div>

                <!-- Penutup -->
                <p style="color: #334155; font-size: 13.5px; margin-bottom: 4px;">
                    Selamat mempersiapkan diri, semoga ujian sertifikasi Anda berjalan lancar dan sukses!
                </p>
                <p style="color: #64748b; font-size: 13px; margin-top: 0;">
                    Salam Hangat,<br/>
                    <b>Tim Penyelenggara Ujian LMS Nusamitra Consulting</b>
                </p>

                <!-- Footer -->
                <div style="border-top: 1px solid #e2e8f0; margin-top: 24px; padding-top: 14px; text-align: center; color: #94a3b8; font-size: 11.5px;">
                    Nusamitra Consulting | Website: <a href="https://nusamitraconsulting.com" target="_blank" style="color: #047857; text-decoration: none;">nusamitraconsulting.com</a><br/>
                    Email ini dikirimkan secara otomatis oleh sistem LMS kepada peserta ujian yang terdaftar resmi.
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
