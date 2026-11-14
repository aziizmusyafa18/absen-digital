# ADINDA - Absensi Digital, Informasi Nilai, & Dokumentasi Agenda

**Sistem Administrasi Digital, Kehadiran Siswa, Informasi Nilai, dan Agenda Guru untuk SMK/SMA**

[Fitur](#fitur) • [Tech Stack](#tech-stack) • [Instalasi](#instalasi) • [Konfigurasi](#konfigurasi) • [Struktur Proyek](#struktur-proyek) • [Kontribusi](#kontribusi)

---

## 📝 Overview

**ADINDA** (_Absensi Digital, Informasi Nilai, & Dokumentasi Agenda_) adalah platform komprehensif manajemen kehadiran, rekapitulasi penilaian, dan jurnal guru yang dirancang untuk mempermudah proses administrasi sekolah (SMK/SMA). Sistem ini menggabungkan kemudahan input data oleh guru dengan transparansi rekapitulasi bagi admin serta notifikasi WhatsApp otomatis ke orang tua secara real-time.

### Highlights

- **AI-Powered WhatsApp Notifications** - Integrasi Google Gemini AI untuk merangkum dan mengirim rekap absensi harian yang dipersonalisasi ke orang tua setiap jam 14:00.
- **Smart Monitoring** - Deteksi otomatis siswa yang tidak hadir (Alpa) selama 3 kali berturut-turut pada mata pelajaran yang sama.
- **Session Locking** - Sistem penguncian sesi absen untuk memastikan integritas data kehadiran real-time.
- **Comprehensive Reporting** - Rekapitulasi nilai dan absensi (harian/bulanan) dengan ekspor Excel yang detail per mata pelajaran.
- **Modern UI** - Antarmuka responsif menggunakan Bootstrap 5 dan CSS kustom dengan fitur Scan QR Code yang diperbarui.
- **Secure Auth** - Autentikasi menggunakan JWT (JSON Web Token) dan enkripsi Bcrypt.

---

## ✨ Fitur Terbaru (Update)

### 🤖 Kecerdasan Buatan (AI) & WhatsApp

| Fitur                 | Deskripsi                                                                                                        |
| :-------------------- | :--------------------------------------------------------------------------------------------------------------- |
| **Rekap Harian AI**   | Otomatis merangkum ketidakhadiran siswa menggunakan Google Gemini AI dan mengirimnya ke orang tua jam 14:00 WIB. |
| **Peringatan Dini**   | Notifikasi khusus jika siswa terdeteksi Alpa 3x berturut-turut pada mata pelajaran tertentu.                     |
| **Warning Kehadiran** | Fitur "Early Warning" bulanan untuk siswa dengan tingkat kehadiran di bawah 75%.                                 |
| **Queue System**      | Sistem antrean pengiriman pesan WhatsApp untuk menghindari pemblokiran akun.                                     |

### 📊 Manajemen Data & Laporan

| Fitur                    | Deskripsi                                                                                     |
| :----------------------- | :-------------------------------------------------------------------------------------------- |
| **Eksport Nilai Detail** | Rekap nilai bulanan per mata pelajaran dengan perhitungan rata-rata otomatis ke format Excel. |
| **Locking Session**      | Penguncian sesi absensi guru untuk mencegah manipulasi atau duplikasi data kehadiran.         |
| **Filter Canggih**       | Filter rekapitulasi berdasarkan Jurusan, Kelas, Bulan, dan Mata Pelajaran.                    |
| **Contact Management**   | Manajemen nomor WhatsApp orang tua terintegrasi dalam data master siswa.                      |

### 👨‍🏫 Guru

| Fitur                   | Deskripsi                                                  |
| :---------------------- | :--------------------------------------------------------- |
| **Input Absensi**       | Melakukan absensi siswa per mata pelajaran                 |
| **Notifikasi Otomatis** | Pesan WhatsApp otomatis ke ortu jika siswa Alpa/Izin/Sakit |
| **Jurnal Harian**       | Mencatat jurnal kegiatan belajar mengajar                  |
| **Input Nilai**         | Manajemen nilai siswa untuk setiap kelas                   |
| **Dashboard Guru**      | Ringkasan jadwal dan riwayat mengajar                      |
| **Edit Profil**         | Personalisasi identitas dan foto profil guru               |

### 👨‍👩‍👦 Orang Tua / Publik

| Fitur              | Deskripsi                                             |
| :----------------- | :---------------------------------------------------- |
| **Pesan WhatsApp** | Menerima peringatan otomatis jika anak tidak hadir    |
| **Cek Kehadiran**  | Pencarian status kehadiran siswa berdasarkan NIS/Nama |
| **Dashboard Ortu** | Melihat riwayat kehadiran anak secara real-time       |

---

## 🛠️ Tech Stack

### Backend

| Teknologi            | Deskripsi                                               |
| :------------------- | :------------------------------------------------------ |
| **Node.js**          | Runtime environment JavaScript                          |
| **Express.js**       | Web framework untuk API                                 |
| **Sequelize**        | ORM untuk interaksi database MySQL                      |
| **Socket.io**        | Komunikasi real-time dua arah                           |
| **WhatsApp-Web.js**  | Library gateway WhatsApp                                |
| **Google Gemini AI** | Pembangkit pesan notifikasi otomatis yang natural       |
| **Node-Cron**        | Penjadwal tugas otomatis (Rekap harian jam 14:00)       |
| **ExcelJS**          | Library untuk export data ke format .xlsx yang kompleks |
| **JWT**              | Mekanisme keamanan autentikasi                          |

### Frontend

| Teknologi            | Deskripsi                             |
| :------------------- | :------------------------------------ |
| **Bootstrap 5**      | Framework CSS untuk desain responsif  |
| **Vanilla JS**       | Logika frontend tanpa framework berat |
| **Socket.io Client** | Penerima notifikasi real-time         |

### Database

| Teknologi | Deskripsi                            |
| :-------- | :----------------------------------- |
| **MySQL** | Sistem manajemen database relasional |

---

## 🚀 Instalasi

### Prasyarat

- Node.js v18 atau lebih tinggi
- MySQL / MariaDB
- npm (Node Package Manager)

### Langkah Cepat

```bash
# 1. Clone repositori
git clone <repository-url>
cd absen-digital

# 2. Instal dependensi
npm install

# 3. Konfigurasi Database
# Buat database bernama 'absen_digital' di MySQL Anda
# Import file 'absen_digital.sql' ke database tersebut

# 4. Atur Environment
# Buat file .env di root folder (lihat bagian Konfigurasi)

# 5. Jalankan Aplikasi
# Mode Produksi
npm start

# Mode Pengembangan (Auto-reload)
npm run dev
```

---

## ⚙️ Konfigurasi

### Environment Variables (.env)

Pastikan Anda mengatur file `.env` di folder `backend/` atau root sesuai kebutuhan:

```dotenv
PORT=3000
DB_HOST=localhost
DB_USER=root
DB_PASS=
DB_NAME=absen_digital
JWT_SECRET=rahasia_super_kuat
GEMINI_API_KEY=your_gemini_api_key_here
```

---

## 🔐 Sistem Keamanan

Aplikasi ini diimplementasikan dengan standar keamanan modern untuk melindungi data sensitif:

- **JWT (JSON Web Token)** - Autentikasi stateless untuk mengamankan API endpoint.
- **Bcrypt Hashing** - Semua password disimpan dalam format hash yang tidak dapat didekripsi.
- **Role-Based Access Control (RBAC)** - Pembatasan akses fitur berdasarkan peran (Admin, Guru, Orang Tua).
- **CORS Protection** - Membatasi permintaan API hanya dari domain yang diizinkan.
- **Input Validation & Sanitization** - Melindungi aplikasi dari serangan SQL Injection dan XSS.
- **Multer File Filter** - Validasi tipe file dan ukuran pada upload foto profil untuk mencegah eksekusi file berbahaya.

---

## 📊 Database Schema

### Core Tables Structure

```text
┌──────────────┐      ┌─────────────┐      ┌────────────┐
│    Users     │      │    Kelas    │      │   Jurusan  │
├──────────────┤      ├─────────────┤      ├────────────┤
│ id (PK)      │      │ id (PK)      │      │ id (PK)    │
│ username     │      │ nama         │      │ nama       │
│ password     │      │ tingkat      │      │ singkatan  │
│ role         │      │ jurusan_id   │◄─────┤ deskripsi  │
└──────────────┘      └─────────────┘      └────────────┘
       │                     ▲
       ▼                     │
┌──────────────┐      ┌────────────┐       ┌────────────────┐
│     Guru     │      │    Siswa   │       │ LogNotifikasi  │
├──────────────┤      ├────────────┤       ├────────────────┤
│ id (PK)      │      │ id (PK)    │       │ id (PK)        │
│ user_id (FK) │      │ nis        │       │ pesan          │
│ nip          │      │ nama       │       │ no_tujuan      │
│ nama         │      │ kelas_id   │─────┐ │ status         │
│ mapel        │      │ no_hp_ortu │     │ │ siswa_id (FK)  │
└──────────────┘      └────────────┘     │ └────────────────┘
       │                     │           │          ▲
       ▼                     ▼           ▼          │
┌──────────────┐      ┌────────────┐      ┌────────────┐
│    Jurnal    │      │   Absensi  │      │    Nilai   │
├──────────────┤      ├────────────┤      ├────────────┤
│ id (PK)      │      │ id (PK)    │      │ id (PK)    │
│ guru_id (FK) │◄─────│ jurnal_id  │      │ siswa_id   │
│ kelas_id (FK)│      │ siswa_id   │      │ kelas_id   │
│ mapel        │      │ status     │      │ nilai      │
│ foto_kegiatan│      └────────────┘      └────────────┘
└──────────────┘
```

---

## 📁 Struktur Proyek

```text
absen-digital/
├── backend/
│   ├── config/          # Konfigurasi Database
│   ├── middleware/      # Auth & Upload Middleware
│   ├── models/          # Sequelize Models
│   ├── routes/          # API Endpoints
│   ├── socket/          # Socket.io Logic
│   └── server.js        # Main Entry Point
├── frontend/
│   └── public/          # HTML, CSS, & JS Files
├── uploads/             # File storage (Profiles/Import)
├── absen_digital.sql    # Database Schema
└── package.json         # Project Dependencies
```

---

## 🔑 Akun Default

Setelah menjalankan database setup, Anda dapat masuk dengan:

| Role      | Username / NIP        | Password   |
| :-------- | :-------------------- | :--------- |
| **Admin** | `admin`               | `admin123` |
| **Guru**  | `123456` (Contoh NIP) | `password` |

---

## 📄 Lisensi

Proyek ini dilisensikan di bawah [MIT License](LICENSE).

---

## 👨‍💻 Author

Dikembangkan oleh **saya sendiri**

---

<p align="center">
  Dibuat dengan ❤️ untuk kemajuan pendidikan Indonesia
</p>
