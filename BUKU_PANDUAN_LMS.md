# BUKU PANDUAN & GUIDELINE SISTEM WEBSITE

## Sistem E-Learning — Learning Management System (LMS)

**Edisi Resmi | Dokumen Serah Terima (Handover)**

---

---

# HALAMAN SAMPUL (Cover Page)

> **Arahan Visual untuk Desainer:**
>
> - **Judul Utama:** BUKU PANDUAN & GUIDELINE SISTEM WEBSITE
> - **Subjudul:** Sistem E-Learning — Learning Management System (LMS)
> - **Tagline:** *Edisi Resmi | Dokumen Serah Terima (Handover)*
> - **Elemen Visual:**
>   - Logo perusahaan di kiri atas (ukuran proporsional, tidak mendominasi).
>   - Gunakan whitespace minimal 40% dari area halaman untuk kesan bersih.
>   - Warna dominan: **#111111** (Charcoal Black) sebagai teks utama di atas latar **#FFFFFF**.
>   - Aksen garis tipis berwarna **#2563EB** (Electric Blue) sebagai pembatas visual.
>   - Tahun terbit dan versi dokumen di pojok kanan bawah: *v1.0 — April 2026*

---

---

# DAFTAR ISI

| No. | Bab                                     | Halaman |
|-----|-----------------------------------------|---------|
| 1   | Pendahuluan                             | 3       |
| 2   | Brand & UI Guidelines                   | 5       |
|     | 2.1 Palet Warna                         | 5       |
|     | 2.2 Tipografi                           | 6       |
|     | 2.3 Komponen UI                         | 7       |
| 3   | Alur Pengguna (User Flow)               | 8       |
|     | 3.1 Alur Kerja Administrator            | 8       |
|     | 3.2 Alur Kerja Peserta (Trainee)        | 9       |
| 4   | Panduan Penggunaan Sistem (User Manual) | 10      |
|     | 4.1 Akses Sistem (Login)                | 10      |
|     | 4.2 Pengenalan Antarmuka                | 11      |
|     | 4.3 Fitur Utama — Panel Administrator   | 13      |
|     | 4.4 Fitur Utama — Dashboard Peserta     | 20      |
|     | 4.5 Pengaturan Profil & Keamanan        | 23      |
| 5   | Troubleshooting & FAQ                   | 25      |
| 6   | Penutup & Pusat Bantuan                 | 27      |

---

---

# BAB 1 — PENDAHULUAN

## 1.1 Tujuan Dokumen

Dokumen ini disusun sebagai **panduan resmi pengoperasian** dan **pedoman visual (guideline)** untuk Sistem Website E-Learning (LMS). Tujuan utamanya adalah:

1. **Memastikan kelancaran operasional** — Memberikan panduan langkah-demi-langkah kepada pengelola dan peserta pelatihan agar dapat menggunakan seluruh fitur sistem secara mandiri.
2. **Menjaga konsistensi tampilan** — Mendokumentasikan standar visual (warna, font, komponen UI) agar setiap pengembangan di masa depan tetap selaras dengan identitas desain awal.
3. **Menjadi referensi tunggal** — Seluruh informasi teknis dan operasional terkait sistem terhimpun dalam satu dokumen yang mudah diakses.

## 1.2 Deskripsi Singkat Sistem

**Sistem E-Learning** ini adalah platform manajemen pembelajaran berbasis web yang dirancang untuk mendukung siklus pelatihan secara menyeluruh: mulai dari penyusunan materi, pelaksanaan ujian yang aman, pemantauan peserta secara langsung (*live proctoring*), hingga penerbitan sertifikat kelulusan secara otomatis.

**Fitur Utama:**

| Fitur                    | Deskripsi Singkat                                                             |
|--------------------------|-------------------------------------------------------------------------------|
| Manajemen Materi         | Penyusunan konten pelatihan (teks, gambar, video) menggunakan editor visual.  |
| Bank Soal & Ujian        | Pembuatan soal pilihan ganda (otomatis dinilai) dan esai (dinilai manual).    |
| Penjadwalan Sesi         | Pengaturan jadwal kelas dan ujian dengan status otomatis (Aktif/Selesai).     |
| Safe Exam Browser (SEB)  | Integrasi pengamanan ujian yang mengunci komputer peserta selama ujian.        |
| Live Proctoring          | Pemantauan webcam peserta secara real-time (snapshot otomatis setiap 30 detik).|
| Sertifikasi Otomatis     | Penerbitan sertifikat PDF saat peserta memenuhi syarat kelulusan.             |
| Analitik & Laporan       | Dashboard statistik dengan grafik tren partisipasi dan rasio kelulusan.       |

