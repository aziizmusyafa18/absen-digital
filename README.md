# Absen Digital - Sistem Absensi SMK

Sistem absensi digital untuk SMK dengan fitur realtime notification ke Admin dan Orang Tua.

## Fitur Utama

### Guru
- Absen siswa per kelas
- Isi jurnal pembelajaran (mata pelajaran, materi, jam)
- Lihat riwayat absen yang sudah disubmit

### Admin
- **Dashboard**: Monitoring realtime semua absen dari guru
- **Master Data**: Kelola data Jurusan, Kelas, Siswa, dan Guru (CRUD)
- **Import Data**: Import data siswa dan guru via Excel
- **Rekap Absensi**:
  - Rekap harian per kelas
  - Rekap bulanan per siswa
  - Export ke Excel dan PDF

### Orang Tua
- Lihat daftar anak yang terdaftar
- Statistik kehadiran bulanan (Hadir/Izin/Alpha)
- Riwayat kehadiran detail per tanggal
- Notifikasi realtime saat anak diabsen

### Fitur Umum
- Realtime notification dengan Socket.io
- Responsive design untuk semua perangkat
- Sidebar yang bisa di-toggle (show/hide)
- Export laporan ke Excel dan PDF

## Teknologi

- **Backend**: Node.js + Express.js
- **Database**: MySQL + Sequelize ORM
- **Realtime**: Socket.io
- **Authentication**: JWT
- **Frontend**: HTML + CSS + JavaScript + Bootstrap 5
- **Export**: xlsx (Excel), pdfkit (PDF)

## Cara Install

