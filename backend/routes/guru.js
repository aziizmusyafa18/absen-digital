const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { Kelas, Siswa, Jurnal, Absensi, GuruKelas, Guru, sequelize, Nilai } = require('../models');
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
      materi: jurnal_data.materi,
      foto_kegiatan: jurnal_data.foto_kegiatan // Save the photo
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
        timestamp: new Date(),
        foto_kegiatan: jurnal.foto_kegiatan
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

// Submit Nilai Siswa
router.post('/nilai', authMiddleware, async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { kelas_id, mata_pelajaran, nilai_list } = req.body;
    const guru_id = req.user.id;

    if (!kelas_id || !mata_pelajaran || !nilai_list || !nilai_list.length) {
      throw new Error('Data tidak lengkap: kelas_id, mata_pelajaran, dan nilai_list wajib diisi.');
    }

    const nilaiPromises = nilai_list.map(item => {
      const parsedNilai = parseFloat(item.nilai);
      // Skip if value is null, empty, or not a valid number
      if (item.nilai === null || item.nilai === '' || isNaN(parsedNilai)) {
        return null;
      }

      // Optional: server-side range check, though model validation should also handle it
      if (parsedNilai < 0 || parsedNilai > 100) {
        // We can choose to throw an error or just skip this invalid entry
        console.warn(`Skipping invalid score value: ${item.nilai} for siswa_id: ${item.siswa_id}`);
        return null;
      }

      return Nilai.create({
        guru_id,
        kelas_id,
        siswa_id: item.siswa_id,
        mata_pelajaran,
        nilai: parsedNilai,
        keterangan: item.keterangan || `Penilaian ${mata_pelajaran}`,
        tanggal: new Date()
      }, { transaction: t });
    });

    await Promise.all(nilaiPromises.filter(p => p !== null));

    await t.commit();

    res.status(201).json({ success: true, message: 'Nilai berhasil disimpan.' });
  } catch (error) {
    await t.rollback();
    console.error('Error submitting nilai:', error); // Log full error object
    res.status(500).json({ success: false, error: error.message, details: error.name }); // Send error name to client
  }
});

const { Op } = require('sequelize');
const xlsx = require('xlsx');

// ... (existing router code)

// Get Riwayat Nilai
router.get('/riwayat-nilai', authMiddleware, async (req, res) => {
  try {
    const guruId = req.user.id;
    const riwayatNilai = await Nilai.findAll({
      where: { guru_id: guruId },
      include: [
        { model: Siswa, as: 'Siswa', attributes: ['nama'] },
        { model: Kelas, as: 'Kelas', attributes: ['nama'] }
      ],
      order: [['createdAt', 'DESC']]
    });
    console.log('Data riwayat nilai yang diambil:', JSON.stringify(riwayatNilai, null, 2));
    res.json(riwayatNilai);
  } catch (error) {
    console.error('Error fetching riwayat nilai:', error);
    res.status(500).json({ message: 'Gagal memuat riwayat nilai', error: error.message, details: error });
  }
});

// Export Nilai to Excel
router.get('/export-nilai', authMiddleware, async (req, res) => {
  try {
    const { jenis, tanggal, bulan, kelas_id } = req.query;
    const whereClause = { guru_id: req.user.id };

    if (!jenis || !kelas_id) {
      return res.status(400).send('Jenis laporan dan kelas harus dipilih.');
    }
    
    whereClause.kelas_id = kelas_id;

    if (jenis === 'harian' && tanggal) {
      const startDate = new Date(tanggal);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(tanggal);
      endDate.setHours(23, 59, 59, 999);
      whereClause.tanggal = { [Op.between]: [startDate, endDate] };
    } else if (jenis === 'bulanan' && bulan) {
      const year = parseInt(bulan.split('-')[0]);
      const month = parseInt(bulan.split('-')[1]) - 1;
      const startDate = new Date(year, month, 1);
      const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999);
      whereClause.tanggal = { [Op.between]: [startDate, endDate] };
    } else {
      return res.status(400).send('Parameter tidak valid untuk jenis laporan yang dipilih.');
    }

    const nilaiData = await Nilai.findAll({
      where: whereClause,
      include: [
        { model: Siswa, as: 'Siswa', attributes: ['nis', 'nama'] },
        { model: Kelas, as: 'Kelas', attributes: ['nama'] }
      ],
      order: [['tanggal', 'ASC'], [Siswa, 'nama', 'ASC']]
    });

    if (nilaiData.length === 0) {
      return res.status(404).send('Tidak ada data nilai yang ditemukan untuk kriteria yang dipilih.');
    }

    const kelasNama = nilaiData[0].Kelas.nama;
    const reportDate = jenis === 'harian' ? tanggal : bulan;
    const fileName = `Rekap_Nilai_${kelasNama}_${reportDate}.xlsx`;

    // Prepare data for Excel
    const dataForExcel = nilaiData.map(n => ({
      'NIS': n.Siswa.nis,
      'Nama Siswa': n.Siswa.nama,
      'Mata Pelajaran': n.mata_pelajaran,
      'Keterangan': n.keterangan,
      'Nilai': n.nilai,
      'Tanggal': new Date(n.tanggal).toLocaleDateString('id-ID')
    }));

    const worksheet = xlsx.utils.json_to_sheet(dataForExcel);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Rekap Nilai');
    
    // Auto-fit column width
    const cols = Object.keys(dataForExcel[0]);
    const colWidths = cols.map(col => ({
        wch: Math.max(...dataForExcel.map(row => (row[col] || '').toString().length), col.length)
    }));
    worksheet['!cols'] = colWidths;

    const buffer = xlsx.write(workbook, { bookType: 'xlsx', type: 'buffer' });

    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);

  } catch (error) {
    console.error('Error exporting nilai:', error);
    res.status(500).send('Gagal mengekspor data: ' + error.message);
  }
});

module.exports = router;
