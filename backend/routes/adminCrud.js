const express = require('express');
const bcrypt = require('bcrypt');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authMiddleware, adminOnly } = require('../middleware/auth');
const { Guru, Kelas, Siswa, Jurnal, Absensi, GuruKelas, Jurusan, sequelize } = require('../models');
const { Op } = require('sequelize');
const router = express.Router();

// Configure multer for photos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/profiles');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'profile-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Hanya file gambar yang diizinkan'), false);
    }
  },
  limits: { fileSize: 2 * 1024 * 1024 }
});

// ========================================
// CRUD JURUSAN
// ========================================

// Get all jurusan
router.get('/jurusan/all', authMiddleware, adminOnly, async (req, res) => {
  try {
    const jurusan = await Jurusan.findAll({
      order: [['nama', 'ASC']]
    });
    res.json(jurusan);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single Jurusan
router.get('/jurusan/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const jurusan = await Jurusan.findByPk(req.params.id);
    if (!jurusan) {
      return res.status(404).json({ error: 'Jurusan tidak ditemukan' });
    }
    res.json(jurusan);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create Jurusan
router.post('/jurusan', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { nama, singkatan, deskripsi } = req.body;

    // Check if nama already exists
    const existing = await Jurusan.findOne({ where: { nama } });
    if (existing) {
      return res.status(400).json({ error: 'Jurusan dengan nama ini sudah ada' });
    }

    const jurusan = await Jurusan.create({
      nama,
      singkatan: singkatan || null,
      deskripsi: deskripsi || null
    });

    res.status(201).json({
      success: true,
      message: 'Jurusan berhasil ditambahkan',
      data: jurusan
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update Jurusan
router.put('/jurusan/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { nama, singkatan, deskripsi } = req.body;
    const jurusan = await Jurusan.findByPk(req.params.id);

    if (!jurusan) {
      return res.status(404).json({ error: 'Jurusan tidak ditemukan' });
    }

    // Check if nama already exists (exclude self)
    if (nama && nama !== jurusan.nama) {
      const existing = await Jurusan.findOne({ where: { nama } });
      if (existing) {
        return res.status(400).json({ error: 'Jurusan dengan nama ini sudah ada' });
      }
    }

    await jurusan.update({
      nama: nama || jurusan.nama,
      singkatan: singkatan !== undefined ? singkatan : jurusan.singkatan,
      deskripsi: deskripsi !== undefined ? deskripsi : jurusan.deskripsi
    });

    res.json({
      success: true,
      message: 'Jurusan berhasil diupdate',
      data: jurusan
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete Jurusan
router.delete('/jurusan/:id', authMiddleware, adminOnly, async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const jurusan = await Jurusan.findByPk(req.params.id);

    if (!jurusan) {
      await t.rollback();
      return res.status(404).json({ error: 'Jurusan tidak ditemukan' });
    }

    // Set kelas.jurusan_id to NULL for kelas under this jurusan
    await Kelas.update({ jurusan_id: null }, {
      where: { jurusan_id: req.params.id },
      transaction: t
    });

    await jurusan.destroy({ transaction: t });
    await t.commit();

    res.json({
      success: true,
      message: 'Jurusan berhasil dihapus'
    });
  } catch (error) {
    await t.rollback();
    res.status(500).json({ error: error.message });
  }
});


// ========================================
// CRUD GURU
// ========================================

// Get all guru
router.get('/guru/all', authMiddleware, adminOnly, async (req, res) => {
  try {
    const guru = await Guru.findAll({
      attributes: { exclude: ['password'] },
      order: [['nama', 'ASC']]
    });
    res.json(guru);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single guru
router.get('/guru/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const guru = await Guru.findByPk(id, {
      attributes: { exclude: ['password'] }
    });

    if (!guru) {
      return res.status(404).json({ error: 'Guru not found' });
    }

    res.json(guru);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new guru
router.post('/guru', authMiddleware, adminOnly, upload.single('foto'), async (req, res) => {
  try {
    const { username, password, nama, nip, mapel, jam_mulai, role = 'guru' } = req.body;

    // Check if username or nip already exists
    const existingGuru = await Guru.findOne({
      where: {
        [Op.or]: [
          { username },
          { nip }
        ]
      }
    });

    if (existingGuru) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(400).json({
        error: 'Username atau NIP sudah digunakan'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    const createData = {
      username,
      password: hashedPassword,
      nama,
      nip,
      mapel,
      jam_mulai: jam_mulai || null,
      role
    };

    if (req.file) {
      createData.foto = 'uploads/profiles/' + req.file.filename;
    }

    // Create guru
    const guru = await Guru.create(createData);

    // Return without password
    const { password: _, ...guruWithoutPassword } = guru.toJSON();

    res.status(201).json({
      success: true,
      message: 'Guru berhasil ditambahkan',
      data: guruWithoutPassword
    });
  } catch (error) {
    if (req.file) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: error.message });
  }
});

// Update guru
router.put('/guru/:id', authMiddleware, adminOnly, upload.single('foto'), async (req, res) => {
  try {
    const { id } = req.params;
    const { username, password, nama, nip, mapel, jam_mulai, role } = req.body;

    const guru = await Guru.findByPk(id);

    if (!guru) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(404).json({ error: 'Guru not found' });
    }

    // Check if username or nip already exists (exclude current guru)
    if (username || nip) {
      const existingGuru = await Guru.findOne({
        where: {
          [Op.or]: [
            { username },
            { nip }
          ],
          id: { [Op.ne]: id }
        }
      });

      if (existingGuru) {
        if (req.file) fs.unlinkSync(req.file.path);
        return res.status(400).json({
          error: 'Username atau NIP sudah digunakan oleh guru lain'
        });
      }
    }

    // Prepare update data
    const updateData = {};
    if (username) updateData.username = username;
    if (nama) updateData.nama = nama;
    if (nip) updateData.nip = nip;
    if (mapel) updateData.mapel = mapel;
    if (jam_mulai !== undefined) updateData.jam_mulai = jam_mulai || null;
    if (role) updateData.role = role;
    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
    }

    if (req.file) {
      // Delete old photo if exists
      if (guru.foto) {
        const oldPath = path.join(__dirname, '..', guru.foto);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
      updateData.foto = 'uploads/profiles/' + req.file.filename;
    }

    // Update guru
    await guru.update(updateData);

    // Return without password
    const { password: _, ...guruWithoutPassword } = guru.toJSON();

    res.json({
      success: true,
      message: 'Guru berhasil diupdate',
      data: guruWithoutPassword
    });
  } catch (error) {
    if (req.file) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: error.message });
  }
});

// Delete guru
router.delete('/guru/:id', authMiddleware, adminOnly, async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const { id } = req.params;

    const guru = await Guru.findByPk(id);

    if (!guru) {
      await t.rollback();
      return res.status(404).json({ error: 'Guru not found' });
    }

    // Check if guru has jurnal records
    const jurnalCount = await Jurnal.count({
      where: { guru_id: id }
    });

    if (jurnalCount > 0) {
      await t.rollback();
      return res.status(400).json({
        error: 'Tidak dapat menghapus guru yang sudah memiliki jurnal pembelajaran'
      });
    }

    // Delete photo if exists
    if (guru.foto) {
      const photoPath = path.join(__dirname, '..', guru.foto);
      if (fs.existsSync(photoPath)) fs.unlinkSync(photoPath);
    }

    // Delete guru
    await guru.destroy({ transaction: t });
    await t.commit();

    res.json({
      success: true,
      message: 'Guru berhasil dihapus'
    });
  } catch (error) {
    await t.rollback();
    res.status(500).json({ error: error.message });
  }
});

// Sync kelas yang diajar oleh guru
router.post('/guru/sync-kelas/:id', authMiddleware, adminOnly, async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const guruId = parseInt(id);
    const { kelas_list } = req.body; // Array of { kelas_id, mata_pelajaran }

    const guru = await Guru.findByPk(guruId);
    if (!guru) {
      await t.rollback();
      return res.status(404).json({ error: 'Guru not found' });
    }

    // Delete existing relations
    await GuruKelas.destroy({
      where: { guru_id: guruId },
      transaction: t
    });

    // Add new relations
    if (kelas_list && Array.isArray(kelas_list) && kelas_list.length > 0) {
      const relations = kelas_list.map(item => ({
        guru_id: guruId,
        kelas_id: parseInt(item.kelas_id),
        mata_pelajaran: item.mata_pelajaran,
        jam_mulai: item.jam_mulai || '07:00:00' // Default jam_mulai if not provided
      }));

      await GuruKelas.bulkCreate(relations, { transaction: t });
    }

    await t.commit();
    res.json({ success: true, message: 'Relasi kelas berhasil disinkronisasi' });
  } catch (error) {
    await t.rollback();
    console.error('Sync error:', error);
    res.status(500).json({ error: error.message });
  }
});


// ========================================
// CRUD SISWA
// ========================================

// Get all siswa with kelas
router.get('/siswa/all', authMiddleware, adminOnly, async (req, res) => {
  try {
    const siswa = await Siswa.findAll({
      include: [{
        model: Kelas,
        attributes: ['nama']
      }],
      order: [['nama', 'ASC']]
    });
    res.json(siswa);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single siswa
router.get('/siswa/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const siswa = await Siswa.findByPk(id, {
      include: [{
        model: Kelas,
        attributes: ['nama']
      }]
    });

    if (!siswa) {
      return res.status(404).json({ error: 'Siswa not found' });
    }

    res.json(siswa);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new siswa
router.post('/siswa', authMiddleware, adminOnly, upload.single('foto'), async (req, res) => {
  try {
    const { nis, nama, kelamin, status, kelas_id } = req.body;

    // Check if nis already exists
    const existingSiswa = await Siswa.findOne({ where: { nis } });

    if (existingSiswa) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(400).json({
        error: 'NIS sudah digunakan'
      });
    }

    // Check if kelas exists
    const kelas = await Kelas.findByPk(kelas_id);
    if (!kelas) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(400).json({
        error: 'Kelas tidak ditemukan'
      });
    }

    const createData = {
      nis,
      nama,
      kelamin,
      status,
      kelas_id
    };

    if (req.file) {
      createData.foto = 'uploads/profiles/' + req.file.filename;
    }

    // Create siswa
    const siswa = await Siswa.create(createData);

    // Return with kelas info
    const siswaWithKelas = await Siswa.findByPk(siswa.id, {
      include: [{
        model: Kelas,
        attributes: ['nama']
      }]
    });

    res.status(201).json({
      success: true,
      message: 'Siswa berhasil ditambahkan',
      data: siswaWithKelas
    });
  } catch (error) {
    if (req.file) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: error.message });
  }
});

// Update siswa
router.put('/siswa/:id', authMiddleware, adminOnly, upload.single('foto'), async (req, res) => {
  try {
    const { id } = req.params;
    const { nis, nama, kelamin, status, kelas_id } = req.body;

    const siswa = await Siswa.findByPk(id);

    if (!siswa) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(404).json({ error: 'Siswa not found' });
    }

    // Check if nis already exists (exclude current siswa)
    if (nis) {
      const existingSiswa = await Siswa.findOne({
        where: {
          nis,
          id: { [Op.ne]: id }
        }
      });

      if (existingSiswa) {
        if (req.file) fs.unlinkSync(req.file.path);
        return res.status(400).json({
          error: 'NIS sudah digunakan oleh siswa lain'
        });
      }
    }

    // Check if kelas exists (if kelas_id provided)
    if (kelas_id) {
      const kelas = await Kelas.findByPk(kelas_id);
      if (!kelas) {
        if (req.file) fs.unlinkSync(req.file.path);
        return res.status(400).json({
          error: 'Kelas tidak ditemukan'
        });
      }
    }

    // Prepare update data
    const updateData = {};
    if (nis) updateData.nis = nis;
    if (nama) updateData.nama = nama;
    if (kelamin !== undefined) updateData.kelamin = kelamin;
    if (status !== undefined) updateData.status = status;
    if (kelas_id) updateData.kelas_id = kelas_id;

    if (req.file) {
      if (siswa.foto) {
        const oldPath = path.join(__dirname, '..', siswa.foto);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
      updateData.foto = 'uploads/profiles/' + req.file.filename;
    }

    // Update siswa
    await siswa.update(updateData);

    // Return with kelas info
    const siswaWithKelas = await Siswa.findByPk(siswa.id, {
      include: [{
        model: Kelas,
        attributes: ['nama']
      }]
    });

    res.json({
      success: true,
      message: 'Siswa berhasil diupdate',
      data: siswaWithKelas
    });
  } catch (error) {
    if (req.file) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: error.message });
  }
});