### 1. Clone/Download Project
```bash
cd absen-digital
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Setup Database MySQL
Buat database baru dan update credentials di file `.env`:

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=absen_digital
JWT_SECRET=your_secret_key
PORT=3000
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

## Login Credentials (Demo)

### Admin
- Username: `admin`
- Password: `admin123`

### Guru
- Username: `sari` | `budi` | `ani`
- Password: `guru123`

### Orang Tua
- Username: `ortu_ahmad` | `ortu_budi` | `ortu_citra`
- Password: `ortu123`

## Panduan Penggunaan

### Untuk Guru

1. Login dengan credentials guru
2. Pilih kelas dari dropdown
3. Set status hadir/izin/tanpa keterangan untuk setiap siswa
4. Isi jurnal pembelajaran (mata pelajaran, materi, jam)
5. Submit - notifikasi akan terkirim ke Admin dan Orang Tua

### Untuk Admin

#### Dashboard
- Melihat statistik absen hari ini
- Monitoring realtime absen dari semua guru
- Filter berdasarkan tanggal/kelas/guru

#### Master Data
- **Jurusan**: Tambah, edit, hapus jurusan
- **Kelas**: Tambah, edit, hapus kelas (terhubung ke jurusan)
- **Siswa**: Tambah, edit, hapus siswa + import Excel
- **Guru**: Tambah, edit, hapus guru + import Excel

#### Rekap Absensi
- **Rekap Harian**: Lihat absensi per tanggal, filter by jurusan/kelas
- **Rekap Bulanan**: Lihat rekap per bulan per siswa
- **Export**: Download laporan dalam format Excel atau PDF

### Untuk Orang Tua

1. Login dengan credentials orang tua
2. Lihat daftar anak yang terdaftar
3. Klik "Lihat Detail" untuk melihat:
   - Statistik kehadiran bulan ini
   - Riwayat kehadiran detail
4. Terima notifikasi realtime saat anak diabsen

## Struktur Project

```
absen-digital/
├── backend/
│   ├── config/
│   │   └── database.js
│   ├── models/
│   │   ├── Guru.js
│   │   ├── Jurusan.js
│   │   ├── Kelas.js
│   │   ├── Siswa.js
│   │   ├── OrangTua.js
│   │   ├── Jurnal.js
│   │   ├── Absensi.js
│   │   └── index.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── guru.js
│   │   ├── admin.js
│   │   ├── adminCrud.js
│   │   ├── import.js
│   │   ├── rekap.js
│   │   └── orangTua.js
│   ├── middleware/
│   │   └── auth.js
│   ├── socket/
│   │   └── socketHandler.js
│   ├── app.js
│   ├── server.js
│   └── seed.js
│
├── frontend/public/
│   ├── index.html
│   ├── guru.html
│   ├── admin.html
│   ├── admin-master-data.html
│   ├── admin-rekap.html
│   └── ortu.html
│
├── .env
├── .gitignore
├── package.json
└── README.md
```

## API Endpoints

### Authentication
- `POST /api/auth/login/guru` - Login Guru/Admin
- `POST /api/auth/login/orang-tua` - Login Orang Tua

### Guru
- `GET /api/guru/kelas` - Get semua kelas
- `GET /api/guru/kelas/:kelasId/siswa` - Get siswa dalam kelas
- `POST /api/guru/absen` - Submit absen + jurnal
- `GET /api/guru/riwayat` - Get riwayat absen guru

### Admin Dashboard
- `GET /api/admin/dashboard` - Dashboard overview
- `GET /api/admin/jurnal` - Get semua jurnal (with filters)

### Master Data
- `GET/POST/PUT/DELETE /api/master-data/jurusan` - CRUD Jurusan
- `GET/POST/PUT/DELETE /api/master-data/kelas` - CRUD Kelas
- `GET/POST/PUT/DELETE /api/master-data/siswa` - CRUD Siswa
- `GET/POST/PUT/DELETE /api/master-data/guru` - CRUD Guru

### Import
- `POST /api/import/siswa` - Import siswa dari Excel
- `POST /api/import/guru` - Import guru dari Excel

### Rekap
- `GET /api/rekap/harian` - Rekap absensi harian
- `GET /api/rekap/bulanan` - Rekap absensi bulanan
- `GET /api/rekap/export/harian/excel` - Export harian ke Excel
- `GET /api/rekap/export/harian/pdf` - Export harian ke PDF
- `GET /api/rekap/export/bulanan/excel` - Export bulanan ke Excel
- `GET /api/rekap/export/bulanan/pdf` - Export bulanan ke PDF

### Orang Tua
- `GET /api/orang-tua/anak` - Get daftar anak
- `GET /api/orang-tua/anak/:siswaId/riwayat` - Get riwayat kehadiran
- `GET /api/orang-tua/anak/:siswaId/statistik` - Get statistik kehadiran

## Realtime Events (Socket.io)

### Client ke Server
- `join-role` - Join room berdasarkan role
- `join-student` - Join room spesifik siswa (untuk ortu)

### Server ke Client
- `new-absen` - Notify admin saat ada absen baru
- `new-absen-all` - Notify semua user

## Database Schema

### Tables
- **jurusan** - Data jurusan/program keahlian
- **kelas** - Data kelas (terhubung ke jurusan)
- **guru** - Data guru dan admin
- **siswa** - Data siswa (terhubung ke kelas)
- **orang_tua** - Data orang tua
- **jurnal** - Jurnal pembelajaran guru
- **absensi** - Data absensi siswa
- **SiswaOrangTua** - Relasi siswa-orang tua (many-to-many)

### Relationships
- Jurusan -> Kelas (1:N)
- Kelas -> Siswa (1:N)
- Siswa <-> OrangTua (N:N)
- Guru -> Jurnal (1:N)
- Kelas -> Jurnal (1:N)
- Jurnal -> Absensi (1:N)
- Siswa -> Absensi (1:N)

## Security Features

- Password hashing dengan bcrypt
- JWT authentication
- Role-based access control
- CORS enabled
- Input validation
- SQL injection protection (Sequelize ORM)

## Troubleshooting

### Error: "Access denied to database"
- Cek credentials MySQL di `.env`
- Pastikan MySQL service sudah berjalan
- Pastikan database sudah dibuat

### Socket.io tidak connect
- Pastikan server sudah berjalan
- Cek browser console untuk error
- Pastikan CORS sudah enabled

### Data tidak muncul
- Jalankan `npm run seed` untuk populate data demo
- Cek console server untuk debugging
- Pastikan token JWT valid

## Deployment

### Development
```bash
npm run dev
```

### Production
```bash
npm start
```

### Environment Variables
```env
NODE_ENV=production
JWT_SECRET=your-super-secure-secret
DB_HOST=your-db-host
DB_USER=your-db-user
DB_PASSWORD=your-db-password
DB_NAME=your-db-name
PORT=3000
```

## Lisensi

MIT License - Free to use for educational purposes