## 1.3 Target Audiens

Dokumen ini ditujukan untuk:

- **Administrator Sistem** — Mengelola seluruh aspek operasional (peserta, materi, ujian, sesi, dan monitoring).
- **Trainer / Pengajar** — Memantau perkembangan peserta dan meninjau materi pelatihan (akses baca/pantau).
- **Trainee / Peserta** — Mengakses materi, mengikuti ujian, dan mengunduh sertifikat.
- **Tim IT / Developer** — Menjaga konsistensi visual dan teknis dalam pengembangan lanjutan.

---

---

# BAB 2 — BRAND & UI GUIDELINES

> Bagian ini ditujukan untuk **developer dan desainer internal** yang bertanggung jawab atas pengembangan dan pemeliharaan tampilan sistem.

## 2.1 Palet Warna

Sistem menggunakan pendekatan **monokrom mewah** dengan aksen fungsional yang minimal. Nuansanya dirancang untuk memberikan kesan **bersih, profesional, dan tidak membingungkan**.

| Kategori            | Nama Token             | Kode HEX     | Preview                     | Keterangan                              |
|---------------------|------------------------|---------------|-----------------------------|-----------------------------------------|
| **Primary**         | `--primary`            | `#000000`     | ⬛                          | Hitam pekat. Digunakan untuk tombol utama dan elemen aksi. |
| **Primary (Alt)**   | `--primary-foreground` | `#FFFFFF`     | ⬜                          | Putih. Teks di atas elemen Primary.     |
| **Background**      | `--background`         | `#F8F9FA`     | 🟫 (abu sangat terang)     | Latar belakang seluruh halaman.         |
| **Foreground**      | `--foreground`         | `#111111`     | ⬛ (abu kelam)              | Warna teks utama dan heading.           |
| **Secondary**       | `--secondary`          | `#F1F3F5`     | ⬜ (abu terang)             | Latar elemen sekunder (badge, label).   |
| **Muted Text**      | `--muted-foreground`   | `#6B7280`     | 🔘 (abu medium)            | Teks pendukung, keterangan, placeholder.|
| **Destructive**     | `--destructive`        | `#EF4444`     | 🟥                          | Peringatan, error, tombol hapus.        |
| **Card**            | `--card`               | `#FFFFFF`     | ⬜                          | Latar kartu komponen (Glass Card).      |
| **Border**          | `--border`             | `rgba(0,0,0,0.08)` | —                     | Garis pembatas halus antar elemen.      |
| **Ring/Focus**      | `--ring`               | `#000000`     | ⬛                          | Indikator fokus pada input dan tombol.  |

**Catatan Penting:**
- Hindari penggunaan warna-warna mencolok (neon, saturasi tinggi) di luar palet yang telah ditentukan.
- Warna aksen fungsional (Hijau untuk sukses `#10B981`, Biru untuk info `#2563EB`, Kuning untuk peringatan `#F59E0B`) hanya digunakan untuk **indikator status**, bukan dekorasi.

## 2.2 Tipografi

| Elemen            | Font Family                                        | Ukuran (rem) | Berat (weight) | Keterangan                 |
|-------------------|----------------------------------------------------|--------------|----------------|----------------------------|
| **Heading 1**     | Helvetica Neue, Helvetica, Arial, sans-serif       | 2.0 — 3.5    | 700 — 800      | Judul halaman utama.       |
| **Heading 2**     | Helvetica Neue, Helvetica, Arial, sans-serif       | 1.25 — 2.2   | 600 — 700      | Sub-judul section.         |
| **Heading 3**     | Helvetica Neue, Helvetica, Arial, sans-serif       | 1.0 — 1.4    | 600             | Label grup/komponen.       |
| **Body Text**     | Helvetica Neue, Helvetica, Arial, sans-serif       | 0.875 — 1.1  | 400             | Paragraf, deskripsi.       |
| **Caption/Label** | Helvetica Neue, Helvetica, Arial, sans-serif       | 0.65 — 0.85  | 500 — 700      | Label kecil, badge, status.|
| **Monospace**     | Geist Mono, Courier New, monospace                 | 0.75 — 0.85  | 400             | Kode, ID teknis.           |

