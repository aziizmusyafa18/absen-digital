const express = require('express');
const { authMiddleware, adminOnly } = require('../middleware/auth');
const { Jurnal, Absensi, Siswa, Kelas, Guru, OrangTua, sequelize } = require('../models');
const { getWaStatus } = require('../utils/whatsapp');
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

// GET WA Status
router.get('/whatsapp/status', authMiddleware, adminOnly, async (req, res) => {
  try {
    const status = getWaStatus();
    res.json(status);
  } catch (error) {
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

// GET: Preview antrian notifikasi WA hari ini (siswa yang bermasalah)
router.get('/notifikasi/preview', authMiddleware, adminOnly, async (req, res) => {
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const absensiHariIni = await Absensi.findAll({
      where: {
        createdAt: { [Op.between]: [startOfDay, endOfDay] },
        status: { [Op.ne]: 'hadir' }
      },
      include: [
        { model: Siswa, attributes: ['id', 'nama', 'nis', 'no_hp_ortu'] },
        { model: Jurnal, attributes: ['mata_pelajaran'] }
      ]
    });

    // Kelompokkan per siswa
    const absensiPerSiswa = {};
    absensiHariIni.forEach(absen => {
      if (!absen.Siswa) return;
      const sId = absen.Siswa.id;
      if (!absensiPerSiswa[sId]) {
        absensiPerSiswa[sId] = {
          siswa: {
            id: absen.Siswa.id,
            nama: absen.Siswa.nama,
            nis: absen.Siswa.nis,
            no_hp_ortu: absen.Siswa.no_hp_ortu,
            akan_dikirim: !!absen.Siswa.no_hp_ortu
          },
          rekapan: []
        };
      }
      const statusLabel = absen.status === 'tanpa_ket' ? 'Alpa' : (absen.status === 'izin' ? 'Izin' : absen.status);
      absensiPerSiswa[sId].rekapan.push({
        mapel: absen.Jurnal ? absen.Jurnal.mata_pelajaran : '-',
        status: statusLabel
      });
    });

    const totalSiswa = Object.keys(absensiPerSiswa).length;
    const akanDikirim = Object.values(absensiPerSiswa).filter(d => d.siswa.akan_dikirim).length;

    res.json({
      success: true,
      info: `Jadwal kirim otomatis: Setiap hari pukul 14:00 WIB`,
      total_siswa_bermasalah: totalSiswa,
      total_akan_dikirim_wa: akanDikirim,
      antrian: Object.values(absensiPerSiswa)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST: Trigger manual pengiriman notifikasi WA (untuk testing)
router.post('/notifikasi/trigger', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const { sendWhatsAppMessage } = require('../utils/whatsapp');

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const absensiHariIni = await Absensi.findAll({
      where: {
        createdAt: { [Op.between]: [startOfDay, endOfDay] },
        status: { [Op.ne]: 'hadir' }
      },
      include: [
        { model: Siswa, attributes: ['id', 'nama', 'no_hp_ortu'] },
        { model: Jurnal, attributes: ['mata_pelajaran'] }
      ]
    });

    if (absensiHariIni.length === 0) {
      return res.json({ success: true, message: 'Tidak ada absen bermasalah hari ini. Tidak ada WA yang dikirim.' });
    }

    const absensiPerSiswa = {};
    absensiHariIni.forEach(absen => {
      if (!absen.Siswa) return;
      const sId = absen.Siswa.id;
      if (!absensiPerSiswa[sId]) {
        absensiPerSiswa[sId] = { siswa: absen.Siswa, rekapan: [] };
      }
      const statusLabel = absen.status === 'tanpa_ket' ? 'alpa' : absen.status;
      absensiPerSiswa[sId].rekapan.push({
        mapel: absen.Jurnal ? absen.Jurnal.mata_pelajaran : '-',
        status: statusLabel
      });
    });

    const tanggalStr = new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' });
    const jam = new Date().getHours();
    let waktu = 'Pagi';
    if (jam >= 11 && jam < 15) waktu = 'Siang';
    else if (jam >= 15 && jam < 18) waktu = 'Sore';
    else if (jam >= 18) waktu = 'Malam';

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'dummy_key');
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    let dikirim = 0;
    for (const sId in absensiPerSiswa) {
      const data = absensiPerSiswa[sId];
      if (!data.siswa.no_hp_ortu) continue;

      const listMasalah = data.rekapan.map(r => `- Mapel ${r.mapel}: ${r.status.toUpperCase()}`).join('\n');
      let pesan = '';
      try {
        if (!process.env.GEMINI_API_KEY) throw new Error('No Key');
        const prompt = `Kamu adalah Asisten AI Sekolah.
Tugasmu merangkum ketidakhadiran harian siswa dan mengirim laporan ke orang tuanya via WhatsApp.
Data Siswa: ${data.siswa.nama}
Tanggal: ${tanggalStr}
Rincian Absen Hari Ini:
${listMasalah}

Instruksi Khusus (SANGAT PENTING):
1. Awali kalimat TEPAT dengan: "Selamat ${waktu.toLowerCase()} Bapak/Ibu, berikut adalah rekap absensi harian ananda ${data.siswa.nama} pada hari ini..."
2. Buatlah laporan singkat (maks 2-3 paragraf), gunakan bahasa natural layaknya chat WA.
3. Jangan gunakan format markdown yang aneh-aneh (hindari bintang * di awal list).`;
        const result = await model.generateContent(prompt);
        pesan = result.response.text().trim();
      } catch (e) {
        pesan = `Selamat ${waktu.toLowerCase()} Bapak/Ibu, berikut adalah rekap absensi harian ananda *${data.siswa.nama}* pada hari ini (${tanggalStr}):\n\n${listMasalah}\n\nMohon perhatian dan konfirmasinya ke pihak sekolah jika terdapat kekeliruan. Terima kasih.`;
      }

      sendWhatsAppMessage(data.siswa.no_hp_ortu, pesan, data.siswa.id);
      dikirim++;
    }

    res.json({
      success: true,
      message: `✅ Trigger berhasil! ${dikirim} pesan masuk antrian WA.`,
      total_siswa_bermasalah: Object.keys(absensiPerSiswa).length,
      total_dikirim: dikirim
    });
  } catch (error) {
    console.error('Trigger notifikasi error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
