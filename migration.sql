-- =====================================================
-- Absen Digital - Database Migration Script
-- Untuk menambahkan fitur baru (jam_mulai dan guru_kelas)
-- =====================================================

USE absen_digital;

-- 1. Tambah kolom jam_mulai ke tabel guru (jika belum ada)
-- Kolom ini akan digunakan admin untuk mengatur jam mulai wajib guru
ALTER TABLE guru ADD COLUMN IF NOT EXISTS jam_mulai TIME NULL DEFAULT NULL COMMENT 'Jam mulai wajib yang ditetapkan admin';

-- 2. Buat tabel guru_kelas untuk relasi guru dengan kelas
-- Tabel ini digunakan untuk auto-fill mata pelajaran berdasarkan kelas
CREATE TABLE IF NOT EXISTS guru_kelas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    guru_id INT NOT NULL,
    kelas_id INT NOT NULL,
    mata_pelajaran VARCHAR(100) NULL DEFAULT NULL COMMENT 'Override mapel untuk kelas ini',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (guru_id) REFERENCES guru(id) ON DELETE CASCADE,
    FOREIGN KEY (kelas_id) REFERENCES kelas(id) ON DELETE CASCADE,
    UNIQUE KEY unique_guru_kelas (guru_id, kelas_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Contoh data relasi guru-kelas (jalankan sesuai kebutuhan)
-- INSERT INTO guru_kelas (guru_id, kelas_id, mata_pelajaran)
-- SELECT g.id, k.id, g.mapel
-- FROM guru g, kelas k
-- WHERE g.role = 'guru' AND k.id = 1;

-- =====================================================
-- Cara Penggunaan:
-- 1. Jalankan script ini: mysql -u root -p < migration.sql
-- 2. Atau copy-paste ke MySQL Workbench/phpMyAdmin
-- =====================================================
