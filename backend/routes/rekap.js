const express = require('express');
const router = express.Router();
const XLSX = require('xlsx');
const { authMiddleware, adminOnly } = require('../middleware/auth');
const { Absensi, Siswa, Kelas, Jurnal, Guru, Jurusan, Nilai, sequelize } = require('../models');
const { Op } = require('sequelize');

// Helper function untuk get data rekap
async function getRekapData(tanggal, kelas_id, jurusan_id) {
    // Default tanggal hari ini
    const targetDate = tanggal ? new Date(tanggal) : new Date();
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Build where clause untuk kelas
    const kelasWhere = {};
    if (kelas_id) {
        kelasWhere.id = kelas_id;
    }
    if (jurusan_id) {
        kelasWhere.jurusan_id = jurusan_id;
    }

    // Get semua kelas dengan siswa
    const kelasList = await Kelas.findAll({
        where: Object.keys(kelasWhere).length > 0 ? kelasWhere : undefined,
        include: [
            {
                model: Jurusan,
                attributes: ['id', 'nama', 'singkatan'],
                required: false
            },
            {
                model: Siswa,
                attributes: ['id', 'nis', 'nama', 'kelas_id'], // Pastikan kelas_id di-load
                required: false
            }
        ],
        order: [['nama', 'ASC']]
    });

    // Get semua jurnal pada tanggal tersebut
    const jurnalList = await Jurnal.findAll({
        where: {
            tanggal: {
                [Op.between]: [startOfDay, endOfDay]
            }
        },
        include: [
            {
                model: Guru,
                as: 'Guru',
                attributes: ['nama', 'mapel']
            },
            {
                model: Kelas,
                as: 'Kelas',
                attributes: ['id', 'nama']
            },
            {
                model: Absensi,
                include: [{
                    model: Siswa,
                    attributes: ['id', 'nis', 'nama', 'kelas_id'] // kelas_id di sini mungkin tidak update
                }]
            }
        ]
    });

    // Flatten absensi dari jurnal, dan yang PENTING: tambahkan kelas_id dari JURNAL
    const absensiList = [];
    jurnalList.forEach(jurnal => {
        if (jurnal.Absensis) {
            jurnal.Absensis.forEach(absensi => {
                absensiList.push({
                    ...absensi.toJSON(),
                    // Di sini kita menggunakan `jurnal.kelas_id` sebagai sumber kebenaran
                    // untuk asosiasi kelas saat absensi terjadi.
                    kelas_id_saat_absen: jurnal.kelas_id,
                    Jurnal: {
                        id: jurnal.id,
                        mata_pelajaran: jurnal.mata_pelajaran,
                        jam_mulai: jurnal.jam_mulai,
                        tanggal: jurnal.tanggal,
                        Guru: jurnal.Guru,
                        foto_kegiatan: jurnal.foto_kegiatan
                    }
                });
            });
        }
    });

    return { targetDate, kelasList, absensiList, startOfDay, endOfDay };
}


