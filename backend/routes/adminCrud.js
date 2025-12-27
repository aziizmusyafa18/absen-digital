const express = require('express');
const bcrypt = require('bcrypt');
const { authMiddleware, adminOnly } = require('../middleware/auth');
const { Guru, Kelas, Siswa, Jurnal, Absensi, GuruKelas, Jurusan, sequelize } = require('../models');
const { Op } = require('sequelize');
const router = express.Router();

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
router.post('/guru', authMiddleware, adminOnly, async (req, res) => {
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
      return res.status(400).json({
        error: 'Username atau NIP sudah digunakan'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create guru
    const guru = await Guru.create({
      username,
      password: hashedPassword,
      nama,
      nip,
      mapel,
      jam_mulai: jam_mulai || null,
      role
    });

    // Return without password
    const { password: _, ...guruWithoutPassword } = guru.toJSON();

    res.status(201).json({
      success: true,
      message: 'Guru berhasil ditambahkan',
      data: guruWithoutPassword
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update guru
router.put('/guru/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const { username, password, nama, nip, mapel, jam_mulai, role } = req.body;

    const guru = await Guru.findByPk(id);

    if (!guru) {
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
router.post('/siswa', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { nis, nama, email, phone, kelas_id } = req.body;

    // Check if nis already exists
    const existingSiswa = await Siswa.findOne({ where: { nis } });

    if (existingSiswa) {
      return res.status(400).json({
        error: 'NIS sudah digunakan'
      });
    }

    // Check if kelas exists
    const kelas = await Kelas.findByPk(kelas_id);
    if (!kelas) {
      return res.status(400).json({
        error: 'Kelas tidak ditemukan'
      });
    }

    // Create siswa
    const siswa = await Siswa.create({
      nis,
      nama,
      email,
      phone,
      kelas_id
    });

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
    res.status(500).json({ error: error.message });
  }
});

// Update siswa
router.put('/siswa/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const { nis, nama, email, phone, kelas_id } = req.body;

    const siswa = await Siswa.findByPk(id);

    if (!siswa) {
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
        return res.status(400).json({
          error: 'NIS sudah digunakan oleh siswa lain'
        });
      }
    }

    // Check if kelas exists (if kelas_id provided)
    if (kelas_id) {
      const kelas = await Kelas.findByPk(kelas_id);
      if (!kelas) {
        return res.status(400).json({
          error: 'Kelas tidak ditemukan'
        });
      }
    }

    // Prepare update data
    const updateData = {};
    if (nis) updateData.nis = nis;
    if (nama) updateData.nama = nama;
    if (email !== undefined) updateData.email = email;
    if (phone !== undefined) updateData.phone = phone;
    if (kelas_id) updateData.kelas_id = kelas_id;

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

    // Check if siswa has absensi records
    const absensiCount = await Absensi.count({
      where: { siswa_id: id }
    });

    if (absensiCount > 0) {
      await t.rollback();
      return res.status(400).json({
        error: 'Tidak dapat menghapus siswa yang sudah memiliki data absensi'
      });
    }

    // Delete siswa (orphan records in siswa_orang_tua will be cascade deleted)
    await siswa.destroy({ transaction: t });
    await t.commit();

    res.json({
      success: true,
      message: 'Siswa berhasil dihapus'
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
      include: [{
        model: Kelas,
        attributes: ['id', 'nama', 'tingkat']
      }]
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
    const { guru_id, kelas_id, mata_pelajaran } = req.body;

    // Check if relation already exists
    const existing = await GuruKelas.findOne({
      where: { guru_id, kelas_id }
    });

    if (existing) {
      return res.status(400).json({
        error: 'Guru sudah terdaftar di kelas ini'
      });
    }

    // Get guru's default mapel if not provided
    const guru = await Guru.findByPk(guru_id);
    if (!guru) {
      return res.status(404).json({ error: 'Guru tidak ditemukan' });
    }

    const guruKelas = await GuruKelas.create({
      guru_id,
      kelas_id,
      mata_pelajaran: mata_pelajaran || guru.mapel
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
    const { mata_pelajaran } = req.body;

    const guruKelas = await GuruKelas.findByPk(id);

    if (!guruKelas) {
      return res.status(404).json({ error: 'Relasi tidak ditemukan' });
    }

    await guruKelas.update({ mata_pelajaran });

    res.json({
      success: true,
      message: 'Mata pelajaran berhasil diupdate',
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

module.exports = router;
