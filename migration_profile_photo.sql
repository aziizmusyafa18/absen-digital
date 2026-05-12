-- =====================================================
-- Absen Digital - Migration Script: Profile Photo
-- Menambahkan kolom foto ke tabel guru, siswa, dan orang_tua
-- =====================================================

USE absen_digital;

-- Tambah kolom foto ke tabel guru
ALTER TABLE guru ADD COLUMN IF NOT EXISTS foto VARCHAR(255) NULL DEFAULT NULL;

-- Tambah kolom foto ke tabel siswa
ALTER TABLE siswa ADD COLUMN IF NOT EXISTS foto VARCHAR(255) NULL DEFAULT NULL;

-- Tambah kolom foto ke tabel orang_tua
ALTER TABLE orang_tua ADD COLUMN IF NOT EXISTS foto VARCHAR(255) NULL DEFAULT NULL;
