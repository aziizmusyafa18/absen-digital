const { Siswa, Absensi, Jurnal, Kelas, GuruKelas, OrangTua, sequelize } = require('../models');
const { Op } = require('sequelize');

/**
 * Mencari siswa berdasarkan nama (fuzzy match) atau ID
 */
async function findSiswaByNameOrId(nama, userId, userRole) {
  // Jika nama dikosongkan dan ada siswa_id, gunakan ID langsung
  if (!nama || nama.trim() === '') {
    return null;
  }

  const whereClause = {
    nama: { [Op.like]: `%${nama}%` }
  };

  const siswa = await Siswa.findAll({
    where: whereClause,
    include: [{ model: Kelas, attributes: ['nama'] }],
    limit: 5
  });

  return siswa;
}

/**
 * Memverifikasi apakah user memiliki akses ke data siswa berdasarkan role
 */
async function verifySiswaAccess(siswaId, userId, userRole) {
  const siswa = await Siswa.findByPk(siswaId, {
    include: [{ model: Kelas, attributes: ['id', 'nama'] }]
  });

  if (!siswa) {
    return { hasAccess: false, siswa: null, error: 'Siswa tidak ditemukan' };
  }

  switch (userRole) {
    case 'admin':
      return { hasAccess: true, siswa, error: null };

    case 'ortu': {
      const ortuSiswa = await OrangTua.findOne({
        where: { id: userId },
        include: [{
          model: Siswa,
          where: { id: siswaId },
          attributes: ['id']
        }]
      });
      if (!ortuSiswa || ortuSiswa.Siswas.length === 0) {
        return { hasAccess: false, siswa, error: 'Anda tidak memiliki akses ke data anak ini' };
      }
      return { hasAccess: true, siswa, error: null };
    }

    case 'guru': {
      const guruKelas = await GuruKelas.findOne({
        where: {
          guru_id: userId,
          kelas_id: siswa.kelas_id
        },
        attributes: ['id']
      });
      if (!guruKelas) {
        return { hasAccess: false, siswa, error: 'Anda tidak mengajar kelas siswa ini' };
      }
      return { hasAccess: true, siswa, error: null };
    }

    default:
      return { hasAccess: false, siswa, error: 'Role tidak valid' };
  }
}

/**
 * Mengambil data keaktifan siswa selama 7 hari terakhir
 * Menggabungkan absensi dan jurnal
 */
async function getSiswaWeeklyActivity(siswaId) {
  const today = new Date();
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(today.getDate() - 7);

  const absensi = await Absensi.findAll({
    where: {
      siswa_id: siswaId,
      createdAt: {
        [Op.between]: [sevenDaysAgo, today]
      }
    },
    include: [{
      model: Jurnal,
      attributes: [
        'id', 'tanggal', 'jam_mulai', 'jam_selesai',
        'mata_pelajaran', 'materi', 'catatan',
        'status_masuk', 'menit_keterlambatan'
      ],
      include: [{
        model: Kelas,
        as: 'Kelas',
        attributes: ['nama']
      }]
    }],
    order: [['createdAt', 'DESC']]
  });

  // Jika tidak ada data dalam 7 hari terakhir, ambil data terbaru (maksimal 10)
  let dataToUse = absensi;
  let infoNote = '';
  if (absensi.length === 0) {
    const latestAbsensi = await Absensi.findAll({
      where: { siswa_id: siswaId },
      include: [{
        model: Jurnal,
        attributes: [
          'id', 'tanggal', 'jam_mulai', 'jam_selesai',
          'mata_pelajaran', 'materi', 'catatan',
          'status_masuk', 'menit_keterlambatan'
        ],
        include: [{
          model: Kelas,
          as: 'Kelas',
          attributes: ['nama']
        }]
      }],
      order: [['createdAt', 'DESC']],
      limit: 10
    });
    dataToUse = latestAbsensi;
    infoNote = '\nCatatan: Tidak ada data keaktifan dalam 7 hari terakhir. Data di bawah adalah data keaktifan terbaru yang tersedia.';
  }

  // Ambil juga data nilai terbaru siswa (jika ada)
  let nilaiList = [];
  try {
    const { Nilai } = require('../models');
    nilaiList = await Nilai.findAll({
      where: { siswa_id: siswaId },
      order: [['tanggal', 'DESC'], ['createdAt', 'DESC']],
      limit: 10
    });
  } catch (err) {
    console.warn('[academicContext] Gagal mengambil nilai:', err.message);
  }

  return { absensi: dataToUse, infoNote, nilai: nilaiList };
}

