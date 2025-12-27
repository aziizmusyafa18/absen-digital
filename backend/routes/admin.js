const express = require('express');
const { authMiddleware, adminOnly } = require('../middleware/auth');
const { Jurnal, Absensi, Siswa, Kelas, Guru, OrangTua, sequelize } = require('../models');
const { Op } = require('sequelize');
const router = express.Router();

// Dashboard - overview semua absen hari ini
router.get('/dashboard', authMiddleware, adminOnly, async (req, res) => {
  try {
    console.log('Dashboard endpoint called');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get start and end of today in proper timezone
    const startOfToday = new Date(today);
    const endOfToday = new Date(today);
    endOfToday.setHours(23, 59, 59, 999);

    console.log('Start of today:', startOfToday);
    console.log('End of today:', endOfToday);

    const jurnalHariIni = await Jurnal.findAll({
      where: {
        tanggal: {
          [Op.between]: [startOfToday, endOfToday]
        }
      },
      include: [
        {
          model: Guru,
          as: 'Guru',
          attributes: ['nama', 'mapel', 'jam_mulai']
        },
        {
          model: Kelas,
          as: 'Kelas',
          attributes: ['nama']
        },
        {
          model: Absensi,
          include: [{
            model: Siswa,
            attributes: ['nama', 'nis']
          }]
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    console.log('Jurnal found:', jurnalHariIni.length);

    // Hitung statistik
    const totalJurnal = jurnalHariIni.length;

    // Hitung total siswa hadir
    const totalSiswaHadir = jurnalHariIni.reduce((total, jurnal) => {
      if (jurnal.Absensis) {
        return total + jurnal.Absensis.filter(a => a.status === 'hadir').length;
      }
      return total;
    }, 0);

    console.log('Total jurnal:', totalJurnal, 'Total siswa hadir:', totalSiswaHadir);

    res.json({
      jurnal_hari_ini: jurnalHariIni,
      statistik: {
        total_jurnal: totalJurnal,
        total_siswa_hadir: totalSiswaHadir
      }
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get semua jurnal dengan filter
router.get('/jurnal', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { tanggal, kelas_id, guru_id } = req.query;

    const whereClause = {};

    if (tanggal) {
      const startDate = new Date(tanggal);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(tanggal);
      endDate.setHours(23, 59, 59, 999);

      whereClause.tanggal = {
        [Op.between]: [startDate, endDate]
      };
    }

    if (kelas_id) {
      whereClause.kelas_id = kelas_id;
    }

    if (guru_id) {
      whereClause.guru_id = guru_id;
    }

    const jurnal = await Jurnal.findAll({
      where: whereClause,
      include: [
        {
          model: Guru,
          as: 'Guru',
          attributes: ['nama', 'mapel', 'nip']
        },
        {
          model: Kelas,
          as: 'Kelas',
          attributes: ['nama']
        },
        {
          model: Absensi,
          include: [{
            model: Siswa,
            attributes: ['nama', 'nis']
          }]
        }
      ],
      order: [['tanggal', 'DESC'], ['createdAt', 'DESC']]
    });

    res.json(jurnal);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Export laporan ke Excel (simplified - bisa tambah library excel)
router.get('/export', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { tanggal_mulai, tanggal_selesai } = req.query;

    const whereClause = {};

    if (tanggal_mulai && tanggal_selesai) {
      whereClause.tanggal = {
        [Op.between]: [
          new Date(tanggal_mulai),
          new Date(tanggal_selesai)
        ]
      };
    }

    const jurnal = await Jurnal.findAll({
      where: whereClause,
      include: [
        {
          model: Guru,
          as: 'Guru',
          attributes: ['nama', 'mapel']
        },
        {
          model: Kelas,
          as: 'Kelas',
          attributes: ['nama']
        },
        {
          model: Absensi,
          include: [{
            model: Siswa,
            attributes: ['nama', 'nis']
          }]
        }
      ],
      order: [['tanggal', 'DESC']]
    });

    // Format data untuk export
    const exportData = jurnal.map(jurnal => ({
      Tanggal: jurnal.tanggal,
      Guru: jurnal.Guru.nama,
      'Mata Pelajaran': jurnal.mata_pelajaran,
      Kelas: jurnal.Kelas.nama,
      'Jam Mulai': jurnal.jam_mulai,
      'Jam Selesai': jurnal.jam_selesai,
      'Total Hadir': jurnal.Absensis.filter(a => a.status === 'hadir').length,
      'Total Izin': jurnal.Absensis.filter(a => a.status === 'izin').length,
      'Total Alpha': jurnal.Absensis.filter(a => a.status === 'tanpa_ket').length
    }));

    res.json({
      success: true,
      data: exportData,
      message: 'Data berhasil diexport (gunakan library excel untuk download file)'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// CRUD untuk data master (kelas, siswa, guru, ortu)
router.get('/guru', authMiddleware, adminOnly, async (req, res) => {
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

router.get('/siswa', authMiddleware, adminOnly, async (req, res) => {
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

module.exports = router;