**Aturan Tipografi:**
- Gunakan `letter-spacing: -0.025em` pada Heading 1 untuk kesan modern dan padat.
- Teks body menggunakan `line-height: 1.6` untuk keterbacaan optimal.
- Semua teks menggunakan rendering `antialiased` agar tajam di semua layar.

## 2.3 Komponen UI

### Tombol (Buttons)

| Tipe              | Gaya Visual                                                                 |
|-------------------|-----------------------------------------------------------------------------|
| **Primary**       | Background: `#000000`, Teks: `#FFFFFF`. Rounded: `0.75rem`. Shadow halus.   |
| **Secondary**     | Background: Transparan. Border: `rgba(0,0,0,0.08)`. Teks: `#111111`.       |
| **Destructive**   | Background: `#EF4444/10`. Teks: `#EF4444`. Digunakan untuk aksi hapus.     |
| **Icon Button**   | Ukuran `36x36px`. Background: `rgba(0,0,0,0.05)`. Rounded: `0.5rem`.       |

**Interaksi:**
- Hover: `opacity: 0.9` + `translateY(-2px)` untuk efek mengambang halus.
- Active/Tekan: `scale(0.98)` untuk umpan balik sentuhan.
- Disabled: `opacity: 0.5`, kursor `not-allowed`.

### Kartu (Glass Card)

```
Background : #FFFFFF (solid)
Border     : 1px solid rgba(0, 0, 0, 0.05)
Shadow     : 0 4px 24px -2px rgba(0, 0, 0, 0.03)
Radius     : 1.35rem (--radius-2xl)
Hover      : translateY(-2px), shadow lebih dalam
```

### Form / Input

```
Background : rgba(255, 255, 255, 0.5)
Border     : 1px solid rgba(0, 0, 0, 0.08)
Focus      : Border #000000, Shadow ring 2px
Radius     : 0.75rem
Padding    : 0.625rem 1rem
```

### Spasi & Whitespace

- Antar section: `2.5rem — 5rem`
- Antar kartu: `1.5rem — 2.5rem`
- Padding internal kartu: `1.5rem — 2rem`
- Margin antar elemen dalam kartu: `1rem — 1.5rem`

---

---

# BAB 3 — ALUR PENGGUNA (USER FLOW)

## 3.1 Alur Kerja Administrator

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   LOGIN     │────▶│  DASHBOARD ADMIN │────▶│  KELOLA MASTER  │
│  (Auth)     │     │  (Overview)      │     │  DATA           │
└─────────────┘     └──────────────────┘     └────────┬────────┘
                                                      │
                    ┌─────────────────────────────────┤
                    ▼                                 ▼
            ┌───────────────┐               ┌────────────────┐
            │ BUAT MATERI   │               │ KELOLA PESERTA │
            │ (Content)     │               │ (Participants) │
            └───────┬───────┘               └────────┬───────┘
                    │                                 │
                    ▼                                 │
            ┌───────────────┐                         │
            │ BUAT UJIAN &  │                         │
            │ BANK SOAL     │                         │
            │ (Exams)       │                         │
            └───────┬───────┘                         │
                    │                                 │
                    ▼                                 ▼
            ┌───────────────────────────────────────────┐
            │       BUAT SESI (Sessions)                │
            │  Gabungkan: Modul + Peserta + Jadwal      │
            │  Opsi: Aktifkan Safe Exam Browser (SEB)   │
            └────────────────────┬──────────────────────┘
                                 │
                                 ▼
            ┌─────────────────────────────────────────────┐
            │       MONITORING LIVE PROCTORING             │
            │  Pantau webcam peserta secara real-time       │
            │  Lihat progress pengerjaan (0% — 100%)       │
            └────────────────────┬────────────────────────┘
                                 │
                                 ▼
            ┌─────────────────────────────────────────────┐
            │       EXPORT LAPORAN & SERTIFIKASI           │
            │  Unduh laporan Excel per sesi                 │
            │  Sertifikat otomatis untuk peserta lulus      │
            └─────────────────────────────────────────────┘