/**
 * Membuat teks konteks akademik untuk AI
 */
function buildAcademicContext(siswa, absensiData, infoNote = '', nilaiData = []) {
  const lines = [];
  lines.push(`=== DATA AKADEMIK SISWA ===`);
  lines.push(`Nama: ${siswa.nama}`);
  lines.push(`NIS: ${siswa.nis}`);
  lines.push(`Kelas: ${siswa.Kelas ? siswa.Kelas.nama : '-'}`);
  lines.push(`\nData keaktifan belajar:${infoNote}`);
  lines.push('');

  if (!absensiData || absensiData.length === 0) {
    lines.push('Tidak ada data keaktifan absensi yang ditemukan.');
  } else {
    let hadir = 0, izin = 0, sakit = 0, alpha = 0;
    const mapelSet = new Set();

    absensiData.forEach((a, idx) => {
      const j = a.Jurnal || {};
      const tgl = j.tanggal ? new Date(j.tanggal).toLocaleDateString('id-ID', {
        weekday: 'short', day: 'numeric', month: 'short'
      }) : 'Tanggal tidak diketahui';
      const status = a.status || 'tidak diketahui';
      const mapel = j.mata_pelajaran || '-';
      const materi = j.materi || '-';
      const catatan = j.catatan || '-';
      const statusMasuk = j.status_masuk || '-';
      const menitTerlambat = j.menit_keterlambatan || 0;

      if (status === 'hadir') hadir++;
      else if (status === 'izin') izin++;
      else if (status === 'sakit') sakit++;
      else if (status === 'tanpa_ket' || status === 'alpa') alpha++;
      if (mapel !== '-') mapelSet.add(mapel);

      lines.push(`${idx + 1}. ${tgl} | ${mapel} | Status: ${status} | Materi: ${materi} | Kedatangan: ${statusMasuk} (${menitTerlambat} menit terlambat) | Catatan Guru: ${catatan}`);
    });

    const total = absensiData.length;
    const persentase = total > 0 ? Math.round((hadir / total) * 100) : 0;

    lines.push('');
    lines.push(`=== RINGKASAN KEHADIRAN ===`);
    lines.push(`Total pertemuan: ${total}`);
    lines.push(`Persentase Kehadiran: ${persentase}%`);
    lines.push(`Hadir: ${hadir}, Izin: ${izin}, Sakit: ${sakit}, Alpha/Tanpa Keterangan: ${alpha}`);
    lines.push(`Mata pelajaran yang diikuti: ${Array.from(mapelSet).join(', ') || '-'}`);
  }

  // Tambahkan konteks nilai siswa
  lines.push('');
  lines.push(`=== DATA NILAI SISWA ===`);
  if (!nilaiData || nilaiData.length === 0) {
    lines.push('Belum ada data nilai tercatat untuk siswa ini.');
  } else {
    nilaiData.forEach((n, idx) => {
      const tgl = n.tanggal ? new Date(n.tanggal).toLocaleDateString('id-ID') : '-';
      lines.push(`${idx + 1}. Mapel: ${n.mata_pelajaran} | Nilai: ${n.nilai} | Keterangan: ${n.keterangan || '-'} | Tanggal: ${tgl}`);
    });
  }

  return lines.join('\n');
}

module.exports = {
  findSiswaByNameOrId,
  verifySiswaAccess,
  getSiswaWeeklyActivity,
  buildAcademicContext
};