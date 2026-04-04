# BUKU PANDUAN & GUIDELINE SISTEM WEBSITE
## Sistem E-Learning — Learning Management System (LMS)

**Edisi Ekstensif & Komprehensif | Dokumen Serah Terima (Handover)**
Versi 2.1 — April 2026

---

# BAB 1 — PENDAHULUAN

## 1.1 Tujuan Dokumen
Dokumen ini disusun sebagai **panduan operasional paling komprehensif** untuk platform E-Learning berbasis website yang telah kita kembangkan. Panduan ini dirancang agar dapat dibaca, dipahami, dan dipraktikkan langsung oleh **orang awam** sekalipun (tanpa latar belakang IT). Segala tombol, menu, peringatan, dan fungsionalitas sistem—sekecil apa pun—akan dijabarkan dengan jelas. Selain itu, dokumen ini juga memuat **Dokumentasi Teknis** untuk referensi pengembang sistem (Developer).

## 1.2 Bagaimana Sistem Ini Bekerja? (Konsep Dasar)
Bayangkan LMS ini sebagai sebuah Sekolah Digital. 
1. **Admin** (Kepala Sekolah) membuat jadwal, menyusun daftar mata pelajaran (Materi), membuat Ujian (Soal), dan memastikan keamanan ujian.
2. **Trainer** (Guru) hanya bertugas memantau siswa, membimbing, dan memberi nilai ujian berjenis esai (jawaban panjang).
3. **Trainee / Peserta** (Murid) cukup masuk (login), belajar dengan melihat video atau membaca PDF, mengerjakan soal ujian, dan jika nilainya memenuhi syarat (Lulus), mereka bisa langsung mencetak sertifikat digitalnya secara otomatis.

---

# BAB 2 — HAK AKSES PENGGUNA (ROLE)
Sistem memiliki tembok pembatas yang ketat untuk memastikan tidak ada data yang bisa dilihat atau dirusak oleh orang yang salah. LMS Antigravity membagi pengguna menjadi 3 (tiga) peran:

### 1. Administrator (SuperAdmin)
SuperAdmin memegang kendali 100% pada sistem. 
- **Hak Akses:** Menambah/menghapus orang, mengubah profil peserta, menghapus materi, membuka kelas (Sesi), mengatur *Safe Exam Browser (SEB)*, melihat semua foto *webcam* (Live Proctoring), mengubah nilai kelulusan, dan memantau *Audit Log* (catatan aktivitas admin).

### 2. Trainer (Pengajar)
Trainer difokuskan pada kegiatan akademis dan pantauan, tanpa risiko merusak sistem.
- **Hak Akses Hanya-Baca:** Dapat melihat siapa saja yang terdaftar di kelas, siapa yang sedang ujian, dan kemajuan peserta (misal: "Peserta baru menyelesaikan 50%").
- **Hak Akses Penilaian (Grading):** Mampu membuka jawaban esai peserta dan mengisi nilai angka (misalnya: 85) yang nantinya secara otomatis dihitung bersama ujian Pilihan Ganda.
- **Batasan:** Tidak bisa menghapus kelas, tidak bisa mengubah pengaturan sistem, atau menambahkan pengguna baru.

### 3. Trainee (Peserta Pelatihan)
Trainee memiliki akses yang paling dibatasi dan fokus pada kegiatan belajar.
- **Hak Akses:** Hanya dapat melihat jadwal Sesi yang ditugaskan khusus untuk dirinya. Bisa mengubah kata sandi miliknya sendiri, mengerjakan materi dan ujian, serta mengunduh (download) sertifikat.

---

# BAB 3 — PANDUAN LENGKAP UNTUK PARTICIPANT (PESERTA LATIHAN)

Jika Anda adalah seorang Trainee (Peserta), ikuti panduan detail berikut dari awal mendapatkan akun hingga mencetak sertifikat.

## 3.1 Cara Login & Mendapatkan Akun
Sebagai peserta, Anda **TIDAK BISA mendaftar sendiri** di halaman depan. Langkahnya adalah:
1. Administrator akan membuatkan akun Anda.
2. Cek kotak masuk **Email Pribadi** Anda. Sistem secara otomatis telah mengirimkan **Username** dan **Password** Anda (Fitur *Automated Email Credentials*).
3. Buka halaman depan website. Masukkan Username dan Password tersebut. 
4. Jika salah memasukkan, peringatan berwarna merah "Kredensial Tidak Valid" akan muncul. Periksa kembali penggunaan huruf besar dan kecil.