```

## 3.2 Alur Kerja Peserta (Trainee)

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   LOGIN     │────▶│  DASHBOARD       │────▶│  PILIH SESI     │
│  (Auth)     │     │  OVERVIEW        │     │  AKTIF          │
└─────────────┘     │  • Kalender      │     └────────┬────────┘
                    │  • Statistik     │              │
                    └──────────────────┘              │
                                                      ▼
                                              ┌───────────────┐
                                              │ BACA MATERI   │
                                              │ PELATIHAN     │
                                              │ (Progress %)  │
                                              └───────┬───────┘
                                                      │
                                                      ▼
                                              ┌───────────────┐
                                              │ MULAI UJIAN   │
                                              │               │
                                              │ ┌───────────┐ │
                                              │ │ SEB Aktif? │ │
                                              │ │  Ya → Buka │ │
                                              │ │  SEB App   │ │
                                              │ │           │ │
                                              │ │ Tidak →   │ │
                                              │ │ Browser   │ │
                                              │ │ Biasa     │ │
                                              │ └───────────┘ │
                                              └───────┬───────┘
                                                      │
                                                      ▼
                                        ┌─────────────────────┐
                                        │  HASIL UJIAN        │
                                        │                     │
                                        │  Lulus ──▶ Download  │
                                        │           Sertifikat │
                                        │                     │
                                        │  Belum ──▶ Selesai / │
                                        │           Remedial   │
                                        └─────────────────────┘
```

---

---

# BAB 4 — PANDUAN PENGGUNAAN SISTEM (USER MANUAL)

## 4.1 Akses Sistem (Login)

### Langkah-langkah Login

1. Buka **browser** Anda (Chrome, Firefox, atau Edge — versi terbaru direkomendasikan).
2. Masukkan **alamat URL** sistem yang telah diberikan oleh administrator.
3. Anda akan diarahkan ke **Halaman Login** yang menampilkan form masuk.

   > [Masukkan Screenshot Halaman Login di sini]

4. Isi data berikut:
   - **Username** — Nama pengguna yang diberikan oleh administrator.
   - **Password** — Kata sandi akun Anda.
5. Klik tombol **"Masuk ke Dashboard"**.
6. Sistem akan mengarahkan Anda ke halaman yang sesuai:
   - **Admin** → Dashboard Administrator (Overview Statistik).
   - **Trainee** → Dashboard Peserta (Kalender & Sesi).

### Lupa Password

> Saat ini, fitur **"Lupa Password"** tidak tersedia secara mandiri untuk peserta. Jika Anda lupa kata sandi, silakan hubungi **Administrator** untuk melakukan reset melalui panel **User Management**.

### Penting Diperhatikan

- Jangan membagikan username dan password Anda kepada siapa pun.
- Sistem akan menampilkan pesan error jika kredensial salah: *"Login gagal"*.
- Jika terjadi masalah koneksi, pesan *"Terjadi kesalahan koneksi"* akan muncul.

---

## 4.2 Pengenalan Antarmuka

### A. Antarmuka Administrator

Setelah berhasil login sebagai Admin, Anda akan melihat **Dashboard Overview** yang terdiri dari:

> [Masukkan Screenshot Dashboard Admin di sini]

| Komponen              | Posisi         | Fungsi                                                        |
|-----------------------|----------------|---------------------------------------------------------------|
| **Sidebar (Navigasi)**| Sisi kiri      | Berisi menu navigasi ke semua modul sistem.                   |
| **Header**            | Atas           | Menampilkan judul halaman aktif dan aksi cepat.               |
| **Panel Statistik**   | Atas konten    | 4 kartu: Total Materi, Bank Soal, Sesi Ujian, Total Peserta. |
| **Grafik Analitik**   | Tengah         | Tren partisipasi 14 hari terakhir & rasio kelulusan.          |
| **Sesi Terkini**      | Bawah kiri     | Daftar 5 sesi terakhir beserta statusnya.                     |
| **Aksi Cepat**        | Bawah kanan    | Shortcut ke pembuatan materi, soal, dan sesi baru.            |