// Delete siswa
router.delete('/siswa/:id', authMiddleware, adminOnly, async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const { id } = req.params;

    const siswa = await Siswa.findByPk(id);

    if (!siswa) {
      await t.rollback();
      return res.status(404).json({ error: 'Siswa not found' });
    }

    // Delete photo if exists
    if (siswa.foto) {
      const photoPath = path.join(__dirname, '..', siswa.foto);
      if (fs.existsSync(photoPath)) fs.unlinkSync(photoPath);
    }

    // Delete all absensi records for this siswa first
    await Absensi.destroy({
      where: { siswa_id: id },
      transaction: t
    });

    // Delete siswa (orphan records in siswa_orang_tua will be cascade deleted)
    await siswa.destroy({ transaction: t });
    await t.commit();

    res.json({
      success: true,
      message: 'Siswa dan riwayat absensinya berhasil dihapus'
    });
  } catch (error) {
    await t.rollback();
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// CRUD KELAS
// ========================================

// Get all kelas
router.get('/kelas/all', authMiddleware, adminOnly, async (req, res) => {
  try {
    const kelas = await Kelas.findAll({
      include: [{
        model: Jurusan,
        attributes: ['id', 'nama', 'singkatan']
      }],
      order: [['nama', 'ASC']]
    });
    res.json(kelas);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new kelas
router.post('/kelas', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { nama, tingkat, tahun_ajaran, jurusan_id } = req.body;

    // Check if kelas already exists
    const existingKelas = await Kelas.findOne({ where: { nama } });

    if (existingKelas) {
      return res.status(400).json({
        error: 'Nama kelas sudah digunakan'
      });
    }

    // Validate Jurusan exists (if provided)
    if (jurusan_id) {
      const jurusan = await Jurusan.findByPk(jurusan_id);
      if (!jurusan) {
        return res.status(400).json({
          error: 'Jurusan tidak ditemukan'
        });
      }
    }

    const kelas = await Kelas.create({
      nama,
      tingkat,
      tahun_ajaran,
      jurusan_id: jurusan_id || null
    });

    // Return with Jurusan info
    const kelasWithJurusan = await Kelas.findByPk(kelas.id, {
      include: [{
        model: Jurusan,
        attributes: ['id', 'nama', 'singkatan']
      }]
    });

    res.status(201).json({
      success: true,
      message: 'Kelas berhasil ditambahkan',
      data: kelasWithJurusan
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update kelas
router.put('/kelas/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const { nama, tingkat, tahun_ajaran, jurusan_id } = req.body;

    const kelas = await Kelas.findByPk(id);

    if (!kelas) {
      return res.status(404).json({ error: 'Kelas not found' });
    }

    // Check if nama already exists (exclude current kelas)
    if (nama) {
      const existingKelas = await Kelas.findOne({
        where: {
          nama,
          id: { [Op.ne]: id }
        }
      });

      if (existingKelas) {
        return res.status(400).json({
          error: 'Nama kelas sudah digunakan'
        });
      }
    }

    // Validate Jurusan exists (if provided)
    if (jurusan_id !== undefined) {
      if (jurusan_id === null) {
        // Allow setting to null
      } else {
        const jurusan = await Jurusan.findByPk(jurusan_id);
        if (!jurusan) {
          return res.status(400).json({
            error: 'Jurusan tidak ditemukan'
          });
        }
      }
    }

    // Update kelas
    const updateData = {};
    if (nama) updateData.nama = nama;
    if (tingkat) updateData.tingkat = tingkat;
    if (tahun_ajaran) updateData.tahun_ajaran = tahun_ajaran;
    if (jurusan_id !== undefined) updateData.jurusan_id = jurusan_id;

    await kelas.update(updateData);

    // Return with Jurusan info
    const kelasWithJurusan = await Kelas.findByPk(kelas.id, {
      include: [{
        model: Jurusan,
        attributes: ['id', 'nama', 'singkatan']
      }]
    });

    res.json({
      success: true,
      message: 'Kelas berhasil diupdate',
      data: kelasWithJurusan
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete kelas
router.delete('/kelas/:id', authMiddleware, adminOnly, async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const { id } = req.params;

    const kelas = await Kelas.findByPk(id);

    if (!kelas) {
      await t.rollback();
      return res.status(404).json({ error: 'Kelas not found' });
    }

    // Check if kelas has siswa or jurnal
    const siswaCount = await Siswa.count({ where: { kelas_id: id } });
    const jurnalCount = await Jurnal.count({ where: { kelas_id: id } });

    if (siswaCount > 0 || jurnalCount > 0) {
      await t.rollback();
      return res.status(400).json({
        error: 'Tidak dapat menghapus kelas yang sudah memiliki siswa atau jurnal'
      });
    }

    // Delete kelas
    await kelas.destroy({ transaction: t });
    await t.commit();

    res.json({
      success: true,
      message: 'Kelas berhasil dihapus'
    });
  } catch (error) {
    await t.rollback();
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// CRUD GURU-KELAS (Relasi Guru Mengajar Kelas)
// ========================================

// Get all guru-kelas relations
router.get('/guru-kelas/all', authMiddleware, adminOnly, async (req, res) => {
  try {
    const guruKelas = await GuruKelas.findAll({
      include: [
        {
          model: Guru,
          attributes: ['id', 'nama', 'nip', 'mapel']
        },
        {
          model: Kelas,
          attributes: ['id', 'nama', 'tingkat']
        }
      ],
      order: [['createdAt', 'DESC']]
    });
    res.json(guruKelas);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get kelas yang diajar oleh guru tertentu
router.get('/guru-kelas/guru/:guruId', authMiddleware, adminOnly, async (req, res) => {
  try {
    const guruId = parseInt(req.params.guruId);
    const guruKelas = await GuruKelas.findAll({
      where: { guru_id: guruId },
      include: [
        { model: Kelas, as: 'Kelas', attributes: ['id', 'nama', 'tingkat'] }
      ]
    });
    res.json(guruKelas);
  } catch (error) {
    console.error('Error in guru-kelas endpoint:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add guru to kelas (with optional mata_pelajaran override)
router.post('/guru-kelas', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { guru_id, kelas_id, mata_pelajaran, jam_mulai } = req.body;

    // Check if relation already exists
    const existing = await GuruKelas.findOne({
      where: { guru_id, kelas_id, mata_pelajaran }
    });

    if (existing) {
      return res.status(400).json({
        error: 'Kombinasi guru, kelas, dan mata pelajaran ini sudah ada.'
      });
    }

    const guruKelas = await GuruKelas.create({
      guru_id,
      kelas_id,
      mata_pelajaran: mata_pelajaran,
      jam_mulai
    });

    res.status(201).json({
      success: true,
      message: 'Guru berhasil ditambahkan ke kelas',
      data: guruKelas
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update mata_pelajaran for guru-kelas relation
router.put('/guru-kelas/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const { mata_pelajaran, jam_mulai } = req.body;

    const guruKelas = await GuruKelas.findByPk(id);

    if (!guruKelas) {
      return res.status(404).json({ error: 'Relasi tidak ditemukan' });
    }

    const updateData = {};
    if (mata_pelajaran !== undefined) updateData.mata_pelajaran = mata_pelajaran;
    if (jam_mulai) updateData.jam_mulai = jam_mulai;

    await guruKelas.update(updateData);

    res.json({
      success: true,
      message: 'Jadwal mengajar berhasil diupdate',
      data: guruKelas
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete guru from kelas
router.delete('/guru-kelas/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;

    const guruKelas = await GuruKelas.findByPk(id);

    if (!guruKelas) {
      return res.status(404).json({ error: 'Relasi tidak ditemukan' });
    }

    await guruKelas.destroy();

    res.json({
      success: true,
      message: 'Guru berhasil dihapus dari kelas'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// DELETE ALL ENDPOINTS
// ========================================

// Delete all Jurusan
router.delete('/jurusan/all', authMiddleware, adminOnly, async (req, res) => {
  const t = await sequelize.transaction();
  try {
    // First, set kelas.jurusan_id to NULL
    await Kelas.update({ jurusan_id: null }, {
      where: { jurusan_id: { [Op.ne]: null } },
      transaction: t
    });

    // Then delete all Jurusan
    const count = await Jurusan.count();
    if (count === 0) {
      await t.rollback();
      return res.status(400).json({ error: 'Tidak ada data jurusan untuk dihapus' });
    }

    await Jurusan.destroy({ where: {}, transaction: t, force: true });
    await t.commit();

    res.json({
      success: true,
      message: `Berhasil menghapus ${count} data jurusan`
    });
  } catch (error) {
    await t.rollback();
    res.status(500).json({ error: error.message });
  }
});

// Delete all Guru
router.delete('/guru/all', authMiddleware, adminOnly, async (req, res) => {
  const t = await sequelize.transaction();
  try {
    // Get count before deletion
    const count = await Guru.count();
    if (count === 0) {
      await t.rollback();
      return res.status(400).json({ error: 'Tidak ada data guru untuk dihapus' });
    }

    // Delete all guru-kelas relations first
    await GuruKelas.destroy({ where: {}, transaction: t, force: true });

    // Delete all Guru
    await Guru.destroy({ where: {}, transaction: t, force: true });
    await t.commit();

    res.json({
      success: true,
      message: `Berhasil menghapus ${count} data guru`
    });
  } catch (error) {
    await t.rollback();
    res.status(500).json({ error: error.message });
  }
});

// Delete all Siswa
router.delete('/siswa/all', authMiddleware, adminOnly, async (req, res) => {
  const t = await sequelize.transaction();
  try {
    // Get count before deletion
    const count = await Siswa.count();
    if (count === 0) {
      await t.rollback();
      return res.status(400).json({ error: 'Tidak ada data siswa untuk dihapus' });
    }

    // Delete all Siswa
    await Siswa.destroy({ where: {}, transaction: t, force: true });
    await t.commit();

    res.json({
      success: true,
      message: `Berhasil menghapus ${count} data siswa`
    });
  } catch (error) {
    await t.rollback();
    res.status(500).json({ error: error.message });
  }
});

// Delete all Kelas
router.delete('/kelas/all', authMiddleware, adminOnly, async (req, res) => {
  const t = await sequelize.transaction();
  try {
    // Get count before deletion
    const count = await Kelas.count();
    if (count === 0) {
      await t.rollback();
      return res.status(400).json({ error: 'Tidak ada data kelas untuk dihapus' });
    }

    // Delete all kelas first (siswa, jurnal, guru-kelas will be affected by FK)
    await Kelas.destroy({ where: {}, transaction: t, force: true });
    await t.commit();

    res.json({
      success: true,
      message: `Berhasil menghapus ${count} data kelas`
    });
  } catch (error) {
    await t.rollback();
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
