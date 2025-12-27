# 🔧 Troubleshooting Guide - Absen Digital

## Problem: Data Kelas/Guru/Siswa Tidak Muncul di Master Data

### ✅ Solutions

#### **Step 1: Pastikan Server Berjalan**
```bash
# Jalankan server
npm run dev

# Terminal harus menampilkan:
# ✅ Database connection established successfully
# ✅ Database synchronized successfully
# 🚀 Server is running on http://localhost:3000
```

#### **Step 2: Seed Database**
```bash
# Pastikan database terisi dengan data demo
npm run seed

# Terminal harus menampilkan:
# ✅ Admin created
# ✅ Guru users created
# ✅ Kelas created
# ✅ Siswa XII TJKT A created
# ✅ Orang Tua created
# 🎉 Database seeded successfully!
```

#### **Step 3: Login dengan Credentials yang Benar**
- **URL**: http://localhost:3000
- **Username**: `admin`
- **Password**: `admin123`

#### **Step 4: Cek Console Browser**
1. Tekan **F12** untuk buka Developer Tools
2. Pergi ke tab **Console**
3. Klik **"Master Data"**
4. Lihat console logs seperti:
   ```
   =======================================
   Page loaded, initializing...
   Token exists: true
   User role: admin
   =======================================
   Loading kelas data...
   Fetching from /api/admin/kelas/all
   Response status: 200
   Kelas data received: [...]
   ```

---

## 🚨 Common Errors & Fixes

### **Error 1: "Error loading kelas: Failed to load kelas"**

**Cause**: Server belum berjalan atau API endpoint tidak tersedia

**Fix**:
```bash
# Pastikan server sudah jalan
npm run dev

# Test endpoint secara manual
curl http://localhost:3000/api/admin/kelas/all -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### **Error 2: "Table body element not found!"**

**Cause**: HTML element tidak ter-render dengan benar

**Fix**:
- Refresh halaman (F5)
- Pastikan tidak ada error JavaScript di console
- Coba换一个 browser

### **Error 3: "Belum ada data kelas"**

**Cause**: Database kosong atau belum di-seed

**Fix**:
```bash
# Hapus database lama
mysql -u root -p -e "DROP DATABASE IF EXISTS absen_digital;"

# Buat database baru
mysql -u root -p -e "CREATE DATABASE absen_digital;"

# Seed ulang
npm run seed
```

### **Error 4: "Unauthorized" atau "Access denied"**

**Cause**: Token JWT expired atau tidak valid

**Fix**:
1. Logout dari aplikasi
2. Login ulang
3. Pastikan role adalah "admin"

### **Error 5: "Cannot read property of undefined"**

**Cause**: JavaScript error atau data structure mismatch

**Fix**:
1. Buka console browser (F12)
2. Lihat error message
3. Pastikan database sudah di-seed dengan benar
4. Restart server (`npm run dev`)

---

## 🔍 Debugging Steps

### **Step 1: Check Server Logs**
Server terminal harus menampilkan:
```
✅ Database connection established successfully.
✅ Database synchronized successfully.
🚀 Server is running on http://localhost:3000
📡 Socket.io is ready for realtime connections
```

### **Step 2: Test API Endpoints**

Gunakan browser atau Postman:

```bash
# Test health check
curl http://localhost:3000/api/health

# Test kelas endpoint (butuh token)
# 1. Login dulu di browser
# 2. Copy token dari localStorage
# 3. Test endpoint
curl http://localhost:3000/api/admin/kelas/all \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### **Step 3: Check Browser Console**

Buka http://localhost:3000 → F12 → Console

Logs yang harus muncul:
```
=======================================
Page loaded, initializing...
Token exists: true
User role: admin
=======================================
Loading guru data...
Fetching from /api/admin/guru/all
Response status: 200
Guru data received: [...]
Guru displayed successfully

Loading siswa data...
Fetching from /api/admin/siswa/all
Response status: 200
Siswa data received: [...]
Siswa displayed successfully

Loading kelas data...
Fetching from /api/admin/kelas/all
Response status: 200
Kelas data received: [...]
Kelas displayed successfully

Reloading data after delay...
```

### **Step 4: Verify Database**

Login MySQL dan cek data:

```sql
USE absen_digital;

-- Cek tabel ada
SHOW TABLES;

-- Cek data guru
SELECT id, username, nama, role FROM guru;

-- Cek data kelas
SELECT * FROM kelas;

-- Cek data siswa
SELECT s.id, s.nis, s.nama, k.nama as kelas
FROM siswa s
JOIN kelas k ON s.kelas_id = k.id;
```

---

## 💡 Tips

### **Tip 1: Gunakan Test Script**
```bash
node test-api.js
```
Script ini akan cek apakah server berjalan dengan benar.

### **Tip 2: Hard Refresh Browser**
- **Windows/Linux**: Ctrl + Shift + R
- **Mac**: Cmd + Shift + R
- Atau tekan F5 beberapa kali

### **Tip 3: Clear Browser Data**
1. F12 → Application → Storage
2. Klik "Clear site data"
3. Refresh halaman
4. Login ulang

### **Tip 4: Check Network Tab**
1. F12 → Network tab
2. Klik "Master Data"
3. Lihat request ke `/api/admin/kelas/all`
4. Pastikan status 200 (OK)

---

## 🆘 Still Not Working?

Jika masih bermasalah, coba:

1. **Restart Everything**:
   ```bash
   # Stop server (Ctrl+C)
   # Hapus node_modules
   rm -rf node_modules
   # Install ulang
   npm install
   # Jalankan
   npm run dev
   ```

2. **Check MySQL**:
   ```bash
   # Pastikan MySQL service berjalan
   # Windows: cek Services.msc
   # Mac: brew services list | grep mysql
   # Linux: sudo systemctl status mysql
   ```

3. **Check Port**:
   Pastikan port 3000 tidak digunakan process lain:
   ```bash
   # Windows
   netstat -ano | findstr :3000

   # Mac/Linux
   lsof -i :3000
   ```

4. **Check .env File**:
   Pastikan `.env` sudah benar:
   ```env
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=your_password
   DB_NAME=absen_digital
   JWT_SECRET=your-secret-key
   PORT=3000
   ```

---

## 📞 Quick Checklist

- [ ] Server berjalan (`npm run dev`)
- [ ] Database di-seed (`npm run seed`)
- [ ] Login sebagai admin
- [ ] Klik "Master Data"
- [ ] F12 → Console tidak ada error merah
- [ ] Tab "Guru" menampilkan data
- [ ] Tab "Siswa" menampilkan data
- [ ] Tab "Kelas" menampilkan data

**Jika semua checklist ✅ tapi data masih tidak muncul, berarti ada bug di kode. Laporkan dengan screenshot console browser.**
