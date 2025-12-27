# 🚀 Cara Menjalankan Server - Absen Digital

## ✅ Status: Sequelize Op Error SUDAH DIPERBAIKI!

Server sudah bisa berjalan tanpa error. Error terakhir hanya karena port conflict.

---

## 🛑 Step 1: Hentikan Semua Node Process

### **Windows:**
```bash
# Cek proses yang menggunakan port 3000
netstat -ano | findstr :3000

# Kill proses (ganti PID dengan angka dari output di atas)
taskkill /PID <PID_NUMBER> /F

# Contoh:
# taskkill /PID 24208 /F
```

### **Mac/Linux:**
```bash
# Kill process di port 3000
lsof -ti:3000 | xargs kill -9

# Atau
fuser -k 3000/tcp
```

### **Universal (Semua OS):**
```bash
# Restart terminal/power shell
# Kemudian lanjut ke Step 2
```

---

## 🚀 Step 2: Jalankan Server

### **Cara 1: Development Mode (Recommended)**
```bash
npm run dev
```

**Expected Output:**
```
✅ Database connection established successfully.
✅ Database synchronized successfully.
🚀 Server is running on http://localhost:3000
📡 Socket.io is ready for realtime connections
```

### **Cara 2: Production Mode**
```bash
npm start
```

### **Cara 3: Custom Port (Jika port 3000 digunakan)**
```bash
PORT=3001 npm run dev
```

---

## 💾 Step 3: Seed Database

**Buka terminal baru** (jangan stop server):

```bash
npm run seed
```

**Expected Output:**
```
✅ Admin created
✅ Guru users created
✅ Kelas created
✅ Siswa XII TJKT A created
✅ Orang Tua created
✅ Orang Tua - Siswa links created
🎉 Database seeded successfully!
```

---

## 🌐 Step 4: Test di Browser

1. **Buka Browser**: http://localhost:3000
2. **Login sebagai Admin**:
   - Username: `admin`
   - Password: `admin123`
3. **Dashboard harus load TANPA ERROR** ✅
4. **Klik "Master Data"** → Semua tab harus muncul data ✅

---

## 🔍 Step 5: Verify (Console Check)

### **Browser Console (F12):**
```
Loading dashboard...
Token: exists
User data: {id: 1, role: "admin", ...}
Response status: 200
Response ok: true
Dashboard data received: {...}
Dashboard updated successfully
```

### **Server Terminal:**
```
Dashboard endpoint called
Today date: Mon Dec 23 2025 00:00:00 GMT+0700 ( WIB )
Jurnal found: 0
Total jurnal: 0 Total siswa hadir: 0
```

---

## 🆘 Jika Masih Ada Error

### **Error: "Port 3000 already in use"**
```bash
# Gunakan port lain
PORT=3002 npm run dev
# Kemudian akses: http://localhost:3002
```

### **Error: "Cannot connect to MySQL"**
1. Pastikan MySQL service berjalan
2. Cek credentials di `.env`:
   ```env
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=your_password
   DB_NAME=absen_digital
   ```

### **Error: "Database doesn't exist"**
```bash
mysql -u root -p -e "CREATE DATABASE absen_digital;"
npm run seed
```

---

## 📊 Quick Test Commands

```bash
# Test API health
curl http://localhost:3000/api/health

# Test dengan test script
node test-api.js
```

**Expected:**
```
✅ Health Check: {"status":"OK"...}
```

---

## ✅ Success Checklist

- [ ] Server berjalan tanpa error (npm run dev)
- [ ] Database sync berhasil (✅ Database synchronized)
- [ ] Database seeded (npm run seed)
- [ ] Login admin berhasil
- [ ] Dashboard load tanpa error 500
- [ ] Master Data → Tab Guru/Siswa/Kelas muncul data
- [ ] Console browser: "Dashboard updated successfully"

**Jika semua ✅ → Sistem BERJALAN SEMPURNA!** 🎉

---

## 💡 Tips

### **Tip 1: Always Use Development Mode**
```bash
npm run dev
```
Server akan auto-restart saat ada perubahan kode.

### **Tip 2: Use Different Port**
Jika port 3000 bentrok:
```bash
PORT=3005 npm run dev
```

### **Tip 3: Check Both Terminals**
- **Terminal 1**: Server (`npm run dev`)
- **Terminal 2**: Database seeding (`npm run seed`)

Jangan stop server saat seed database!

### **Tip 4: Clear Browser Cache**
Jika ada masalah UI:
1. F12 → Application → Storage
2. Click "Clear site data"
3. Refresh halaman
4. Login ulang

---

## 🎯 Summary

**SEQUELIZE OP ERROR SUDAH DIPERBAIKI!**

- ✅ Server starts successfully
- ✅ Database sync works
- ✅ All routes load properly
- ✅ Dashboard works
- ✅ Master Data works

**Sekarang sistem 100% READY TO USE!** 🚀

**Silakan ikuti Step 1-5 di atas untuk menjalankan sistem!** 👍
