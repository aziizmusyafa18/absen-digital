-- =====================================================
-- Absen Digital - Database Setup
-- =====================================================

-- 1. Create Database
CREATE DATABASE IF NOT EXISTS absen_digital;
USE absen_digital;

-- 2. Tables will be created automatically by Sequelize
--    when you run: npm run seed

-- =====================================================
-- OR, if you want to create tables manually:
-- =====================================================

-- CREATE TABLE guru (
--     id INT AUTO_INCREMENT PRIMARY KEY,
--     username VARCHAR(50) UNIQUE NOT NULL,
--     password VARCHAR(255) NOT NULL,
--     nama VARCHAR(100) NOT NULL,
--     nip VARCHAR(50) UNIQUE NOT NULL,
--     mapel VARCHAR(100) NOT NULL,
--     jam_mulai TIME, -- Admin-set start time requirement
--     role ENUM('guru', 'admin') DEFAULT 'guru',
--     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
-- );

-- CREATE TABLE guru_kelas (
--     id INT AUTO_INCREMENT PRIMARY KEY,
--     guru_id INT NOT NULL,
--     kelas_id INT NOT NULL,
--     mata_pelajaran VARCHAR(100), -- Override mapel for this class
--     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
--     FOREIGN KEY (guru_id) REFERENCES guru(id) ON DELETE CASCADE,
--     FOREIGN KEY (kelas_id) REFERENCES kelas(id) ON DELETE CASCADE,
--     UNIQUE KEY unique_guru_kelas (guru_id, kelas_id)
-- );

-- CREATE TABLE orang_tua (
--     id INT AUTO_INCREMENT PRIMARY KEY,
--     username VARCHAR(50) UNIQUE NOT NULL,
--     password VARCHAR(255) NOT NULL,
--     nama VARCHAR(100) NOT NULL,
--     email VARCHAR(100) UNIQUE,
--     phone VARCHAR(20),
--     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
-- );

-- CREATE TABLE kelas (
--     id INT AUTO_INCREMENT PRIMARY KEY,
--     nama VARCHAR(50) UNIQUE NOT NULL,
--     tingkat VARCHAR(10) NOT NULL,
--     tahun_ajaran VARCHAR(20) NOT NULL,
--     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
-- );

-- CREATE TABLE siswa (
--     id INT AUTO_INCREMENT PRIMARY KEY,
--     nis VARCHAR(20) UNIQUE NOT NULL,
--     nama VARCHAR(100) NOT NULL,
--     email VARCHAR(100) UNIQUE,
--     phone VARCHAR(20),
--     kelas_id INT NOT NULL,
--     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
--     FOREIGN KEY (kelas_id) REFERENCES kelas(id) ON DELETE CASCADE
-- );

-- CREATE TABLE siswa_orang_tua (
--     id INT AUTO_INCREMENT PRIMARY KEY,
--     siswa_id INT NOT NULL,
--     orang_tua_id INT NOT NULL,
--     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--     FOREIGN KEY (siswa_id) REFERENCES siswa(id) ON DELETE CASCADE,
--     FOREIGN KEY (orang_tua_id) REFERENCES orang_tua(id) ON DELETE CASCADE,
--     UNIQUE KEY unique_siswa_ortu (siswa_id, orang_tua_id)
-- );

-- CREATE TABLE jurnal (
--     id INT AUTO_INCREMENT PRIMARY KEY,
--     guru_id INT NOT NULL,
--     kelas_id INT NOT NULL,
--     tanggal DATE NOT NULL,
--     jam_mulai TIME NOT NULL,
--     jam_selesai TIME NOT NULL,
--     mata_pelajaran VARCHAR(100) NOT NULL,
--     materi TEXT NOT NULL,
--     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
--     FOREIGN KEY (guru_id) REFERENCES guru(id) ON DELETE CASCADE,
--     FOREIGN KEY (kelas_id) REFERENCES kelas(id) ON DELETE CASCADE
-- );

-- CREATE TABLE absensi (
--     id INT AUTO_INCREMENT PRIMARY KEY,
--     jurnal_id INT NOT NULL,
--     siswa_id INT NOT NULL,
--     status ENUM('hadir', 'izin', 'tanpa_ket') NOT NULL DEFAULT 'hadir',
--     keterangan TEXT,
--     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
--     FOREIGN KEY (jurnal_id) REFERENCES jurnal(id) ON DELETE CASCADE,
--     FOREIGN KEY (siswa_id) REFERENCES siswa(id) ON DELETE CASCADE,
--     UNIQUE KEY unique_jurnal_siswa (jurnal_id, siswa_id)
-- );

-- =====================================================
-- Instructions:
-- =====================================================
-- 1. Run this file: mysql -u root -p < database-setup.sql
-- 2. Or copy-paste into MySQL Workbench/phpMyAdmin
-- 3. Then run: npm run seed (to populate demo data)
-- =====================================================