**Menu Sidebar Administrator:**

1. **Overview** — Ringkasan statistik sistem.
2. **Content (Materi)** — Buat dan kelola artikel pelatihan.
3. **Modules** — Susun modul yang menggabungkan materi dan ujian.
4. **Exams (Ujian)** — Atur parameter ujian dan bank soal.
5. **Sessions (Sesi)** — Jadwalkan kelas dan pasangkan peserta.
6. **Participants (Peserta)** — Kelola data peserta pelatihan.
7. **Users (Pengguna)** — Kelola akun Admin dan Trainer.
8. **Monitoring** — Pantau ujian secara langsung (Live Proctoring).

### B. Antarmuka Peserta (Trainee)

> [Masukkan Screenshot Dashboard Peserta di sini]

| Komponen            | Posisi        | Fungsi                                                            |
|---------------------|---------------|-------------------------------------------------------------------|
| **Sidebar**         | Sisi kiri     | Navigasi: Overview, Sesi Saya, Profil, Riwayat, Leaderboard.     |
| **Statistik Cepat** | Atas konten   | 3 kartu: Sesi Berjalan, Akan Datang, dan Selesai.                |
| **Kalender**        | Tengah kiri   | Visualisasi jadwal ujian dan pelatihan.                           |
| **Sesi Terbaru**    | Tengah kanan  | Daftar sesi aktif dengan progress bar.                            |

---

## 4.3 Fitur Utama — Panel Administrator

### ALUR 1: Membuat Sesi Ujian (Dari Awal Hingga Monitoring)

Ini merupakan **alur kerja utama** seorang Administrator. Berikut langkah-langkahnya secara berurutan:

---

#### Langkah 1 — Buat Materi Pelatihan

1. Masuk ke menu **Content (Materi)** melalui sidebar.

   > [Masukkan Screenshot Halaman Materi di sini]

2. Klik tombol **"Buat Materi Baru"** di pojok kanan atas.
3. Isi **Judul Materi** pada formulir yang muncul.
4. Gunakan **editor visual** untuk menyusun konten:
   - Anda dapat mengetik teks, menambahkan **gambar**, mengatur **format** (bold, italic, heading), dan menyisipkan **tautan video**.
5. Setelah konten selesai, klik **"Simpan"**.

| Informasi | Detail |
|-----------|--------|
| **Menu**      | Sidebar → Content |
| **Aksi**      | Buat Materi Baru |
| **Input**     | Judul + konten HTML (via editor visual) |
| **Output**    | Materi tersimpan dan siap dipasangkan ke Modul |

---

#### Langkah 2 — Buat Bank Soal (Ujian)

1. Masuk ke menu **Exams (Ujian)** melalui sidebar.

   > [Masukkan Screenshot Halaman Ujian di sini]

2. Klik **"Buat Ujian Baru"**.
3. Isi parameter ujian:

| Parameter         | Keterangan                                                |
|-------------------|-----------------------------------------------------------|
| **Judul Ujian**   | Nama identitas ujian (contoh: "Ujian Akhir Modul 1").     |
| **Durasi (Menit)**| Batas waktu pengerjaan. Jawaban otomatis terkirim saat habis.|
| **Passing Grade** | Persentase minimum untuk lulus (contoh: 70%).             |

4. Setelah parameter tersimpan, klik tombol **"Kelola Soal"** pada ujian yang baru dibuat.
5. Tambahkan soal satu per satu:
   - **Pilihan Ganda**: Tulis pertanyaan, opsi jawaban (A/B/C/D), dan tandai jawaban yang benar. Sistem akan **menilai secara otomatis**.
   - **Esai**: Tulis pertanyaan terbuka. Admin/Trainer akan **menilai secara manual** setelah peserta selesai.

---

#### Langkah 3 — Susun Modul Pembelajaran

1. Masuk ke menu **Modules** melalui sidebar.
2. Klik **"Buat Modul Baru"**.
3. Masukkan **Judul Modul**.
4. **Pasangkan item** ke dalam modul:
   - Tambahkan **Materi** yang telah dibuat sebelumnya (Content).
   - Tambahkan **Ujian** yang telah dibuat sebelumnya (Exams).
   - Atur **urutan item** (peserta wajib menyelesaikan materi sebelum ujian).