## 3.2 Mengenal Dashboard (Halaman Utama)
Setelah login, Anda akan melihat layar dengan 3 area utama:
- **Kartu Statistik di Atas:** Menunjukkan angka "Sesi Sedang Berjalan" (Kelas yang bisa dikerjakan sekarang), "Akan Datang" (Kelas yang belum dimulai), dan "Selesai" (Kelas yang sudah purna).
- **Kalender Interaktif:** Ini adalah visualisasi kalender. Setiap tanggal yang memiliki warna atau lingkaran berarti di hari tersebut terdapat kelas ujian atau materi yang harus Anda selesaikan. Anda bisa mengeklik tanggal tersebut.
- **Widget Sesi Berjalan:** Tombol "Lanjutkan Belajar" ditujukan agar Anda tidak perlu repot mencari menu, cukup klik dan langsung masuk ke kelas Anda.

## 3.3 Menu Pengaturan Profil & Mengganti Kata Sandi
Di navigasi kiri (Sidebar), terdapat menu **"Profil & Pengaturan"**:
- **Biodata Pribadi:** Anda harus melengkapi atau memperbaiki formulir di sana. Meliputi *Nama Lengkap* (Nama ini **wajib benar** karena akan dicetak persis di Sertifikat), *Jenis Kelamin (Laki-laki/Perempuan)*, *Tanggal Lahir*, *Nomor Telepon*, dan *Alamat*.
- **Sinkronisasi Tanggal Otomatis:** Sistem telah dikonfigurasi untuk menyesuaikan format secara otomatis (*Date bind synchronization*), sehingga penulisan tanggal lahir dan gender tidak mungkin tertukar di penyimpanan pusat.
- **Mengganti Kata Sandi:** Agar aman, segera ganti kata sandi awal Anda. Masukkan kata sandi lama sekali, lalu masukkan kata sandi baru dua kali di kotak yang disediakan, kemudian klik **Simpan**.

## 3.4 Mengakses Materi Pelatihan (Multi-Media)
1. Klik menu **"Sesi Saya"** di navigasi kiri.
2. Klik tombol **"Buka Sesi"** pada sesi yang statusnya berlabel hijau **"Sedang Berlangsung"**.
3. Di sana terdapat urutan pelajaran (Disebut **Modul Pembelajaran**). Pelajaran dapat berupa:
   - **Teks Biasa & Gambar.**
   - **Video YouTube:** Layar video akan tertanam di halaman tersebut, tekan logo "Play" di tengah video.
   - **File Dokumen:** Terkadang admin menyertakan lampiran (seperti Word, Excel, Modul PDF). Klik dokumen tersebut untuk mengunduhnya (*Download*).
4. Setelah Anda selesai membaca dan menekan tombol lanjut, progres di atas akan perlahan penuh (dari 0% ke 50%, lalu 100%).

## 3.5 Mengerjakan Ujian (Dan Fitur Keamanan SEB)
Setelah materi selesai dibaca, Anda akan dihadapkan pada **Ujian**.

**TENTANG SEB (SAFE EXAM BROWSER)**
- Jika ujian ini dilindungi oleh keamanan tingkat tinggi, Admin akan menyalakan pengaman "SEB".
- Anda akan melihat tulisan "Mohon luncurkan Safe Exam Browser". Jika belum memiliki aplikasinya, klik tautan yang disediakan untuk mengunduh, lalu instal aplikasinya di Windows Anda.
- Setelah aktif, klik tombol "Buka via SEB". Komputer Anda akan **terkunci penuh** (Lockdown Mode). Anda tidak bisa pindah membuka aplikasi Chrome lain, tidak bisa mencari jawaban di Google, dan tidak bisa menekan `Alt + Tab`. Layar baru bisa ditutup jika ujian sudah diselesaikan (Submit).

**SAAT MENGERJAKAN UJIAN (Dengan Pemantauan Webcam)**
- Ketika Anda mengeklik "Mulai Ujian", peramban (browser) akan meminta izin (Prompt) berbunyi: *"Izinkan penggunaan Kamera/Webcam?"*. Wajib diklik **Allow/Izinkan**.
- Fitur *Live Proctoring* aktif. Setiap 30 detik, lampu webcam laptop Anda akan berkedip. Sistem sedang memotret Anda agar diawasi oleh Admin bahwa Anda tidak digantikan oleh orang lain. Jangan matikan kamera!

