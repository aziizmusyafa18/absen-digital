const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { Kelas, Siswa, Jurnal, Absensi, GuruKelas, Guru, sequelize } = require('../models');
const router = express.Router();

// Get semua kelas (fallback to all if no GuruKelas relation exists)
router.get('/kelas', authMiddleware, async (req, res) => {
  try {
    const guruId = req.user.id;

    // Get Guru info for default mata_pelajaran
    const guru = await Guru.findByPk(guruId);
    const defaultMapel = guru ? guru.mapel : null;

    // Get GuruKelas relations for this guru
    const guruKelas = await GuruKelas.findAll({
      where: { guru_id: guruId },
      include: [{
        model: Kelas,
        attributes: ['id', 'nama', 'tingkat', 'tahun_ajaran']
      }]
    });

    // Create a map of kelas_id -> mata_pelajaran override
    const mapelMap = {};
    guruKelas.forEach(gk => {
      if (gk.mata_pelajaran) {
        mapelMap[gk.kelas_id] = gk.mata_pelajaran;
      }
    });

    // Get ALL kelas
    const allKelas = await Kelas.findAll({
      order: [['nama', 'ASC']]
    });

    // Format response - include mata_pelajaran from GuruKelas or default
    const kelasData = allKelas.map(kelas => ({
      id: kelas.id,
      nama: kelas.nama,
      tingkat: kelas.tingkat,
      tahun_ajaran: kelas.tahun_ajaran,
      mata_pelajaran: mapelMap[kelas.id] || defaultMapel
    }));

    res.json(kelasData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get settings guru (jam_mulai)
router.get('/settings', authMiddleware, async (req, res) => {
  try {
    const { Guru } = require('../models');
    const guru = await Guru.findByPk(req.user.id, {
      attributes: ['id', 'nama', 'nip', 'mapel', 'jam_mulai']
    });
    res.json(guru);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get siswa dalam kelas
router.get('/kelas/:kelasId/siswa', authMiddleware, async (req, res) => {
  try {
    const { kelasId } = req.params;
    const siswa = await Siswa.findAll({
      where: { kelas_id: kelasId },
      order: [['nama', 'ASC']]
    });
    res.json(siswa);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Submit absen + jurnal
router.post('/absen', authMiddleware, async (req, res) => {
  console.log('=== ABSEN SUBMISSION START ===');
  console.log('User:', req.user?.id, req.user?.nama);

  const t = await sequelize.transaction();

  try {
    const { kelas_id, siswa_list, jurnal_data } = req.body;
    console.log('Received data:', { kelas_id, siswa_count: siswa_list?.length, jurnal_data });

    if (!kelas_id || !siswa_list || !siswa_list.length) {
      throw new Error('Data tidak lengkap: kelas_id dan siswa_list wajib ada');
    }

    // Create jurnal
    console.log('Creating jurnal...');
    const jurnal = await Jurnal.create({
      guru_id: req.user.id,
      kelas_id,
      jam_mulai: jurnal_data.jam_mulai,
      jam_selesai: jurnal_data.jam_selesai,
      mata_pelajaran: jurnal_data.mata_pelajaran,
      materi: jurnal_data.materi
    }, { transaction: t });
    console.log('Jurnal created with id:', jurnal.id);

    // Create absensi records
    console.log('Creating absensi records...');
    const absensiPromises = siswa_list.map(siswa =>
      Absensi.create({
        jurnal_id: jurnal.id,
        siswa_id: siswa.siswa_id,
        status: siswa.status,
        keterangan: siswa.keterangan || null
      }, { transaction: t })
    );

    await Promise.all(absensiPromises);
    console.log('Absensi records created');

    await t.commit();
    console.log('Transaction committed');

    // Emit socket event untuk realtime notification
    if (req.io) {
      const totalHadir = siswa_list.filter(s => s.status === 'hadir').length;
      const totalIzin = siswa_list.filter(s => s.status === 'izin').length;
      const totalAlpha = siswa_list.filter(s => s.status === 'tanpa_ket').length;

      const kelas = await Kelas.findByPk(kelas_id);

      const notificationData = {
        jurnal_id: jurnal.id,
        guru_id: req.user.id,
        guru_name: req.user.nama,
        kelas_id,
        kelas_name: kelas.nama,
        mata_pelajaran: jurnal_data.mata_pelajaran,
        jam_mulai: jurnal_data.jam_mulai,
        jam_selesai: jurnal_data.jam_selesai,
        total_hadir: totalHadir,
        total_izin: totalIzin,
        total_alpha: totalAlpha,
        timestamp: new Date()
      };

      console.log('Emitting socket event to admin room:', notificationData);

      // Kirim ke admin room
      req.io.to('admin').emit('new-absen', notificationData);

      // Kirim ke orang tua room (akan difilter di client)
      req.io.emit('new-absen-all', notificationData);
    } else {
      console.warn('req.io is not available - socket events will not be sent');
    }

    console.log('=== ABSEN SUBMISSION SUCCESS ===');
    res.json({
      success: true,
      jurnal_id: jurnal.id,
      message: 'Absen berhasil disubmit'
    });

  } catch (error) {
    await t.rollback();
    console.error('=== ABSEN SUBMISSION ERROR ===', error);
    res.status(500).json({ error: error.message });
  }
});

// Get riwayat absen guru
router.get('/riwayat', authMiddleware, async (req, res) => {
  try {
    const jurnal = await Jurnal.findAll({
      where: { guru_id: req.user.id },
      include: [
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
      order: [['createdAt', 'DESC']],
      limit: 50
    });

    res.json(jurnal);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