5. Simpan Modul.

---

#### Langkah 4 — Jadwalkan Sesi (Sessions)

1. Masuk ke menu **Sessions** melalui sidebar.

   > [Masukkan Screenshot Halaman Sesi di sini]

2. Klik **"Buat Sesi Baru"**.
3. Isi formulir sesi:

| Field              | Keterangan                                                    |
|--------------------|---------------------------------------------------------------|
| **Judul Sesi**     | Nama identitas sesi (contoh: "Batch 1 — Pelatihan K3").      |
| **Pilih Modul**    | Modul pembelajaran yang akan diajarkan di sesi ini.           |
| **Waktu Mulai**    | Tanggal dan jam sesi mulai aktif.                             |
| **Waktu Selesai**  | Tanggal dan jam sesi berakhir (otomatis terkunci setelahnya). |
| **Require SEB**    | Centang jika ujian wajib menggunakan Safe Exam Browser.       |

4. Masukkan **peserta** yang berhak mengikuti sesi ini. Anda dapat memilih secara individu atau massal.
5. Klik **"Simpan Sesi"**.

**Status Sesi Otomatis:**

| Status             | Indikator Warna | Kondisi                                    |
|--------------------|-----------------|--------------------------------------------|
| **Akan Datang**    | 🟡 Kuning      | Waktu saat ini < Waktu Mulai.              |
| **Berlangsung**    | 🟢 Hijau       | Waktu saat ini berada di antara Mulai & Selesai.|
| **Selesai**        | ⚫ Abu-abu      | Waktu saat ini > Waktu Selesai.            |

---

#### Langkah 5 — Pantau Ujian (Live Proctoring)

1. Masuk ke menu **Monitoring** melalui sidebar.

   > [Masukkan Screenshot Halaman Monitoring di sini]

2. Pilih **Sesi** yang sedang berlangsung melalui dropdown (sesi aktif ditandai dengan ikon 🟢).
3. Klik tombol **🔄 Refresh** untuk memperbarui data secara manual, atau biarkan sistem melakukan **refresh otomatis setiap 30 detik**.
4. Halaman menampilkan **Grid Snapshot Webcam** peserta:

   | Informasi           | Keterangan                                              |
   |---------------------|---------------------------------------------------------|
   | **Foto Webcam**     | Tangkapan layar wajah peserta (otomatis diambil).       |
   | **Nama & Username** | Identitas peserta di bawah setiap foto.                 |
   | **Waktu Capture**   | Stempel waktu saat foto diambil.                        |

5. Jika tidak ada foto yang muncul, kemungkinan:
   - Peserta belum memulai ujian.
   - Browser peserta tidak mendukung webcam.
   - SEB tidak diaktifkan pada sesi tersebut.

---

#### Langkah 6 — Export Laporan

1. Masuk ke menu **Sessions** → Klik sesi yang ingin dilaporkan.
2. Pada halaman **Detail Sesi**, Anda akan melihat tabel peserta dengan kolom:
   - Username, Nama Lengkap, Progress (%), dan Status (Belum / Mengerjakan / Selesai).
3. Klik tombol **"Export Laporan Excel"** di pojok kanan atas tabel peserta.
4. File Excel akan terunduh secara otomatis.

---

### ALUR 2: Mengelola Akun Pengguna

1. Masuk ke menu **Users** melalui sidebar.

   > [Masukkan Screenshot Halaman Users di sini]

2. Halaman menampilkan tabel seluruh akun **Admin** dan **Trainer** yang terdaftar.
3. Gunakan **kolom pencarian** untuk menemukan pengguna spesifik.

**Menambah Pengguna Baru:**
1. Klik **"Tambah Pengguna"**.
2. Isi formulir:
   - **Nama Lengkap**
   - **Username** (digunakan untuk login).
   - **Password** (password awal yang dapat diubah pengguna).
   - **Role**: Pilih antara *Administrator* atau *Pelatih/Trainer*.
3. Klik **Simpan**.

**Mengedit / Menghapus:**
- Klik ikon **✏️ (Edit)** untuk mengubah data pengguna.
- Klik ikon **🗑️ (Hapus)** untuk menghapus akun secara permanen (memerlukan konfirmasi).
- **Catatan:** Akun Administrator utama (`admin`) tidak dapat dihapus sebagai mekanisme keamanan.

