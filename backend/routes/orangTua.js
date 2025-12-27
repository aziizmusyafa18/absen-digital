const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { OrangTua, Siswa, Absensi, Jurnal, Kelas, sequelize } = require('../models');
const { Op } = require('sequelize');
const router = express.Router();

// Get anak yang diasuh
router.get('/anak', authMiddleware, async (req, res) => {
  try {
    const ortu = await OrangTua.findByPk(req.user.id, {
      include: [{
        model: Siswa,
        include: [{
          model: Kelas,
          attributes: ['nama']
        }]
      }]
    });

    res.json(ortu.Siswas);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get riwayat absen anak
router.get('/anak/:siswaId/riwayat', authMiddleware, async (req, res) => {
  try {
    const { siswaId } = req.params;
    const { tanggal_mulai, tanggal_selesai } = req.query;

    // Verify bahwa ortu memang punya anak ini
    const ortuSiswa = await OrangTua.findOne({
      where: { id: req.user.id },
      include: [{
        model: Siswa,
        where: { id: siswaId },
        attributes: ['id']
      }]
    });

    if (!ortuSiswa || ortuSiswa.Siswas.length === 0) {
      return res.status(403).json({ error: 'Unauthorized access to student data' });
    }

    const whereClause = { siswa_id: siswaId };

    if (tanggal_mulai && tanggal_selesai) {
      whereClause.createdAt = {
        [Op.between]: [
          new Date(tanggal_mulai),
          new Date(tanggal_selesai)
        ]
      };
    }

    const riwayat = await Absensi.findAll({
      where: whereClause,
      include: [{
        model: Jurnal,
        include: [{
          model: Kelas,
          as: 'Kelas',
          attributes: ['nama']
        }]
      }],
      order: [['createdAt', 'DESC']],
      limit: 100
    });

    // Format data
    const formattedRiwayat = riwayat.map(absensi => ({
      tanggal: absensi.Jurnal.tanggal,
      jam_mulai: absensi.Jurnal.jam_mulai,
      jam_selesai: absensi.Jurnal.jam_selesai,
      mata_pelajaran: absensi.Jurnal.mata_pelajaran,
      materi: absensi.Jurnal.materi,
      status: absensi.status,
      kelas: absensi.Jurnal.Kelas.nama
    }));

    res.json(formattedRiwayat);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get statistik kehadiran anak
router.get('/anak/:siswaId/statistik', authMiddleware, async (req, res) => {
  try {
    const { siswaId } = req.params;
    const { bulan, tahun } = req.query;

    // Verify ortu
    const ortuSiswa = await OrangTua.findOne({
      where: { id: req.user.id },
      include: [{
        model: Siswa,
        where: { id: siswaId },
        attributes: ['id']
      }]
    });

    if (!ortuSiswa || ortuSiswa.Siswas.length === 0) {
      return res.status(403).json({ error: 'Unauthorized access to student data' });
    }

    const startDate = new Date(tahun || new Date().getFullYear(), (bulan ? parseInt(bulan) - 1 : 0), 1);
    const endDate = new Date(tahun || new Date().getFullYear(), (bulan ? parseInt(bulan) : 12), 0);

    const absensi = await Absensi.findAll({
      include: [{
        model: Jurnal,
        where: {
          tanggal: {
            [Op.between]: [startDate, endDate]
          }
        }
      }],
      where: { siswa_id: siswaId }
    });

    const statistik = {
      hadir: absensi.filter(a => a.status === 'hadir').length,
      izin: absensi.filter(a => a.status === 'izin').length,
      tanpa_ket: absensi.filter(a => a.status === 'tanpa_ket').length,
      total: absensi.length
    };

    res.json(statistik);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
