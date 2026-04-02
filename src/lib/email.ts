import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '465', 10),
    secure: true,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

export async function sendPasswordResetEmail(to: string, resetLink: string) {
    const mailOptions = {
        from: `"LMS System" <${process.env.SMTP_USER}>`,
        to,
        subject: 'Permintaan Reset Password',
        html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; padding: 24px;">
            <h2 style="color: #047857; border-bottom: 2px solid #059669; padding-bottom: 12px;">Reset Password LMS System</h2>
            <p style="color: #334155;">Halo,</p>
            <p style="color: #334155;">Kami menerima permintaan untuk mereset password akun Anda di LMS System. Jika Anda tidak melakukan permintaan ini, abaikan email ini.</p>
            <p style="color: #334155;">Klik tombol di bawah ini untuk membuat password baru:</p>
            <div style="text-align: center; margin: 32px 0;">
                <a href="${resetLink}" style="background-color: #059669; color: white; padding: 12px 24px; text-decoration: none; font-weight: bold; border-radius: 6px; display: inline-block;">Reset Password Sekarang</a>
            </div>
            <p style="color: #334155; font-size: 14px;">Atau copy-paste link berikut ke browser Anda:</p>
            <p style="background-color: #f1f5f9; padding: 12px; border-radius: 4px; word-break: break-all; font-size: 14px; color: #475569;">
                ${resetLink}
            </p>
            <p style="color: #64748b; font-size: 12px; margin-top: 32px; border-top: 1px solid #e2e8f0; padding-top: 16px;">
                Link ini hanya berlaku selama 1 jam. Terima kasih,<br/>Tim Manajemen Pelatihan
            </p>
        </div>
        `,
    };

    return transporter.sendMail(mailOptions);
}

export async function sendCredentialEmail(to: string, participantName: string, pass: string) {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const mailOptions = {
        from: `"LMS System" <${process.env.SMTP_USER}>`,
        to,
        subject: 'Informasi Kredensial Akun LMS Anda',
        html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; padding: 24px;">
            <h2 style="color: #047857; border-bottom: 2px solid #059669; padding-bottom: 12px;">Kredensial Akun LMS System</h2>
            <p style="color: #334155;">Halo <b>${participantName}</b>,</p>
            <p style="color: #334155;">Akun Anda untuk platform pembelajaran LMS System telah berhasil didaftarkan oleh administrator. Berikut adalah rincian informasi login Anda:</p>
            
            <div style="background-color: #f1f5f9; padding: 16px; border-radius: 8px; margin: 24px 0; border: 1px solid #cbd5e1;">
                <p style="margin: 0 0 8px 0; color: #475569; font-size: 13px; text-transform: uppercase; font-weight: bold;">Username (Email)</p>
                <p style="margin: 0 0 16px 0; font-size: 18px; color: #047857; font-weight: bold;">${to}</p>
                
                <p style="margin: 0 0 8px 0; color: #475569; font-size: 13px; text-transform: uppercase; font-weight: bold;">Password</p>
                <p style="margin: 0; font-size: 18px; color: #0f172a; font-family: monospace; letter-spacing: 2px; font-weight: bold;">${pass}</p>
            </div>

            <p style="color: #334155;">Silakan masuk melalui portal utama kami menggunakan kredensial di atas:</p>
            
            <div style="text-align: center; margin: 32px 0;">
                <a href="${baseUrl}/auth/login" style="background-color: #0f172a; color: white; padding: 12px 24px; text-decoration: none; font-weight: bold; border-radius: 6px; display: inline-block;">Login ke Dashboard</a>
            </div>

            <p style="color: #b91c1c; font-size: 14px; font-weight: bold;">
                Penting: Segera ganti password Anda setelah pertama kali login demi keamanan akun!
            </p>
            
            <p style="color: #64748b; font-size: 12px; margin-top: 32px; border-top: 1px solid #e2e8f0; padding-top: 16px;">
                Jika Anda merasa tidak berafiliasi dengan program pelatihan ini, harap abaikan pesan email ini.<br/><br/>Salam Hormat,<br/>Tim Manajemen Pelatihan
            </p>
        </div>
        `,
    };

    return transporter.sendMail(mailOptions);
}


export async function sendSessionReminderEmail(bccEmails: string[], sessionDetail: { title: string, startTime: string, endTime: string }) {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    
    // Formatting date neatly
    const startDate = new Date(sessionDetail.startTime);
    const dateStr = startDate.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const timeStr = startDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';

    const mailOptions = {
        from: `"LMS System Admin" <${process.env.SMTP_USER}>`,
        bcc: bccEmails, // Use BCC to hide recipients from each other
        subject: `[Pengingat] Jadwal Sesi Pelatihan: ${sessionDetail.title}`,
        html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; padding: 24px;">
            <h2 style="color: #0369a1; border-bottom: 2px solid #0284c7; padding-bottom: 12px;">Panggilan Sesi Pelatihan Aktif</h2>
            <p style="color: #334155;">Halo Peserta,</p>
            <p style="color: #334155;">Mengingatkan Anda bahwa sesi pembelajaran <b>${sessionDetail.title}</b> akan/sedang berlangsung sesuai dengan jadwal berikut:</p>
            
            <table style="width: 100%; border-collapse: collapse; margin: 24px 0; background-color: #f8fafc; border-radius: 8px; overflow: hidden;">
                <tbody>
                    <tr>
                        <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; width: 30%; font-weight: bold; color: #475569;">Modul/Sesi</td>
                        <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-weight: bold;">${sessionDetail.title}</td>
                    </tr>
                    <tr>
                        <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; width: 30%; font-weight: bold; color: #475569;">Tanggal</td>
                        <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; color: #0f172a;">${dateStr}</td>
                    </tr>
                    <tr>
                        <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; width: 30%; font-weight: bold; color: #475569;">Waktu Mulai</td>
                        <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; color: #0f172a;">${timeStr}</td>
                    </tr>
                </tbody>
            </table>

            <p style="color: #334155;">Pastikan Anda telah bersiap dengan jaringan koneksi yang stabil sebelum sesi ujian / materi dieksekusi secara terawasi.</p>
            
            <div style="text-align: center; margin: 32px 0;">
                <a href="${baseUrl}/dashboard" style="background-color: #0369a1; color: white; padding: 12px 24px; text-decoration: none; font-weight: bold; border-radius: 6px; display: inline-block;">Akses Dashboard Anda</a>
            </div>
            
            <p style="color: #64748b; font-size: 12px; margin-top: 32px; border-top: 1px solid #e2e8f0; padding-top: 16px;">
                Anda menerima rincian notifikasi email sistem ini karena Administrator telah mengaitkan Anda ke dalam Sesi. Evaluasi dan ketentuan berlaku mutlak.
            </p>
        </div>
        `,
    };

    return transporter.sendMail(mailOptions);
}
