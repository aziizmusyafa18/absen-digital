# 🎓 Absen Digital - Sistem Absensi SMK

Sistem absensi digital untuk SMK dengan fitur realtime notification ke Admin dan Orang Tua.

## ✨ Fitur Utama

- 👨‍🏫 **Guru**: Absen siswa per kelas + isi jurnal pembelajaran
- 👨‍💼 **Admin**:
  - Monitoring realtime semua absen dari guru
  - **Master Data**: Kelola data Guru, Siswa, dan Kelas (CRUD)
- 👨‍👩‍👧‍👦 **Orang Tua**: Lihat riwayat absen anak realtime
- ⚡ **Realtime**: Socket.io untuk notifikasi instan
- 📊 **Laporan**: Export data untuk admin

## 🛠 Teknologi

- **Backend**: Node.js + Express.js
- **Database**: MySQL + Sequelize ORM
- **Realtime**: Socket.io
- **Authentication**: JWT
- **Frontend**: HTML + CSS + JavaScript (Vanilla)
- **Password Hash**: bcrypt

## 🚀 Cara Install

### 1. Clone/Download Project
```bash
cd absen-digital
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Setup Database MySQL
- Buat database baru: `absen_digital`
- Update credentials di file `.env`

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=absen_digital
```

### 4. Seed Database (Data Demo)
```bash
npm run seed
```

### 5. Jalankan Server
```bash
# Development mode (auto-restart)
npm run dev

# Production mode
npm start
```

Server akan berjalan di: **http://localhost:3000**

## 🔑 Login Credentials (Demo)

### Admin
- Username: `admin`
- Password: `admin123`

### Guru
- Username: `sari` | `budi` | `ani`
- Password: `guru123`

### Orang Tua
- Username: `ortu_ahmad` | `ortu_budi` | `ortu_citra`
- Password: `ortu123`

## 📋 Cara Penggunaan

### 🎯 Untuk Guru

1. **Login** dengan credentials guru
2. **Pilih Kelas** dari dropdown
3. **Lihat daftar siswa** yang muncul
4. **Set status** hadir/izin/tanpa keterangan untuk setiap siswa
5. **Isi Jurnal Pembelajaran**:
   - Mata Pelajaran
   - Materi yang disampaikan
   - Jam mulai & selesai
6. **Submit** - Sistem akan:
   - Simpan ke database
   - Kirim notifikasi realtime ke Admin
   - Kirim notifikasi ke Orang Tua

### 👨‍💼 Untuk Admin

1. **Login** dengan credentials admin
2. **Dashboard menampilkan**:
   - Total absen hari ini
   - Total siswa hadir
   - Tabel realtime semua absen
3. **Notifikasi realtime** saat guru submit absen
4. **Filter data** berdasarkan tanggal/kelas/guru

#### 🔧 Master Data Admin

1. **Klik "Master Data"** di dashboard
2. **Kelola Data Guru**:
   - ➕ Tambah guru baru
   - ✏️ Edit data guru
   - 🗑️ Hapus guru
   - Search by nama/NIP
3. **Kelola Data Siswa**:
   - ➕ Tambah siswa per kelas
   - ✏️ Edit data siswa
   - 🗑️ Hapus siswa
   - Search by nama/NIS
4. **Kelola Data Kelas**:
   - ➕ Tambah kelas baru
   - ✏️ Edit data kelas
   - 🗑️ Hapus kelas
   - Search by nama/tingkat

### 👨‍👩‍👧‍👦 Untuk Orang Tua

1. **Login** dengan credentials ortu
2. **Lihat daftar anak** yang diasuh
3. **Klik "Lihat Riwayat"** untuk melihat:
   - Statistik kehadiran bulan ini (Hadir/Izin/Alpha)
   - Riwayat detail per tanggal
4. **Notifikasi realtime** saat anak absen

## 🏗 Struktur Project

```
absen-digital/
├── backend/
│   ├── config/
│   │   └── database.js          # Koneksi MySQL
│   ├── models/
│   │   ├── Guru.js              # Model Guru
│   │   ├── Kelas.js             # Model Kelas
│   │   ├── Siswa.js             # Model Siswa
│   │   ├── OrangTua.js          # Model Orang Tua
│   │   ├── Jurnal.js            # Model Jurnal
│   │   ├── Absensi.js           # Model Absensi
│   │   └── index.js             # Associations
│   ├── routes/
│   │   ├── auth.js              # Authentication
│   │   ├── guru.js              # API Guru (absen, jurnal)
│   │   ├── admin.js             # API Admin
│   │   └── orangTua.js          # API Orang Tua
│   ├── middleware/
│   │   └── auth.js              # JWT Middleware
│   ├── socket/
│   │   └── socketHandler.js     # Socket.io setup
│   ├── app.js                   # Express app
│   ├── server.js                # HTTP + Socket.io server
│   └── seed.js                  # Database seeder
│
├── frontend/public/
│   ├── index.html               # Login page
│   ├── guru.html                # Dashboard Guru
│   ├── admin.html               # Dashboard Admin
│   ├── admin-master-data.html   # Master Data Admin (CRUD)
│   ├── ortu.html                # Dashboard Orang Tua
│   └── css/
│       └── style.css            # Stylesheet
│
├── .env                         # Environment variables
├── package.json
└── README.md
```