**SISTEM PENILAIAN OTOMATIS & ESAI**
- Bacalah durasi waktu di sudut kanan atas (berfungsi sebagai hitung mundur). Apabila waktu habis (00:00), jawaban Anda akan otomatis diserahkan paksa ke Admin (Auto-Submit).
- **Soal Pilihan Ganda** langsung dinilai oleh mesin saat itu juga.
- **Soal Esai** tidak dinilai secara instan. Anda harus mengetik jawaban menggunakan argumen sendiri, dan Trainer akan menilainya secara manual di kemudian hari.

## 3.6 Mengunduh Sertifikat (Otomatis & Profesional)
Setelah ujian selesai, Anda akan menerima **Skor**. 
1. Jika "Passing Grade" (Batas lulus) adalah 70 dan Anda mendapat 80, maka saat Anda membuka *Overview* atau menu Profil Anda, akan langsung muncul tombol **"Download Sertifikat"** berwarna Hijau Emas.
2. Klik tombol itu. Berkas PDF dengan desain Premium, berisikan Nama Anda dan tanggal yang sah otomatis diunduh!
3. Jika nilainya hanya 60, tombol Sertifikat tersebut tidak akan pernah muncul.
4. **Catatan:** Di Sertifikat tersebut tersemat keamanan tambahan (integrasi algoritma yang rumit) yang memastikan sertifikat itu secara sah diterbitkan oleh server pusat, sehingga mustahil untuk dipalsukan.

---

# BAB 4 — PANDUAN LENGKAP UNTUK ADMINISTRATOR / TRAINER

Jika Anda adalah Admin atau Trainer, panduan ini menjelaskan cara menyetel "Sekolah Digital" dan membuat semua mekanisme berjalan dari awal hingga peserta lulus.

## 4.1 Memahami Halaman Dashboard Admin
Masuk menggunakan akun Admin. Halaman depan akan menyajikan kendali lengkap:
- 4 Angka Sentral: Menunjukkan total peserta yang terdaftar, total soal ujian di pangkalan data (*database*), jumlah materi, dan jumlah kelas (sesi) operasional.
- **Fitur Analitik Trend:** Grafik ini bukan hanya hiasan. Grafik mengkalkulasi aktivitas siswa 14 hari ke belakang. Jika grafiknya menurun, Anda bisa mengevaluasi partisipasi peserta. Terdapat pula diagram "Rasio Kelulusan" untuk membandingkan persentase siswa lulus berbanding yang gagal.

## 4.2 Pembuatan Materi Latihan Multi-Media Terintegrasi (Menu Content)
Ini saatnya menyusun materi pembelajaran.
1. Masuk ke menu **Content**. Klik tombol besar "Tambah Baru".
2. Tulis Judul. Misalnya: "Modul Keselamatan Kerja Tahap 1".
3. **Editor Visual Kaya Fitur:** Di sini Anda tidak harus mengerti koding. Bisa menebalkan teks (*Bold*), memberi warna, membuat daftar tak berurut (*Bullet-list*). Ini didukung penuh oleh teknologi *TipTap Editor*.
4. **Fitur Media Attachment Manager:** Di bawah kotak pengetikan teks, ada area khusus unggah dokumen pendukung. Anda bebas menyematkan gambar, dokumen PDF, hingga menempelkan (*Paste*) URL YouTube. Tautan YouTube dan modul PDF akan dapat diputar dan diunduh langsung oleh peserta.

## 4.3 Pembuatan Bank Soal Ekstensif (Menu Exams)
1. Pergi ke menu **Exams**. Klik Buat Ujian Baru.
2. Beri nama Ujian tersebut. Setel "Durasi" (contoh: 60 Menit) dan "Batas Kelulusan" (contoh: 75%).
3. Masuk ke mode *"Kelola Soal"*. Buat jenisnya:
   - **Pilihan Ganda:** Tulis pertanyaannya. Tulis Opsi A, B, C, D. Tekan tanda centang hijau di sebelah jawaban yang Benar. (Ini agar sistem bisa otomatis mencoret jawaban yang salah bagi peserta ujian).
   - **Tipe Esai:** Anda tinggal mencentang Tipe Esai. Tulis pertanyaan panjang. Peran "Trainer" akan masuk belakangan untuk membacanya.