// Get rekap absensi per hari dengan filter
router.get('/harian', authMiddleware, adminOnly, async (req, res) => {
    try {
        const { tanggal, kelas_id, jurusan_id } = req.query;
        console.log('Rekap Harian Request:', { tanggal, kelas_id, jurusan_id });

        const { targetDate, kelasList, absensiList, startOfDay, endOfDay } = await getRekapData(tanggal, kelas_id, jurusan_id);

        console.log('Hasil getRekapData:', {
            targetDate: targetDate.toISOString(),
            jumlahKelas: kelasList.length,
            jumlahAbsensi: absensiList.length,
            startOfDay: startOfDay.toISOString(),
            endOfDay: endOfDay.toISOString()
        });

        // Organize data per kelas
        const rekapPerKelas = kelasList.map(kelas => {
            const siswaList = kelas.Siswas || [];

            // Get absensi untuk kelas ini menggunakan `kelas_id_saat_absen`
            const kelasAbsensi = absensiList.filter(a => a.kelas_id_saat_absen === kelas.id);

            // Map siswa dengan status absensi
            const siswaRekap = siswaList.map(siswa => {
                const absensiSiswa = kelasAbsensi.filter(a => a.siswa_id === siswa.id);

                // Ambil status terakhir atau gabungkan per mapel
                const statusPerMapel = absensiSiswa.map(a => ({
                    mapel: a.Jurnal?.mata_pelajaran || a.Jurnal?.Guru?.mapel || '-',
                    guru: a.Jurnal?.Guru?.nama || '-',
                    status: a.status,
                    keterangan: a.keterangan,
                    jam: a.Jurnal?.jam_mulai || '-'
                }));

                // Hitung total per status
                const totalHadir = absensiSiswa.filter(a => a.status === 'hadir').length;
                const totalIzin = absensiSiswa.filter(a => a.status === 'izin').length;
                const totalAlpha = absensiSiswa.filter(a => a.status === 'tanpa_ket').length;

                // Status ringkasan
                let statusRingkasan = 'belum_absen';
                if (absensiSiswa.length > 0) {
                    if (totalAlpha > 0) statusRingkasan = 'tanpa_ket';
                    else if (totalIzin > 0) statusRingkasan = 'izin';
                    else statusRingkasan = 'hadir';
                }

                return {
                    id: siswa.id,
                    nis: siswa.nis,
                    nama: siswa.nama,
                    status_ringkasan: statusRingkasan,
                    total_hadir: totalHadir,
                    total_izin: totalIzin,
                    total_alpha: totalAlpha,
                    total_mapel: absensiSiswa.length,
                    detail: statusPerMapel
                };
            }).filter(Boolean); // Hapus siswa yang null (yang sudah tidak di kelas ini)


            // Hitung statistik kelas
            const totalSiswa = siswaRekap.length; // Gunakan panjang siswaRekap yang sudah difilter
            const hadirCount = siswaRekap.filter(s => s.status_ringkasan === 'hadir').length;
            const izinCount = siswaRekap.filter(s => s.status_ringkasan === 'izin').length;
            const alphaCount = siswaRekap.filter(s => s.status_ringkasan === 'tanpa_ket').length;
            const belumAbsenCount = siswaRekap.filter(s => s.status_ringkasan === 'belum_absen').length;

            return {
                kelas: {
                    id: kelas.id,
                    nama: kelas.nama,
                    jurusan: kelas.Jurusan?.nama || '-'
                },
                statistik: {
                    total_siswa: totalSiswa,
                    hadir: hadirCount,
                    izin: izinCount,
                    alpha: alphaCount,
                    belum_absen: belumAbsenCount,
                    persentase_hadir: totalSiswa > 0 ? Math.round((hadirCount / totalSiswa) * 100) : 0
                },
                siswa: siswaRekap
            };
        });

        // Hitung statistik keseluruhan
        const totalSemuaSiswa = rekapPerKelas.reduce((sum, k) => sum + k.statistik.total_siswa, 0);
        const totalSemuaHadir = rekapPerKelas.reduce((sum, k) => sum + k.statistik.hadir, 0);
        const totalSemuaIzin = rekapPerKelas.reduce((sum, k) => sum + k.statistik.izin, 0);
        const totalSemuaAlpha = rekapPerKelas.reduce((sum, k) => sum + k.statistik.alpha, 0);
        const totalBelumAbsen = rekapPerKelas.reduce((sum, k) => sum + k.statistik.belum_absen, 0);

        console.log('Rekap Harian Response:', {
            total_kelas: rekapPerKelas.length,
            total_siswa: totalSemuaSiswa,
            hadir: totalSemuaHadir,
            izin: totalSemuaIzin,
            alpha: totalSemuaAlpha,
            belum_absen: totalBelumAbsen
        });

        res.json({
            success: true,
            data: {
                tanggal: targetDate.toISOString().split('T')[0],
                statistik_keseluruhan: {
                    total_kelas: rekapPerKelas.length,
                    total_siswa: totalSemuaSiswa,
                    hadir: totalSemuaHadir,
                    izin: totalSemuaIzin,
                    alpha: totalSemuaAlpha,
                    belum_absen: totalBelumAbsen,
                    persentase_hadir: totalSemuaSiswa > 0 ? Math.round((totalSemuaHadir / totalSemuaSiswa) * 100) : 0
                },
                rekap_per_kelas: rekapPerKelas
            }
        });

    } catch (error) {
        console.error('Rekap harian error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Export rekap ke Excel
router.get('/export/excel', authMiddleware, adminOnly, async (req, res) => {
    try {
        const { tanggal, kelas_id, jurusan_id } = req.query;
        const { targetDate, kelasList, absensiList } = await getRekapData(tanggal, kelas_id, jurusan_id);

        const wb = XLSX.utils.book_new();
        const tanggalStr = targetDate.toISOString().split('T')[0];
        const tanggalFormatted = targetDate.toLocaleDateString('id-ID', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });

        // --- Data for the single sheet ---
        const rekapData = [
            ['REKAP ABSENSI HARIAN'],
            [`Tanggal: ${tanggalFormatted}`],
            [],
            ['No', 'Kelas', 'NIS', 'Nama Siswa', 'Status', 'Jumlah Mapel Absen', 'Keterangan']
        ];
        
        let grandTotalSiswa = 0;
        let grandTotalHadir = 0;
        let grandTotalIzin = 0;
        let grandTotalAlpha = 0;
        let grandTotalBelum = 0;
        let no = 1;

        kelasList.forEach(kelas => {
            const siswaList = kelas.Siswas || [];
            if (siswaList.length === 0) return;

            const kelasAbsensi = absensiList.filter(a => a.kelas_id_saat_absen === kelas.id);
            const absensiPerSiswa = new Map();
            kelasAbsensi.forEach(a => {
                if (!absensiPerSiswa.has(a.siswa_id)) absensiPerSiswa.set(a.siswa_id, []);
                absensiPerSiswa.get(a.siswa_id).push(a);
            });
            
            grandTotalSiswa += siswaList.length;

            siswaList.forEach(siswa => {
                const absensiSiswa = absensiPerSiswa.get(siswa.id) || [];
                let status = 'Belum Absen';
                let keterangan = '-';
                let jumlahMapel = absensiSiswa.length;

                if (absensiSiswa.length > 0) {
                    const hasAlpha = absensiSiswa.some(a => a.status === 'tanpa_ket');
                    const hasIzin = absensiSiswa.some(a => a.status === 'izin');

                    if (hasAlpha) {
                        status = 'Alpha';
                        grandTotalAlpha++;
                        keterangan = absensiSiswa.find(a => a.status === 'tanpa_ket')?.keterangan || '-';
                    } else if (hasIzin) {
                        status = 'Izin';
                        grandTotalIzin++;
                        keterangan = absensiSiswa.find(a => a.status === 'izin')?.keterangan || '-';
                    } else {
                        status = 'Hadir';
                        grandTotalHadir++;
                        keterangan = absensiSiswa.map(a => a.Jurnal?.mata_pelajaran || a.Jurnal?.Guru?.mapel || '-').join(', ');
                    }
                } else {
                    grandTotalBelum++;
                }
                
                rekapData.push([
                    no++,
                    kelas.nama,
                    siswa.nis,
                    siswa.nama,
                    status,
                    jumlahMapel,
                    keterangan
                ]);
            });
        });

        // Add summary row at the bottom
        rekapData.push([]); // Spacer row
        const totalPersen = grandTotalSiswa > 0 ? Math.round((grandTotalHadir / grandTotalSiswa) * 100) : 0;
        const summaryText = `TOTAL KESELURUHAN: Hadir: ${grandTotalHadir} | Izin: ${grandTotalIzin} | Alpha: ${grandTotalAlpha} | Belum Absen: ${grandTotalBelum} | Tingkat Kehadiran: ${totalPersen}%`;
        rekapData.push(['', '', '', summaryText]);

        const ws = XLSX.utils.aoa_to_sheet(rekapData);
        ws['!cols'] = [ { wch: 5 }, { wch: 15 }, { wch: 15 }, { wch: 30 }, { wch: 15 }, { wch: 15 }, { wch: 40 } ];
        
        // Merge title and total cells
        const merges = [
            { s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }, 
            { s: { r: 1, c: 0 }, e: { r: 1, c: 6 } },
            { s: { r: rekapData.length - 1, c: 3 }, e: { r: rekapData.length - 1, c: 6 } }
        ];
        ws['!merges'] = merges;
        
        XLSX.utils.book_append_sheet(wb, ws, 'Rekap Harian');

        // Generate buffer and send response
        const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=rekap_absensi_harian_${tanggalStr}.xlsx`);
        res.send(buffer);

    } catch (error) {
        console.error('Export Excel error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Helper function untuk get data rekap bulanan
async function getRekapBulananData(bulan, tahun, kelas_id, jurusan_id) {
    // Parse bulan dan tahun
    const targetMonth = parseInt(bulan) || (new Date().getMonth() + 1);
    const targetYear = parseInt(tahun) || new Date().getFullYear();

    // Tanggal awal dan akhir bulan
    const startOfMonth = new Date(targetYear, targetMonth - 1, 1);
    startOfMonth.setHours(0, 0, 0, 0);
    const endOfMonth = new Date(targetYear, targetMonth, 0);
    endOfMonth.setHours(23, 59, 59, 999);

    // Hitung jumlah hari dalam bulan
    const daysInMonth = endOfMonth.getDate();

    // Build where clause untuk kelas
    const kelasWhere = {};
    if (kelas_id) {
        kelasWhere.id = kelas_id;
    }
    if (jurusan_id) {
        kelasWhere.jurusan_id = jurusan_id;
    }

    // Get semua kelas dengan siswa
    const kelasList = await Kelas.findAll({
        where: Object.keys(kelasWhere).length > 0 ? kelasWhere : undefined,
        include: [
            {
                model: Jurusan,
                attributes: ['id', 'nama', 'singkatan'],
                required: false
            },
            {
                model: Siswa,
                attributes: ['id', 'nis', 'nama'],
                required: false
            }
        ],
        order: [['nama', 'ASC']]
    });

    // Get semua jurnal pada bulan tersebut
    const jurnalList = await Jurnal.findAll({
        where: {
            tanggal: {
                [Op.between]: [startOfMonth, endOfMonth]
            }
        },
        include: [
            {
                model: Guru,
                as: 'Guru',
                attributes: ['nama', 'mapel']
            },
            {
                model: Kelas,
                as: 'Kelas',
                attributes: ['id', 'nama']
            },
            {
                model: Absensi,
                include: [{
                    model: Siswa,
                    attributes: ['id', 'nis', 'nama', 'kelas_id']
                }]
            }
        ]
    });

    // Flatten absensi dari jurnal, dan yang PENTING: tambahkan kelas_id dari JURNAL
    const absensiList = [];
    jurnalList.forEach(jurnal => {
        if (jurnal.Absensis) {
            jurnal.Absensis.forEach(absensi => {
                absensiList.push({
                    ...absensi.toJSON(),
                    // Di sini kita menggunakan `jurnal.kelas_id` sebagai sumber kebenaran
                    // untuk asosiasi kelas saat absensi terjadi.
                    kelas_id_saat_absen: jurnal.kelas_id,
                    Jurnal: {
                        id: jurnal.id,
                        mata_pelajaran: jurnal.mata_pelajaran,
                        jam_mulai: jurnal.jam_mulai,
                        tanggal: jurnal.tanggal,
                        Guru: jurnal.Guru,
                        foto_kegiatan: jurnal.foto_kegiatan
                    }
                });
            });
        }
    });

    return { targetMonth, targetYear, startOfMonth, endOfMonth, daysInMonth, kelasList, absensiList };
}

// Get rekap absensi bulanan
router.get('/bulanan', authMiddleware, adminOnly, async (req, res) => {
    try {
        const { bulan, tahun, kelas_id, jurusan_id } = req.query;
        const { targetMonth, targetYear, daysInMonth, kelasList, absensiList } = await getRekapBulananData(bulan, tahun, kelas_id, jurusan_id);

        // Organize data per kelas
        const rekapPerKelas = kelasList.map(kelas => {
            const siswaList = kelas.Siswas || [];

            // Get absensi untuk kelas ini
            const kelasAbsensi = absensiList.filter(a =>
                a.kelas_id_saat_absen === kelas.id
            );

            // Map siswa dengan rekap bulanan
            const siswaRekap = siswaList.map(siswa => {
                const absensiSiswa = kelasAbsensi.filter(a => a.siswa_id === siswa.id);

                // Group absensi per tanggal
                const absensiPerTanggal = {};
                absensiSiswa.forEach(a => {
                    const tgl = new Date(a.Jurnal.tanggal).toISOString().split('T')[0];
                    if (!absensiPerTanggal[tgl]) {
                        absensiPerTanggal[tgl] = [];
                    }
                    absensiPerTanggal[tgl].push(a);
                });

                // Hitung total per status untuk seluruh bulan
                let totalHadir = 0;
                let totalIzin = 0;
                let totalAlpha = 0;
                let totalHariAktif = Object.keys(absensiPerTanggal).length;

                // Tentukan status per hari
                Object.keys(absensiPerTanggal).forEach(tgl => {
                    const absensiHari = absensiPerTanggal[tgl];
                    const hasAlpha = absensiHari.some(a => a.status === 'tanpa_ket');
                    const hasIzin = absensiHari.some(a => a.status === 'izin');

                    if (hasAlpha) {
                        totalAlpha++;
                    } else if (hasIzin) {
                        totalIzin++;
                    } else {
                        totalHadir++;
                    }
                });

                // Persentase kehadiran
                const persentaseHadir = totalHariAktif > 0 ? Math.round((totalHadir / totalHariAktif) * 100) : 0;

                return {
                    id: siswa.id,
                    nis: siswa.nis,
                    nama: siswa.nama,
                    total_hari_aktif: totalHariAktif,
                    total_hadir: totalHadir,
                    total_izin: totalIzin,
                    total_alpha: totalAlpha,
                    persentase_hadir: persentaseHadir
                };
            });

            // Hitung statistik kelas
            const totalSiswa = siswaList.length;
            const totalHadirKelas = siswaRekap.reduce((sum, s) => sum + s.total_hadir, 0);
            const totalIzinKelas = siswaRekap.reduce((sum, s) => sum + s.total_izin, 0);
            const totalAlphaKelas = siswaRekap.reduce((sum, s) => sum + s.total_alpha, 0);
            const totalHariAktifKelas = siswaRekap.reduce((sum, s) => sum + s.total_hari_aktif, 0);
            const avgPersentase = totalSiswa > 0 ? Math.round(siswaRekap.reduce((sum, s) => sum + s.persentase_hadir, 0) / totalSiswa) : 0;

            return {
                kelas: {
                    id: kelas.id,
                    nama: kelas.nama,
                    jurusan: kelas.Jurusan?.nama || '-'
                },
                statistik: {
                    total_siswa: totalSiswa,
                    total_hadir: totalHadirKelas,
                    total_izin: totalIzinKelas,
                    total_alpha: totalAlphaKelas,
                    total_hari_aktif: totalHariAktifKelas,
                    rata_rata_persentase_hadir: avgPersentase
                },
                siswa: siswaRekap
            };
        });

        // Hitung statistik keseluruhan
        const totalSemuaSiswa = rekapPerKelas.reduce((sum, k) => sum + k.statistik.total_siswa, 0);
        const totalSemuaHadir = rekapPerKelas.reduce((sum, k) => sum + k.statistik.total_hadir, 0);
        const totalSemuaIzin = rekapPerKelas.reduce((sum, k) => sum + k.statistik.izin, 0);
        const totalSemuaAlpha = rekapPerKelas.reduce((sum, k) => sum + k.statistik.total_alpha, 0);
        const avgPersentaseKeseluruhan = rekapPerKelas.length > 0
            ? Math.round(rekapPerKelas.reduce((sum, k) => sum + k.statistik.rata_rata_persentase_hadir, 0) / rekapPerKelas.length)
            : 0;

        // Nama bulan
        const namaBulan = new Date(targetYear, targetMonth - 1, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

        res.json({
            success: true,
            data: {
                bulan: targetMonth,
                tahun: targetYear,
                nama_bulan: namaBulan,
                jumlah_hari: daysInMonth,
                statistik_keseluruhan: {
                    total_kelas: rekapPerKelas.length,
                    total_siswa: totalSemuaSiswa,
                    total_hadir: totalSemuaHadir,
                    total_izin: totalSemuaIzin,
                    total_alpha: totalSemuaAlpha,
                    rata_rata_persentase_hadir: avgPersentaseKeseluruhan
                },
                rekap_per_kelas: rekapPerKelas
            }
        });

    } catch (error) {
        console.error('Rekap bulanan error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// EXPORT REKAP NILAI BULANAN (PER MATA PELAJARAN)
router.get('/export/nilai-bulanan/excel', authMiddleware, async (req, res) => {
    try {
        const { bulan, kelas_id, mata_pelajaran } = req.query;
        if (!kelas_id || !mata_pelajaran || !bulan) {
            return res.status(400).json({ success: false, error: 'Parameter kelas_id, mata_pelajaran, dan bulan wajib diisi' });
        }

        const year = parseInt(bulan.split('-')[0]);
        const month = parseInt(bulan.split('-')[1]); // month is 1-based

        if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
             return res.status(400).json({ success: false, error: 'Format bulan tidak valid. Harusnya YYYY-MM' });
        }

        const startOfMonth = new Date(year, month - 1, 1);
        const endOfMonth = new Date(year, month, 0);

        const kelas = await Kelas.findByPk(kelas_id, {
            include: [{ model: Siswa, order: [['nama', 'ASC']] }]
        });
        if (!kelas) {
            return res.status(404).json({ success: false, error: 'Kelas tidak ditemukan' });
        }

        const nilaiList = await Nilai.findAll({
            where: {
                kelas_id: kelas_id,
                mata_pelajaran: mata_pelajaran, // Filter by the specific subject
                tanggal: { [Op.between]: [startOfMonth, endOfMonth] }
            },
            order: [['siswa_id', 'ASC'], ['tanggal', 'ASC']]
        });

        // 1. Organize scores by student
        const dataBySiswa = new Map();
        for (const siswa of kelas.Siswas) {
            dataBySiswa.set(siswa.id, {
                info: siswa,
                scores: [],
                keterangan: []
            });
        }

        for (const nilai of nilaiList) {
            if (dataBySiswa.has(nilai.siswa_id)) {
                const siswaData = dataBySiswa.get(nilai.siswa_id);
                siswaData.scores.push(nilai.nilai);
                siswaData.keterangan.push(nilai.keterangan);
            }
        }
        
        // 2. Find max number of meetings for headers
        let maxPertemuan = 0;
        dataBySiswa.forEach(siswaData => {
            if (siswaData.scores.length > maxPertemuan) {
                maxPertemuan = siswaData.scores.length;
            }
        });

        // 3. Prepare Excel data
        const wb = XLSX.utils.book_new();
        const namaBulan = startOfMonth.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
        const wsData = [];
        
        // Headers
        const staticHeaders = ['No', 'NIS', 'Nama Siswa'];
        const pertemuanHeaders = maxPertemuan > 0 ? Array.from({ length: maxPertemuan }, (_, i) => `P${i + 1}`) : [];
        const finalHeaders = ['Rata-rata', 'Keterangan'];
        const headers = [...staticHeaders, ...pertemuanHeaders, ...finalHeaders];
        
        wsData.push([`REKAPITULASI NILAI - ${mata_pelajaran.toUpperCase()}`]);
        wsData.push([`Kelas: ${kelas.nama} | Periode: ${namaBulan}`]);
        wsData.push([]); // Spacer
        wsData.push(headers);

        // 4. Populate rows (one row per student)
        let noSiswa = 1;
        for (const siswa of kelas.Siswas) {
            const siswaData = dataBySiswa.get(siswa.id);
            const scores = siswaData.scores;
            const totalNilai = scores.reduce((sum, score) => sum + score, 0);
            const rataRata = scores.length > 0 ? (totalNilai / scores.length).toFixed(2) : 0;
            
            const row = [noSiswa++, siswa.nis, siswa.nama];

            // Add scores, padding with '' if less than maxPertemuan
            for (let i = 0; i < maxPertemuan; i++) {
                row.push(scores[i] !== undefined ? scores[i] : '');
            }
            
            row.push(rataRata, siswaData.keterangan.join(', '));
            wsData.push(row);
        }

        const ws = XLSX.utils.aoa_to_sheet(wsData);

        // Merges & Column Widths
        ws['!merges'] = [
            { s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } },
            { s: { r: 1, c: 0 }, e: { r: 1, c: headers.length - 1 } }
        ];
        
        const colWidths = [{ wch: 5 }, { wch: 15 }, { wch: 30 }]; // No, NIS, Nama
        for (let i = 0; i < maxPertemuan; i++) colWidths.push({ wch: 5 }); // P1, P2...
        colWidths.push({ wch: 10 }, { wch: 40 }); // Rata-rata, Keterangan
        ws['!cols'] = colWidths;
        
        XLSX.utils.book_append_sheet(wb, ws, `Rekap Nilai`);

        const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=rekap_nilai_${kelas.nama}_${mata_pelajaran}_${year}_${month.toString().padStart(2, '0')}.xlsx`);
        res.send(buffer);

    } catch (error) {
        console.error('Export rekap nilai error:', error);
        res.status(500).json({ success: false, error: 'Gagal membuat rekap nilai: ' + error.message });
    }
});

// Export rekap bulanan ke Excel
router.get('/export/bulanan/excel', authMiddleware, adminOnly, async (req, res) => {
    try {
        const { bulan, tahun, kelas_id, jurusan_id } = req.query;
        const { targetMonth, targetYear, daysInMonth, kelasList, absensiList } = await getRekapBulananData(bulan, tahun, kelas_id, jurusan_id);

        const wb = XLSX.utils.book_new();
        const namaBulan = new Date(targetYear, targetMonth - 1, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

        // --- Headers ---
        const staticHeaders = ['No', 'Kelas', 'NIS', 'Nama Siswa'];
        const dateHeaders = Array.from({ length: daysInMonth }, (_, i) => (i + 1).toString());
        const totalHeaders = ['Jml Hadir', 'Jml Izin', 'Jml Alpha'];
        const headers = [...staticHeaders, ...dateHeaders, ...totalHeaders];

        // --- Add day names for each date column ---
        const dayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
        const dayNameRow = Array(staticHeaders.length).fill(''); // Empty cells for static headers
        for (let i = 1; i <= daysInMonth; i++) {
            const date = new Date(targetYear, targetMonth - 1, i);
            dayNameRow.push(dayNames[date.getDay()]);
        }
        dayNameRow.push(...Array(totalHeaders.length).fill('')); // Empty cells for total headers

        // --- Data Rows ---
        const rekapData = [
            ['REKAP ABSENSI BULANAN'],
            [`Periode: ${namaBulan}`],
            dayNameRow, // New row for day names
            headers
        ];

        let noSiswa = 1;
        
        kelasList.forEach((kelas) => {
            const siswaList = kelas.Siswas || [];
            if (siswaList.length === 0) return;

            const kelasAbsensi = absensiList.filter(a => a.kelas_id_saat_absen === kelas.id);

            siswaList.forEach(siswa => {
                const absensiSiswa = kelasAbsensi.filter(a => a.siswa_id === siswa.id);
                const absensiPerTanggal = new Map();
                absensiSiswa.forEach(a => {
                    const tanggalJurnal = new Date(a.Jurnal.tanggal);
                    const tgl = tanggalJurnal.getDate(); // Get day of the month (1-31)
                    if (!absensiPerTanggal.has(tgl)) absensiPerTanggal.set(tgl, []);
                    absensiPerTanggal.get(tgl).push(a);
                });

                const dateRow = Array(daysInMonth).fill(''); // Array for dates 1 to 31
                let totalHadir = 0;
                let totalIzin = 0;
                let totalAlpha = 0;

                absensiPerTanggal.forEach((absensiHari, tgl) => {
                    let statusHari = '';
                    if (absensiHari.some(a => a.status === 'tanpa_ket')) {
                        statusHari = 'A';
                        totalAlpha++;
                    } else if (absensiHari.some(a => a.status === 'izin')) {
                        statusHari = 'I';
                        totalIzin++;
                    } else {
                        statusHari = 'H';
                        totalHadir++;
                    }
                    if (tgl > 0 && tgl <= daysInMonth) {
                        dateRow[tgl - 1] = statusHari;
                    }
                });

                const studentRow = [
                    noSiswa++,
                    kelas.nama,
                    siswa.nis,
                    siswa.nama
                ];
                
                rekapData.push([...studentRow, ...dateRow, totalHadir, totalIzin, totalAlpha]);
            });
        });

        // --- Create and Send Workbook ---
        const ws = XLSX.utils.aoa_to_sheet(rekapData);

        // Styling
        const colWidths = [
            { wch: 5 }, { wch: 15 }, { wch: 15 }, { wch: 30 }, 
            ...Array(daysInMonth).fill({ wch: 3 }), // Width for date columns
            { wch: 10 }, { wch: 10 }, { wch: 10 } // Width for total columns
        ];
        ws['!cols'] = colWidths;
        ws['!merges'] = [ 
            { s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 + staticHeaders.length -1 } }, // Adjust merge for title to span all columns
            { s: { r: 1, c: 0 }, e: { r: 1, c: headers.length - 1 + staticHeaders.length -1 } }  // Adjust merge for period to span all columns
        ];
        // The headers variable already includes staticHeaders.length in its size.
        // So headers.length - 1 is the index of the last header column.
        // The total number of columns is headers.length.
        // The original merges used headers.length - 1 for the end column.
        // Now, we added a new row, and the headers array already accounts for all headers.
        // The length of the headers array is staticHeaders.length + dateHeaders.length + totalHeaders.length.
        // So, the last column index is headers.length - 1.
        // The merge should span to headers.length - 1.

        XLSX.utils.book_append_sheet(wb, ws, 'Rekap Bulanan');
        
        const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=rekap_bulanan_detail_${targetYear}_${targetMonth.toString().padStart(2, '0')}.xlsx`);
        res.send(buffer);

    } catch (error) {
        console.error('Export bulanan Excel error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get list kelas untuk filter
router.get('/filter-options', authMiddleware, adminOnly, async (req, res) => {
    try {
        const kelasList = await Kelas.findAll({
            attributes: ['id', 'nama'],
            include: [{
                model: Jurusan,
                attributes: ['id', 'nama', 'singkatan'],
                required: false
            }],
            order: [['nama', 'ASC']]
        });

        const jurusanList = await Jurusan.findAll({
            attributes: ['id', 'nama', 'singkatan'],
            order: [['nama', 'ASC']]
        });

        res.json({
            success: true,
            data: {
                kelas: kelasList,
                jurusan: jurusanList
            }
        });
    } catch (error) {
        console.error('Filter options error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get Mapel options for filter
router.get('/filter-options/mapel', authMiddleware, async (req, res) => {
    try {
        const { kelas_id, bulan } = req.query;
        if (!kelas_id || !bulan) {
            return res.status(400).json({ success: false, error: 'Parameter kelas_id dan bulan wajib diisi.' });
        }

        const targetYear = parseInt(bulan.split('-')[0]);
        const targetMonth = parseInt(bulan.split('-')[1]);
        const startOfMonth = new Date(targetYear, targetMonth - 1, 1);
        const endOfMonth = new Date(targetYear, targetMonth, 0);

        const uniqueMapel = await Nilai.findAll({
            attributes: [
                [sequelize.fn('DISTINCT', sequelize.col('mata_pelajaran')), 'mata_pelajaran']
            ],
            where: {
                kelas_id: kelas_id,
                tanggal: { [Op.between]: [startOfMonth, endOfMonth] }
            }
        });

        const mapelList = uniqueMapel.map(item => item.mata_pelajaran);

        res.json({ success: true, data: mapelList });
    } catch (error) {
        console.error('Filter mapel options error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});


// Rekap menyeluruh - ringkasan semua kelas dengan statistik global
router.get('/menyeluruh', authMiddleware, adminOnly, async (req, res) => {
    try {
        const { tanggal, jurusan_id } = req.query;
        const { targetDate, kelasList, absensiList, startOfDay, endOfDay } = await getRekapData(tanggal, null, jurusan_id);

        // Organize data per kelas dengan statistik
        const rekapPerKelas = kelasList.map(kelas => {
            const siswaList = kelas.Siswas || [];
            if (siswaList.length === 0) return null;

            const kelasAbsensi = absensiList.filter(a => a.kelas_id_saat_absen === kelas.id);

            // Get unique siswa yang sudah absen
            const siswaAbsenIds = new Set(kelasAbsensi.map(a => a.siswa_id));

            const hadirCount = siswaList.filter(s => {
                const absensiSiswa = kelasAbsensi.filter(a => a.siswa_id === s.id);
                return absensiSiswa.length > 0 && absensiSiswa.every(a => a.status === 'hadir');
            }).length;

            const izinCount = siswaList.filter(s => {
                const absensiSiswa = kelasAbsensi.filter(a => a.siswa_id === s.id);
                return absensiSiswa.some(a => a.status === 'izin') && !absensiSiswa.some(a => a.status === 'tanpa_ket');
            }).length;

            const alphaCount = siswaList.filter(s => {
                const absensiSiswa = kelasAbsensi.filter(a => a.siswa_id === s.id);
                return absensiSiswa.some(a => a.status === 'tanpa_ket');
            }).length;

            const belumAbsen = siswaList.filter(s => !siswaAbsenIds.has(s.id)).length;
            const persen = siswaList.length > 0 ? Math.round((hadirCount / siswaList.length) * 100) : 0;

            return {
                kelas_id: kelas.id,
                kelas_nama: kelas.nama,
                jurusan: kelas.Jurusan ? {
                    id: kelas.Jurusan.id,
                    nama: kelas.Jurusan.nama,
                    singkatan: kelas.Jurusan.singkatan
                } : null,
                total_siswa: siswaList.length,
                hadir: hadirCount,
                izin: izinCount,
                alpha: alphaCount,
                belum_absen: belumAbsen,
                persentase_hadir: persen
            };
        }).filter(Boolean);

        // Hitung statistik keseluruhan
        const totalSiswa = rekapPerKelas.reduce((sum, k) => sum + k.total_siswa, 0);
        const totalHadir = rekapPerKelas.reduce((sum, k) => sum + k.hadir, 0);
        const totalIzin = rekapPerKelas.reduce((sum, k) => sum + k.izin, 0);
        const totalAlpha = rekapPerKelas.reduce((sum, k) => sum + k.alpha, 0);
        const totalBelum = rekapPerKelas.reduce((sum, k) => sum + k.belum_absen, 0);
        const persenKeseluruhan = totalSiswa > 0 ? Math.round((totalHadir / totalSiswa) * 100) : 0;

        res.json({
            success: true,
            data: {
                tanggal: targetDate.toISOString().split('T')[0],
                tanggal_formatted: targetDate.toLocaleDateString('id-ID', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                }),
                statistik_keseluruhan: {
                    total_kelas: rekapPerKelas.length,
                    total_siswa: totalSiswa,
                    hadir: totalHadir,
                    izin: totalIzin,
                    alpha: totalAlpha,
                    belum_absen: totalBelum,
                    persentase_hadir: persenKeseluruhan
                },
                rekap_per_kelas: rekapPerKelas
            }
        });
    } catch (error) {
        console.error('Rekap menyeluruh error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
// Rekap per kelas - detail semua siswa dalam satu kelas dengan persentase
router.get('/per-kelas/:kelas_id', authMiddleware, adminOnly, async (req, res) => {
    try {
        const { kelas_id } = req.params;
        const { bulan, tahun } = req.query;

        // Parse bulan dan tahun
        const targetMonth = parseInt(bulan) || (new Date().getMonth() + 1);
        const targetYear = parseInt(tahun) || new Date().getFullYear();

        // Tanggal awal dan akhir bulan
        const startOfMonth = new Date(targetYear, targetMonth - 1, 1);
        startOfMonth.setHours(0, 0, 0, 0);
        const endOfMonth = new Date(targetYear, targetMonth, 0);
        endOfMonth.setHours(23, 59, 59, 999);

        // Get kelas dengan siswa
        const kelas = await Kelas.findByPk(kelas_id, {
            include: [
                {
                    model: Jurusan,
                    attributes: ['id', 'nama', 'singkatan'],
                    required: false
                },
                {
                    model: Siswa,
                    attributes: ['id', 'nis', 'nama', 'kelamin'],
                    required: false
                }
            ]
        });

        if (!kelas) {
            return res.status(404).json({ success: false, error: 'Kelas tidak ditemukan' });
        }

        // Get semua jurnal pada bulan tersebut untuk kelas ini
        const jurnalList = await Jurnal.findAll({
            where: {
                kelas_id: kelas_id,
                tanggal: {
                    [Op.between]: [startOfMonth, endOfMonth]
                }
            },
            include: [
                {
                    model: Guru,
                    as: 'Guru',
                    attributes: ['nama', 'mapel']
                },
                {
                    model: Absensi,
                    include: [{
                        model: Siswa,
                        attributes: ['id', 'nis', 'nama']
                    }]
                }
            ]
        });

        // Flatten absensi dari jurnal
        const absensiList = [];
        jurnalList.forEach(jurnal => {
            if (jurnal.Absensis) {
                jurnal.Absensis.forEach(absensi => {
                    absensiList.push({
                        ...absensi.toJSON(),
                        Jurnal: {
                            id: jurnal.id,
                            mata_pelajaran: jurnal.mata_pelajaran,
                            tanggal: jurnal.tanggal,
                            Guru: jurnal.Guru
                        }
                    });
                });
            }
        });

        // Map siswa dengan rekap bulanan
        const siswaList = kelas.siswa || [];
        const siswaRekap = siswaList.map(siswa => {
            const absensiSiswa = absensiList.filter(a => a.siswa_id === siswa.id);

            // Group absensi per tanggal
            const absensiPerTanggal = {};
            absensiSiswa.forEach(a => {
                const tgl = new Date(a.Jurnal.tanggal).toISOString().split('T')[0];
                if (!absensiPerTanggal[tgl]) {
                    absensiPerTanggal[tgl] = [];
                }
                absensiPerTanggal[tgl].push(a);
            });

            // Hitung total per status untuk seluruh bulan
            let totalHadir = 0;
            let totalIzin = 0;
            let totalAlpha = 0;
            let totalHariAktif = Object.keys(absensiPerTanggal).length;

            // Tentukan status per hari
            Object.keys(absensiPerTanggal).forEach(tgl => {
                const absensiHari = absensiPerTanggal[tgl];
                const hasAlpha = absensiHari.some(a => a.status === 'tanpa_ket');
                const hasIzin = absensiHari.some(a => a.status === 'izin');

                if (hasAlpha) {
                    totalAlpha++;
                } else if (hasIzin) {
                    totalIzin++;
                } else {
                    totalHadir++;
                }
            });

            // Persentase kehadiran
            const persentaseHadir = totalHariAktif > 0 ? Math.round((totalHadir / totalHariAktif) * 100) : 0;

            return {
                id: siswa.id,
                nis: siswa.nis,
                nama: siswa.nama,
                kelamin: siswa.kelamin,
                total_hari_aktif: totalHariAktif,
                total_hadir: totalHadir,
                total_izin: totalIzin,
                total_alpha: totalAlpha,
                persentase_hadir: persentaseHadir
            };
        });

        // Hitung statistik kelas
        const totalSiswa = siswaList.length;
        const totalHadirKelas = siswaRekap.reduce((sum, s) => sum + s.total_hadir, 0);
        const totalIzinKelas = siswaRekap.reduce((sum, s) => sum + s.total_izin, 0);
        const totalAlphaKelas = siswaRekap.reduce((sum, s) => sum + s.total_alpha, 0);
        const totalHariAktifKelas = siswaRekap.reduce((sum, s) => sum + s.total_hari_aktif, 0);
        const avgPersentase = totalSiswa > 0 ? Math.round(siswaRekap.reduce((sum, s) => sum + s.persentase_hadir, 0) / totalSiswa) : 0;

        // Nama bulan
        const namaBulan = new Date(targetYear, targetMonth - 1, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

        res.json({
            success: true,
            data: {
                kelas: {
                    id: kelas.id,
                    nama: kelas.nama,
                    tingkat: kelas.tingkat,
                    tahun_ajaran: kelas.tahun_ajaran,
                    jurusan: kelas.Jurusan ? {
                        id: kelas.Jurusan.id,
                        nama: kelas.Jurusan.nama,
                        singkatan: kelas.Jurusan.singkatan
                    } : null
                },
                periode: {
                    bulan: targetMonth,
                    tahun: targetYear,
                    nama_bulan: namaBulan
                },
                statistik: {
                    total_siswa: totalSiswa,
                    total_hadir: totalHadirKelas,
                    total_izin: totalIzinKelas,
                    total_alpha: totalAlphaKelas,
                    total_hari_aktif: totalHariAktifKelas,
                    rata_rata_persentase_hadir: avgPersentase
                },
                siswa: siswaRekap
            }
        });
    } catch (error) {
        console.error('Rekap per kelas error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