---

## 4.4 Fitur Utama — Dashboard Peserta (Trainee)

### A. Halaman Overview

> [Masukkan Screenshot Dashboard Peserta di sini]

Setelah login, peserta akan melihat halaman **Overview** yang berisi:
- **3 Kartu Statistik**: Jumlah sesi yang Berjalan, Akan Datang, dan Selesai.
- **Kalender Interaktif**: Menampilkan jadwal pelatihan secara visual. Peserta dapat mengklik tanggal untuk melihat sesi pada hari tersebut.
- **Widget "Lanjutkan Belajar"**: Shortcut langsung ke halaman daftar sesi aktif.
- **Daftar Sesi Terbaru**: 4 sesi terkini dengan informasi nama modul.

### B. Halaman "Sesi Saya"

> [Masukkan Screenshot Halaman Sesi Peserta di sini]

1. Klik menu **"Sesi Saya"** di sidebar.
2. Halaman menampilkan seluruh sesi yang diikuti peserta, dikelompokkan berdasarkan status:

| Kelompok              | Ikon  | Keterangan                                           |
|-----------------------|-------|------------------------------------------------------|
| **Sedang Berlangsung**| 🟢    | Sesi aktif. Klik untuk mengakses materi dan ujian.   |
| **Akan Datang**       | 🔵    | Sesi terjadwal. Dikunci hingga waktu mulai tiba.     |
| **Selesai (100%)**    | ✅    | Seluruh item telah diselesaikan.                     |
| **Berakhir**          | ⚫    | Sesi telah melewati batas waktu tanpa 100% progres.  |

3. Setiap baris sesi menampilkan **Progress Bar** yang menunjukkan persentase item yang telah diselesaikan (misal: 3/5 item = 60%).

### C. Mengerjakan Sesi

1. Klik sesi yang berstatus **"Sedang Berlangsung"**.
2. Anda akan melihat daftar item dalam modul:
   - **Materi** — Klik untuk membaca. Setelah dibaca, item akan ditandai selesai secara otomatis.
   - **Ujian** — Klik untuk memulai pengerjaan soal. Jika SEB diwajibkan, pastikan aplikasi SEB telah terinstal di komputer Anda.
3. Selesaikan seluruh item untuk mencapai **progres 100%**.

### D. Mengunduh Sertifikat

Jika Anda telah menyelesaikan seluruh sesi dengan skor ujian di atas Passing Grade:
1. Tombol **"Download Sertifikat"** akan muncul pada halaman profil atau detail sesi.
2. Klik tombol tersebut. File **PDF** akan terunduh secara otomatis.

---

## 4.5 Pengaturan Profil & Keamanan

> [Masukkan Screenshot Halaman Profil di sini]

1. Klik menu **"Profil & Pengaturan"** di sidebar.
2. Halaman terbagi menjadi dua bagian:

### Bagian 1 — Data Personal

| Field             | Keterangan                                      | Bisa Diubah? |
|-------------------|-------------------------------------------------|:------------:|
| Nama Lengkap      | Nama resmi yang tertera di sertifikat.           | ✅ Ya        |
| Username           | Identitas login. Ditetapkan oleh Admin.          | ❌ Tidak     |
| Nomor Telepon      | Kontak pribadi.                                  | ✅ Ya        |
| Jenis Kelamin      | Pilih: Laki-Laki (L) atau Perempuan (P).         | ✅ Ya        |
| Tanggal Lahir      | Format: YYYY-MM-DD.                              | ✅ Ya        |
| Institusi          | Nama instansi/perusahaan asal.                   | ✅ Ya        |
| Alamat Lengkap     | Alamat domisili.                                 | ✅ Ya        |

### Bagian 2 — Keamanan Akun (Ganti Password)

1. Isi **"Password Saat Ini"** — untuk verifikasi identitas.
2. Isi **"Password Baru"**.
3. Isi **"Konfirmasi Password Baru"** — harus sama persis dengan password baru.
4. Klik **"Simpan Perubahan"**.

> **Catatan:** Jika Anda tidak ingin mengganti password, **kosongkan** ketiga field tersebut. Data personal tetap dapat disimpan tanpa mengubah kata sandi.

