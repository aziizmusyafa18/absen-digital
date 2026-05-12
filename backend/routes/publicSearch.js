const express = require('express');
const { Siswa, Kelas, Absensi, Jurnal } = require('../models');
const { Op } = require('sequelize');
const router = express.Router();

// Search student by name or NIS (public endpoint for parent portal)
router.get('/search/:query', async (req, res) => {
  try {
    const { query } = req.params;

    // Search by name or NIS
    const siswa = await Siswa.findOne({
      where: {
        [Op.or]: [
          { nama: { [Op.like]: `%${query}%` } },
          { nis: query }
        ],
        status: 'aktif'
      },
      include: [{
        model: Kelas,
        attributes: ['id', 'nama']
      }]
    });

    if (!siswa) {
      return res.status(404).json({ error: 'Siswa tidak ditemukan' });
    }

    // Get attendance statistics for current month
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const allAbsensi = await Absensi.findAll({
      where: { siswa_id: siswa.id },
      include: [{
        model: Jurnal,
        where: {
          tanggal: {
            [Op.between]: [startOfMonth, endOfMonth]
          }
        },
        include: [{
          model: Kelas,
          as: 'Kelas',
          attributes: ['nama']
        }]
      }],
      order: [[Jurnal, 'tanggal', 'DESC'], [Jurnal, 'jam_mulai', 'DESC']]
    });

    // Calculate statistics
    const hadir = allAbsensi.filter(a => a.status === 'hadir').length;
    const izin = allAbsensi.filter(a => a.status === 'izin').length;
    const alpha = allAbsensi.filter(a => a.status === 'tanpa_ket').length;

    // Format attendance history
    const riwayat = allAbsensi.slice(0, 20).map(absensi => ({
      tanggal: absensi.Jurnal.tanggal,
      mapel: absensi.Jurnal.mata_pelajaran,
      jam: `${absensi.Jurnal.jam_mulai} - ${absensi.Jurnal.jam_selesai}`,
      status: absensi.status,
      kelas: absensi.Jurnal.Kelas ? absensi.Jurnal.Kelas.nama : '-'
    }));

    // Return formatted data
    res.json({
      nama: siswa.nama,
      nis: siswa.nis,
      foto: siswa.foto,
      kelas: siswa.Kela ? siswa.Kela.nama : (siswa.Kelas ? siswa.Kelas.nama : '-'),
      hadir,
      izin,
      alpha,
      riwayat
    });

  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan saat mencari data siswa' });
  }
});

module.exports = router;