## 4.4 Pengaturan Modul (Packaging)
Materi dan Ujian yang dibuat terpisah harus disatukan. Wadah penyatuan ini dinamakan "Modul" (Menu **Modules**).
- Anda dapat menyusun item Materi 1 agar berada di posisi paling atas. Di bawahnya, letakkan Ujian Akhir.
- Peserta dijamin mutlak tidak akan bisa melompat maju ke *"Ujian"* jika belum menuntaskan dan membaca *"Materi 1"* terlebih dahulu.

## 4.5 Jadwal Presisi Otomatis dengan "Sensor Waktu"
Masuk ke menu **Sessions**. Ini adalah meja komando Admin untuk mendistribusikan kelas.
1. Buat sesi baru, misalnya "Sesi Juli: K3". Pilih "Modul Keselamatan Kerja".
2. Fitur krusial: Atur Tanggal Mulai dan Tanggal Berakhir (**Start & End Date/Time**). 
   - **Logika Otomatis LMS:** Bila saat ini tanggal 1 Juli, sedangkan Sesi diatur mulai tanggal 3 Juli, sesi itu berlabel **Kuning (Akan Datang)**. Murid bisa melihatnya tetapi dikunci rapat.
   - Saat tanggal 3 Juli tepat jam 08.00 pagi, LMS mencabut kunci tersebut, mengubah status menjadi **Hijau (Sedang Berjalan)**.
   - Saat batas tanggal terlewati, Sesi berubah menjadi **Hitam (Selesai)**. Akses tertutup secara permanen. Pengaturan otomatis inilah yang dirancang agar Admin cukup bekerja satu kali saja.
3. Centang opsi **"Wajibkan Safe Exam Browser (SEB)"** jika sesi ini memerlukan perlindungan ujian paling ketat (Anti-Cheating).

## 4.6 Dashboard Pemantauan Kamera (Live Proctoring Real-time)
Ini adalah fitur unggulan untuk mengawasi kejujuran peserta secara waktu nyata.
1. Saat ujian massal, Administrator dapat masuk ke menu **Monitoring**.
2. Pilih Kelas yang baru berjalan.
3. Halaman ini akan membagi layar menjadi kotak-kotak kecil tempat foto wajah peserta direkam.
4. Setiap 30 detik, foto tersebut disegarkan (*Auto-Refresh Snapshot*), dan seketika wajah peserta yang terbaru ditampilkan. Jika layar peserta hitam, tandanya ada masalah pengaturan izin pada peramban mereka atau mereka sengaja menutup kamera. Administrator bebas menegur peserta tersebut.

## 4.7 Penilaian Esai Manual / Grading (Peran Trainer)
Sistem belum memberikan skor otomatis pada jawaban Esai.
1. Admin atau Pelatih (**Trainer**) wajib masuk ke menu "Overview Nilai Sesi / Papan Skor".
2. Di sana naskah/argumen para siswa terhampar dengan jelas. 
3. Trainer membaca naskah dan memberlakukan penilaian numerik, misalnya memberikan skor "55".
4. Begitu Trainer menekan tombol Simpan, algoritma mesin bekerja otomatis menyatukan nilai Pilihan Ganda (misal 40) dengan Esai (55) menjadi "95". Kalkulasi nilai total secara otomatis mendeteksi status kelulusan peserta, memicu peluncuran Sertifikat Emas jika nilai akhir mencapai "Passing Grade".

## 4.8 Ekspor Data Mentah Ke Excel
Jika pelaporan (*Reporting*) dibutuhkan untuk keperluan korporat:
- Buka Halaman *Overview Sessions*.
- Klik pada tombol kanan atas bertuliskan lambang *Spreadsheet*: **"Download Excel"**.
- Semua rekam jejak, mencakup status ketercapaian, progres siswa (misal 50%), serta hasil nilai murni direndahkan ke dalam format yang bebas diolah lebih lanjut.

