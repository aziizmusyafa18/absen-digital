# Absen Digital - Sistem Absensi SMK

**Sistem Absensi Digital Modern Berbasis Web untuk Sekolah**

[Fitur](#fitur) • [Tech Stack](#tech-stack) • [Instalasi](#instalasi) • [Konfigurasi](#konfigurasi) • [Struktur Proyek](#struktur-proyek) • [Kontribusi](#kontribusi)

---

## 📝 Overview

**Absen Digital** adalah platform manajemen kehadiran siswa yang dirancang untuk mempermudah proses absensi di sekolah (SMK/SMA). Sistem ini menggabungkan kemudahan input data oleh guru dengan transparansi rekapitulasi bagi admin dan orang tua secara real-time.

### Highlights
* **Real-time Notifications** - Notifikasi absensi langsung via Socket.io.
* **Modern UI** - Antarmuka responsif menggunakan Bootstrap 5 dan CSS kustom.
* **Automated Recap** - Rekapitulasi harian dan bulanan otomatis dengan fitur export Excel.
* **Easy Import** - Migrasi data guru dan siswa dengan cepat melalui file Excel.
* **Secure Auth** - Autentikasi menggunakan JWT (JSON Web Token) dan enkripsi Bcrypt.

---

## ✨ Fitur

### 👨‍💼 Administrator
| Fitur | Deskripsi |
| :--- | :--- |
| **Dashboard** | Statistik kehadiran harian, total guru, dan aktivitas real-time |
| **Master Data** | Manajemen data Jurusan, Kelas, Siswa, dan Guru |
| **Import Excel** | Batch import data siswa dan guru dari file .xlsx |
| **Rekapitulasi** | Laporan kehadiran harian & bulanan per kelas/jurusan |
| **Export Laporan** | Cetak laporan rekapitulasi langsung ke format Excel |
| **Manajemen Akun** | Pengaturan profil admin dan ganti foto profil |

### 👨‍🏫 Guru
| Fitur | Deskripsi |
| :--- | :--- |
| **Input Absensi** | Melakukan absensi siswa per mata pelajaran |
| **Jurnal Harian** | Mencatat jurnal kegiatan belajar mengajar |
| **Input Nilai** | Manajemen nilai siswa untuk setiap kelas |
| **Dashboard Guru** | Ringkasan jadwal dan riwayat mengajar |
| **Edit Profil** | Personalisasi identitas dan foto profil guru |

### 👨‍👩‍👦 Orang Tua / Publik
| Fitur | Deskripsi |
| :--- | :--- |
| **Cek Kehadiran** | Pencarian status kehadiran siswa berdasarkan NIS/Nama |
| **Dashboard Ortu** | Melihat riwayat kehadiran anak secara real-time |

---

## 🛠️ Tech Stack

### Backend
| Teknologi | Deskripsi |
| :--- | :--- |
| **Node.js** | Runtime environment JavaScript |
| **Express.js** | Web framework untuk API |
| **Sequelize** | ORM untuk interaksi database MySQL |
| **Socket.io** | Komunikasi real-time dua arah |
| **JWT** | Mekanisme keamanan autentikasi |

### Frontend
| Teknologi | Deskripsi |
| :--- | :--- |
| **Bootstrap 5** | Framework CSS untuk desain responsif |
| **Vanilla JS** | Logika frontend tanpa framework berat |
| **Socket.io Client** | Penerima notifikasi real-time |

### Database
| Teknologi | Deskripsi |
| :--- | :--- |
| **MySQL** | Sistem manajemen database relasional |

---

## 🚀 Instalasi

### Prasyarat
* Node.js v18 atau lebih tinggi
* MySQL / MariaDB
* npm (Node Package Manager)

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
```

---

## 🔐 Sistem Keamanan
Aplikasi ini diimplementasikan dengan standar keamanan modern untuk melindungi data sensitif:
* **JWT (JSON Web Token)** - Autentikasi stateless untuk mengamankan API endpoint.
* **Bcrypt Hashing** - Semua password disimpan dalam format hash yang tidak dapat didekripsi.
* **Role-Based Access Control (RBAC)** - Pembatasan akses fitur berdasarkan peran (Admin, Guru, Orang Tua).
* **CORS Protection** - Membatasi permintaan API hanya dari domain yang diizinkan.
* **Input Validation & Sanitization** - Melindungi aplikasi dari serangan SQL Injection dan XSS.
* **Multer File Filter** - Validasi tipe file dan ukuran pada upload foto profil untuk mencegah eksekusi file berbahaya.

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
┌──────────────┐      ┌────────────┐
│     Guru     │      │    Siswa   │
├──────────────┤      ├────────────┤
│ id (PK)      │      │ id (PK)    │
│ user_id (FK) │      │ nis        │
│ nip          │      │ nama       │
│ nama         │      │ kelas_id   │─────┐
│ mapel        │      └────────────┘     │
└──────────────┘             │           │
       │                     │           │
       ▼                     ▼           ▼
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

| Role | Username / NIP | Password |
| :--- | :--- | :--- |
| **Admin** | `admin` | `admin123` |
| **Guru** | `123456` (Contoh NIP) | `password` |

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