---

---

# BAB 5 — TROUBLESHOOTING & FAQ

### Masalah 1: Tidak bisa login (pesan: "Login gagal")

| Aspek     | Detail                                                                  |
|-----------|-------------------------------------------------------------------------|
| **Gejala**    | Muncul pesan error merah: *"Login gagal"* setelah klik tombol Masuk.    |
| **Penyebab**  | Username atau password salah; akun belum didaftarkan oleh admin.        |
| **Solusi**    | 1. Periksa kembali penulisan username (huruf besar/kecil sensitif). 2. Pastikan password tidak mengandung spasi di awal/akhir. 3. Hubungi Admin untuk reset password atau konfirmasi status akun. |

### Masalah 2: Halaman monitoring tidak menampilkan foto webcam

| Aspek     | Detail                                                                  |
|-----------|-------------------------------------------------------------------------|
| **Gejala**    | Grid monitoring kosong, muncul pesan: *"Tidak Ada Tangkapan Layar"*.    |
| **Penyebab**  | Peserta belum memulai ujian; webcam tidak diizinkan; SEB tidak aktif.   |
| **Solusi**    | 1. Pastikan peserta sudah klik "Mulai Ujian". 2. Pastikan SEB diaktifkan pada pengaturan sesi. 3. Minta peserta untuk mengizinkan akses kamera di browser/SEB. |

### Masalah 3: Sertifikat tidak muncul meskipun ujian sudah selesai

| Aspek     | Detail                                                                  |
|-----------|-------------------------------------------------------------------------|
| **Gejala**    | Tombol "Download Sertifikat" tidak tersedia di dashboard peserta.       |
| **Penyebab**  | Progres belum 100%; skor ujian di bawah Passing Grade.                  |
| **Solusi**    | 1. Pastikan seluruh item materi dalam modul sudah dibaca. 2. Periksa apakah skor ujian mencapai passing grade yang ditentukan. 3. Hubungi admin untuk pengecekan manual pada data `user_progress`. |

### Masalah 4: Halaman loading terus-menerus (tidak selesai memuat)

| Aspek     | Detail                                                                  |
|-----------|-------------------------------------------------------------------------|
| **Gejala**    | Layar menampilkan animasi loading (spinner) tanpa henti.                |
| **Penyebab**  | Koneksi internet lambat; server sedang mengalami beban tinggi.          |
| **Solusi**    | 1. Periksa koneksi internet Anda. 2. Coba refresh halaman (tekan `F5` atau `Ctrl+R`). 3. Bersihkan cache browser: `Ctrl+Shift+Delete` → centang "Cached images and files" → hapus. 4. Jika masih berlanjut, hubungi tim IT. |

---

---

# BAB 6 — PENUTUP & PUSAT BANTUAN

## 6.1 Penutup

Sistem E-Learning ini dirancang untuk mempermudah seluruh aspek operasional pelatihan dengan jaminan keamanan tinggi dan pengalaman pengguna yang modern. Dengan mematuhi panduan dalam dokumen ini, diharapkan seluruh pihak (Pengelola, Pengajar, dan Peserta) dapat memanfaatkan sistem secara optimal dan mandiri.

Kami berkomitmen untuk terus meningkatkan kualitas sistem berdasarkan umpan balik pengguna.

## 6.2 Pusat Bantuan & Kontak

Jika Anda mengalami kendala teknis atau membutuhkan informasi lebih lanjut, silakan hubungi tim dukungan kami:

| Saluran          | Detail                                        |
|------------------|-----------------------------------------------|
| **Email**        | support@lms-system.com                        |
| **WhatsApp**     | +62 812-34XX-XXXX                             |
| **Jam Operasional** | Senin — Jumat, 08.00 — 17.00 WIB          |
| **Respon Darurat**| Sabtu & Minggu hanya untuk isu kritis sistem. |

> **Catatan:** Untuk permintaan **reset password**, sertakan username dan nama lengkap Anda pada pesan agar proses dapat dipercepat.

---

---

*Dokumen ini disusun sebagai aset intelektual resmi untuk proses serah terima (Handover) Sistem E-Learning LMS.*
*Versi 1.0 — April 2026*