## 4.9 Menjamin Integritas: Tabel Audit Log (Rekam Jejak)
Fitur **"Audit Logging"** mengamankan sistem atas segala manuver Admin nakal/ceroboh:
- Halaman fungsi mutakhir ini merekam aktivitas secara tersembunyi.
- Misal Admin 'budi_mgr' menekan tombol Hapus Akun Murid bernama Rudi.
- Komputer akan mencatatnya di Pangkalan Data: *"Akun budi_mgr telah memusnahkan ID #50 a.n Rudi pada pk. 14.05 dengan perintah DELETE"*.
- Layar log ini dapat ditinjau kapan pun oleh Pimpinan (*SuperAdmin utama*) untuk memberikan kepastian keamanan tingkat lanjut.

---

# BAB 5 — PERTANYAAN PALING SERING DIAJUKAN (F.A.Q & TROUBLESHOOTING UMUM)

*Jika Anda menghadapi kendala, periksalah daftar masalah umum ini sebelum melapor ke Tim IT:*

### 1. Peserta terhambat pada halaman Loading lambat (Spinner Berputar Terus Tanpa Henti)
**Penyebab:** Umumnya dikarenakan penumpukan *Cache* (Memori Sementara) pada peramban/browser, sehingga kode tersangkut.
**Solusi Cepat:** Arahkan murid untuk menekan persimpangan `Ctrl + Shift + Del` dari papan ketiknya. Centang fitur *"Cached images and files/Hapus Tembolok"*. Klik *"Hapus Data"*. Kemudian perintahkan tekan tombol `F5` *(Refresh layar)*.

### 2. Peserta protes: "Pak, Sertifikat belum Keluar Padahal Nilai sudah 90?!" (Batas Passing Grade 75)
**Solusi:** Evaluasi progresnya melalui Dashboard Anda. Kelulusan sejati bukan bersandar tunggal pada angka! Sesi pembelajaran mensyaratkan bar Progres biru "100%". Apabila peserta menekan langsung fitur ujian esai dan membiarkan *Course Video* terlewat, dia menyalahi aturan sistem. Garis Progres muridnya terhenti di titik "70%". Suruh murid membuka serta menyelesaikan materi yang belum memiliki tanda centang komplit.

### 3. Layar Live Proctoring Monitoring Peserta A Terus-Menerus Hitam / Tidak Ada Gambar!
**Solusi:** Ada tiga sumber potensial: a) Peserta sejatinya belum sama sekali mengeklik tombol "Mulai Ujian" di layar SEB-nya. b) Cek persetujuan di dekat kotak isian URL Chrome. Konfigurasi gembok kameranya harus disetel pada "*Allowed*" atau "*Diizinkan*". Windows 11 terkadang menyembunyikan tombol fisik blokir kamera, pastikan pelindung fisik dibuka. c) Koneksi peserta putus/jatuh ke titik kelemahan absolut sehingga tangkapan foto ukuran kilobyte tidak sanggup terkirim.

### 4. Bisakah Administrator "Batch Insert" (Menyebarkan Akun Serentak Ratusan Peserta) tanpa harus repot Chat WhatsApp 1x1?
Sebuah prosedur *Automated Credentials Dispatching* dapat menuntaskan perihal ini. Membekali sistem dengan fungsi pengirim SMTP, Administrator tinggal mendaftarkan profil pengguna. Secara instan, kode sandi rahasia dikirimkan ke *Email Personal* masing-masing, tak butuh jerih payah mendistribusikan kata sandi via jalur pribadi. 

---

# BAB 6 — DOKUMENTASI TEKNIS SISTEM (UNTUK IT / DEVELOPER)

Bab ini disusun khusus untuk referensi pengembang sistem (Developer) dalam memelihara dan mengembangkan platform di masa mendatang.

## 6.1 Stack Teknologi Utama
Sistem LMS ini dibangun menggunakan arsitektur modern berkinerja tinggi, mengikuti tren rekayasa web (Web Engineering) tahun 2026:
- **Framework Frontend & Backend:** Next.js (Versi 16.1.6) dengan arsitektur *App Router* dan kompilator baru `babel-plugin-react-compiler`. React v19.2.3.
- **Bahasa Pemrograman:** Ekstensif menggunakan TypeScript penuh (*Full Type Safety*).
- **Database & Konektor:** Basis data Relasional menggunakan konektor `mysql2` (MySQL / MariaDB).
- **Library Tampilan (UI/UX):** Mewarisi sistem desain dari `shadcn/ui`, diramu dengan `Tailwind CSS v4` untuk proses pendesainan tampilan yang sangat lincah.
- **Keamanan (Authentication):** Metode token murni JSON Web Token (JWT) yang dienkripsi melalui modul `jose` dan `bcryptjs` untuk perlindungan kriptografi kata sandi pengguna.
- **PDF Engine & Visual Editor:** Menggunakan `puppeteer` (Headless Browser PDF Generation), `jspdf`, `html2canvas`, dan integrasi fitur pengolah kata (Rich Text) dari kerangka modern `@tiptap/react` dan ekstensi komplit tip-tap lainnya.