## 📡 API Endpoints

### Authentication
- `POST /api/auth/login/guru` - Login Guru/Admin
- `POST /api/auth/login/orang-tua` - Login Orang Tua

### Guru
- `GET /api/guru/kelas` - Get all kelas
- `GET /api/guru/kelas/:kelasId/siswa` - Get siswa in kelas
- `POST /api/guru/absen` - Submit absen + jurnal
- `GET /api/guru/riwayat` - Get riwayat absen guru

### Admin
- `GET /api/admin/dashboard` - Dashboard overview
- `GET /api/admin/jurnal` - Get all jurnal (with filters)
- `GET /api/admin/export` - Export laporan
- `GET /api/admin/guru` - Get all guru
- `GET /api/admin/siswa` - Get all siswa

### Admin Master Data (CRUD)
#### Guru
- `GET /api/master-data/guru/all` - Get all guru
- `GET /api/master-data/guru/:id` - Get single guru
- `POST /api/master-data/guru` - Create new guru
- `PUT /api/master-data/guru/:id` - Update guru
- `DELETE /api/master-data/guru/:id` - Delete guru

#### Siswa
- `GET /api/master-data/siswa/all` - Get all siswa with kelas
- `GET /api/master-data/siswa/:id` - Get single siswa
- `POST /api/master-data/siswa` - Create new siswa
- `PUT /api/master-data/siswa/:id` - Update siswa
- `DELETE /api/master-data/siswa/:id` - Delete siswa

#### Kelas
- `GET /api/master-data/kelas/all` - Get all kelas
- `POST /api/master-data/kelas` - Create new kelas
- `PUT /api/master-data/kelas/:id` - Update kelas
- `DELETE /api/master-data/kelas/:id` - Delete kelas

### Orang Tua
- `GET /api/orang-tua/anak` - Get children
- `GET /api/orang-tua/anak/:siswaId/riwayat` - Get riwayat
- `GET /api/orang-tua/anak/:siswaId/statistik` - Get statistik

## 🔄 Realtime Events (Socket.io)

### Client → Server
- `join-role` - Join room berdasarkan role (admin/guru/orang_tua)
- `join-student` - Join room spesifik student (untuk ortu)

### Server → Client
- `new-absen` - Notify admin saat ada absen baru
- `new-absen-all` - Notify semua ortu

## 🗃 Database Schema

### Tables
- **guru** - Data guru/admin
- **orang_tua** - Data orang tua
- **kelas** - Data kelas
- **siswa** - Data siswa
- **jurnal** - Jurnal pembelajaran
- **absensi** - Data absensi siswa
- **SiswaOrangTua** - Junction table (many-to-many)

### → Siswa Relationships
- Kelas (1:N)
- Siswa ↔ OrangTua (N:N)
- Guru → Jurnal (1:N)
- Kelas → Jurnal (1:N)
- Jurnal → Absensi (1:N)
- Siswa → Absensi (1:N)

## 🔒 Security Features

- ✅ Password hashing dengan bcrypt
- ✅ JWT authentication
- ✅ Role-based access control
- ✅ CORS enabled
- ✅ Input validation
- ✅ SQL injection protection (Sequelize ORM)

## 🎨 UI/UX Features

- Responsive design (mobile-friendly)
- Modern gradient UI
- Realtime notifications
- Tab-based login (Guru/Admin vs Orang Tua)
- Color-coded status (hijau=hadir, orange=izin, merah=alpha)

## 🐛 Troubleshooting

### Error: "Access denied to database"
- Cek credentials MySQL di `.env`
- Pastikan MySQL service sudah berjalan
- Pastikan database `absen_digital` sudah dibuat

### Socket.io tidak connect
- Pastikan server sudah berjalan di port 3000
- Cek browser console untuk error
- Pastikan CORS sudah enabled

### Data tidak muncul
- Jalankan `npm run seed` untuk populate data
- Cek console.log di server untuk debugging
- Pastikan token JWT valid

## 🚀 Deployment

### Development
```bash
npm run dev
```

### Production
```bash
npm start
```

### Environment Variables Production
```env
NODE_ENV=production
JWT_SECRET=your-super-secure-secret
DB_HOST=your-db-host
DB_USER=your-db-user
DB_PASSWORD=your-db-password
DB_NAME=your-db-name
PORT=3000
```

## 📝 Lisensi

MIT License - Free to use for educational purposes

## 👨‍💻 Developer

Made with ❤️ for SMK Indonesia

---

**Selamat menggunakan Absen Digital! 🎓**