## 6.2 Konfigurasi Lingkungan Pengembang (Environment Setup)
Untuk meluncurkan kode ini secara lokal di perangkat Server atau Komputer Pengembang:
1. Pastikan Anda telah memasang **Node.js (Versi 20.x ke atas)**.
2. Salin atau ambil kode sumber platform lalu jalankan terminal pada direktori proyek untuk menginstal seluruh dependensi:
   `npm install`
3. Konfigurasikan pelantar variabel lokal Anda di berkas `.env.local`:
   Variabel kunci yang dibutuhkan meliputi:
   - Akses pangkalan data (misal: `DATABASE_URL / MYSQL_URL`).
   - Kata Kunci Token (JWT Secret).
   - Pengaturan kredensial pengirim perpesanan (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`).
4. Setelah instalasi selesai, jalankan server mode pengembangan lokal:
   `npm run dev`

## 6.3 Ringkasan Arsitektur Database Terpilih
Sistem memuat relasi inti layaknya sistem ERP terpusat:
1. **t_users:** Tabel induk utama entitas pengguna (Role Admin, Trainer, Trainee).
2. **t_courses / t_materials:** Menampung struktur naskah dan modul dengan *Longtext* penyokong konten HTML ekstensif.
3. **t_media_attachments:** Skema tabel penyimpan dokumen terpisah untuk melampung media seperti berkas tautan MP4 YouTube, Doc Word, maupun berkas gambar.
4. **t_exams & t_questions:** Mesin Bank Soal berlapis, memisahkan rincian pertanyaan Pilihan Ganda/Esai, Opsi A/B/C/D, hingga kerahasiaan Kunci Jawaban.
5. **t_user_progress:** Barisan tabel pivot kritikal untuk mengabarkan sejauh mana traksi pembelajaran peserta (Nilai progres direkam di antara nilai 0.0 hingga 100.0).
6. **t_audit_logs:** Catatan rekam transaksional untuk melacak pergerakan spesifik Administrator (Menyimpan format *Action*, *Timestamp*, dan *Target Table*).

## 6.4 Struktur Direktori Source Code
- `/src/app`: Wadah *routing* antarmuka utama (Pemetaan halaman dari fitur *Next.js App Router*).
- `/src/components`: Wadah penyimpan kumpulan antarmuka ringkas ber-arsitektur UI-Components spesifik platform (Kancing/Tombol, Kotak Dialog Cepat, *Form Input*).
- `/src/lib`: Menyimpan modul fungsionalitas inti dan utilitas murni pendukung konektivitas, seperti skrip pengiriman Email Nodemailer *transport* dan adaptasi pangkalan data koneksi (Database connection singleton).
- `/src/app/api`: Pintu antarmuka belakang (*Backend API Handler*) meredam serta mengeksekusi permintaan beban *GET/POST/PUT/DELETE* layaknya peladen antarmuka (*RESTful endpoint*).

## 6.5 Guideline Deployment / Go-Live Server
- Dalam fase produksi peluncuran (*Production Launch*), Anda diwajibkan untuk mengkompilasikan set sistem ini supaya rasio kecepatannya teroptimalkan maksimal:
  Beri instruksi komando pembuat susunan struktur peluncuran:
  `npm run build`
- Perintah kompilasi di atas akan menjalankan perakitan ratusan struktur berkas menjadi padat (*optimizing assets minification*).
- Untuk mengaktifkannya secara tangguh sebagai server permanen konstan, jalankan komitmen akhir di server terminal:
  `npm start`

---
*Demikian Panduan Teknis Komprehensif Antigravity Sistem E-Learning LMS ini terjalin. Rangkuman operasional dirancang tanpa terminologi linguistik yang rancu demi meminimalisasi jurang celah miskonsepsi pemahaman, didampingi pilar kokoh kerangka arsitektur IT unggulan masa depan (Dokumentasi v2.1 Beresolusi Penuh).*
