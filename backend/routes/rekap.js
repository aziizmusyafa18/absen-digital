const express = require('express');
const router = express.Router();
const XLSX = require('xlsx');
const PDFDocument = require('pdfkit');
const { authMiddleware, adminOnly } = require('../middleware/auth');
const { Absensi, Siswa, Kelas, Jurnal, Guru, Jurusan } = require('../models');
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
                attributes: ['id', 'nis', 'nama'],
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
                    attributes: ['id', 'nis', 'nama', 'kelas_id']
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
                        jam_mulai: jurnal.jam_mulai,
                        tanggal: jurnal.tanggal,
                        Guru: jurnal.Guru
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
        const { targetDate, kelasList, absensiList } = await getRekapData(tanggal, kelas_id, jurusan_id);

        // Organize data per kelas
        const rekapPerKelas = kelasList.map(kelas => {
            const siswaList = kelas.Siswas || [];

            // Get absensi untuk kelas ini
            const kelasAbsensi = absensiList.filter(a =>
                a.Siswa && a.Siswa.kelas_id === kelas.id
            );

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
            });

            // Hitung statistik kelas
            const totalSiswa = siswaList.length;
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

        // Create workbook
        const wb = XLSX.utils.book_new();

        // Format tanggal untuk nama file
        const tanggalStr = targetDate.toISOString().split('T')[0];
        const tanggalFormatted = targetDate.toLocaleDateString('id-ID', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        // Sheet 1: Ringkasan
        const ringkasanData = [
            ['REKAP ABSENSI HARIAN'],
            [`Tanggal: ${tanggalFormatted}`],
            [],
            ['No', 'Kelas', 'Jurusan', 'Total Siswa', 'Hadir', 'Izin', 'Alpha', 'Belum Absen', '% Hadir']
        ];

        let totalSiswa = 0, totalHadir = 0, totalIzin = 0, totalAlpha = 0, totalBelum = 0;

        kelasList.forEach((kelas, index) => {
            const siswaList = kelas.Siswas || [];
            const kelasAbsensi = absensiList.filter(a => a.Siswa && a.Siswa.kelas_id === kelas.id);

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

            totalSiswa += siswaList.length;
            totalHadir += hadirCount;
            totalIzin += izinCount;
            totalAlpha += alphaCount;
            totalBelum += belumAbsen;

            ringkasanData.push([
                index + 1,
                kelas.nama,
                kelas.Jurusan?.nama || '-',
                siswaList.length,
                hadirCount,
                izinCount,
                alphaCount,
                belumAbsen,
                `${persen}%`
            ]);
        });

        // Total row
        const totalPersen = totalSiswa > 0 ? Math.round((totalHadir / totalSiswa) * 100) : 0;
        ringkasanData.push([]);
        ringkasanData.push(['', 'TOTAL', '', totalSiswa, totalHadir, totalIzin, totalAlpha, totalBelum, `${totalPersen}%`]);

        const wsRingkasan = XLSX.utils.aoa_to_sheet(ringkasanData);
        wsRingkasan['!cols'] = [
            { wch: 5 }, { wch: 15 }, { wch: 20 }, { wch: 12 },
            { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 12 }, { wch: 10 }
        ];
        // Merge title cells
        wsRingkasan['!merges'] = [
            { s: { r: 0, c: 0 }, e: { r: 0, c: 8 } },
            { s: { r: 1, c: 0 }, e: { r: 1, c: 8 } }
        ];
        XLSX.utils.book_append_sheet(wb, wsRingkasan, 'Ringkasan');

        // Sheet per kelas dengan detail siswa
        kelasList.forEach(kelas => {
            const siswaList = kelas.Siswas || [];
            if (siswaList.length === 0) return;

            const kelasAbsensi = absensiList.filter(a => a.Siswa && a.Siswa.kelas_id === kelas.id);

            const detailData = [
                [`REKAP ABSENSI - ${kelas.nama}`],
                [`Jurusan: ${kelas.Jurusan?.nama || '-'}`],
                [`Tanggal: ${tanggalFormatted}`],
                [],
                ['No', 'NIS', 'Nama Siswa', 'Status', 'Keterangan']
            ];

            siswaList.forEach((siswa, index) => {
                const absensiSiswa = kelasAbsensi.filter(a => a.siswa_id === siswa.id);
                let status = 'Belum Absen';
                let keterangan = '-';

                if (absensiSiswa.length > 0) {
                    const hasAlpha = absensiSiswa.some(a => a.status === 'tanpa_ket');
                    const hasIzin = absensiSiswa.some(a => a.status === 'izin');

                    if (hasAlpha) {
                        status = 'Alpha';
                        const alphaAbsen = absensiSiswa.find(a => a.status === 'tanpa_ket');
                        keterangan = alphaAbsen?.keterangan || '-';
                    } else if (hasIzin) {
                        status = 'Izin';
                        const izinAbsen = absensiSiswa.find(a => a.status === 'izin');
                        keterangan = izinAbsen?.keterangan || '-';
                    } else {
                        status = 'Hadir';
                        keterangan = `${absensiSiswa.length} mapel`;
                    }
                }

                detailData.push([
                    index + 1,
                    siswa.nis,
                    siswa.nama,
                    status,
                    keterangan
                ]);
            });

            const wsDetail = XLSX.utils.aoa_to_sheet(detailData);
            wsDetail['!cols'] = [
                { wch: 5 }, { wch: 15 }, { wch: 30 }, { wch: 15 }, { wch: 25 }
            ];
            wsDetail['!merges'] = [
                { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } },
                { s: { r: 1, c: 0 }, e: { r: 1, c: 4 } },
                { s: { r: 2, c: 0 }, e: { r: 2, c: 4 } }
            ];

            // Nama sheet max 31 karakter
            const sheetName = kelas.nama.substring(0, 31).replace(/[\\\/\*\?\[\]:]/g, '');
            XLSX.utils.book_append_sheet(wb, wsDetail, sheetName);
        });

        // Generate buffer
        const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=rekap_absensi_${tanggalStr}.xlsx`);
        res.send(buffer);

    } catch (error) {
        console.error('Export Excel error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Export rekap ke PDF
router.get('/export/pdf', authMiddleware, adminOnly, async (req, res) => {
    try {
        const { tanggal, kelas_id, jurusan_id } = req.query;
        const { targetDate, kelasList, absensiList } = await getRekapData(tanggal, kelas_id, jurusan_id);

        // Format tanggal
        const tanggalStr = targetDate.toISOString().split('T')[0];
        const tanggalFormatted = targetDate.toLocaleDateString('id-ID', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        // Create PDF
        const doc = new PDFDocument({
            margin: 50,
            size: 'A4',
            bufferPages: true
        });

        // Collect chunks
        const chunks = [];
        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => {
            const pdfBuffer = Buffer.concat(chunks);
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=rekap_absensi_${tanggalStr}.pdf`);
            res.send(pdfBuffer);
        });

        // Title
        doc.fontSize(18).font('Helvetica-Bold').text('REKAP ABSENSI HARIAN', { align: 'center' });
        doc.fontSize(12).font('Helvetica').text(`Tanggal: ${tanggalFormatted}`, { align: 'center' });
        doc.moveDown(2);

        // Ringkasan Table Header
        doc.fontSize(14).font('Helvetica-Bold').text('RINGKASAN PER KELAS');
        doc.moveDown(0.5);

        // Table settings
        const tableTop = doc.y;
        const tableLeft = 50;
        const colWidths = [30, 80, 60, 50, 50, 50, 60, 60];
        const headers = ['No', 'Kelas', 'Jurusan', 'Siswa', 'Hadir', 'Izin', 'Alpha', '% Hadir'];

        // Draw header
        doc.fontSize(10).font('Helvetica-Bold');
        let xPos = tableLeft;
        headers.forEach((header, i) => {
            doc.text(header, xPos, tableTop, { width: colWidths[i], align: 'center' });
            xPos += colWidths[i];
        });

        // Draw header line
        doc.moveTo(tableLeft, tableTop + 15).lineTo(tableLeft + colWidths.reduce((a, b) => a + b, 0), tableTop + 15).stroke();

        // Table data
        let yPos = tableTop + 20;
        let totalSiswa = 0, totalHadir = 0, totalIzin = 0, totalAlpha = 0;

        doc.font('Helvetica').fontSize(9);

        kelasList.forEach((kelas, index) => {
            const siswaList = kelas.Siswas || [];
            const kelasAbsensi = absensiList.filter(a => a.Siswa && a.Siswa.kelas_id === kelas.id);

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

            const persen = siswaList.length > 0 ? Math.round((hadirCount / siswaList.length) * 100) : 0;

            totalSiswa += siswaList.length;
            totalHadir += hadirCount;
            totalIzin += izinCount;
            totalAlpha += alphaCount;

            // Check if need new page
            if (yPos > 700) {
                doc.addPage();
                yPos = 50;
            }

            xPos = tableLeft;
            const rowData = [
                (index + 1).toString(),
                kelas.nama,
                (kelas.Jurusan?.singkatan || '-'),
                siswaList.length.toString(),
                hadirCount.toString(),
                izinCount.toString(),
                alphaCount.toString(),
                `${persen}%`
            ];

            rowData.forEach((data, i) => {
                doc.text(data, xPos, yPos, { width: colWidths[i], align: 'center' });
                xPos += colWidths[i];
            });

            yPos += 15;
        });

        // Total row
        doc.moveTo(tableLeft, yPos).lineTo(tableLeft + colWidths.reduce((a, b) => a + b, 0), yPos).stroke();
        yPos += 5;

        doc.font('Helvetica-Bold');
        const totalPersen = totalSiswa > 0 ? Math.round((totalHadir / totalSiswa) * 100) : 0;
        xPos = tableLeft;
        const totalRowData = ['', 'TOTAL', '', totalSiswa.toString(), totalHadir.toString(), totalIzin.toString(), totalAlpha.toString(), `${totalPersen}%`];
        totalRowData.forEach((data, i) => {
            doc.text(data, xPos, yPos, { width: colWidths[i], align: 'center' });
            xPos += colWidths[i];
        });

        // Detail per kelas
        kelasList.forEach(kelas => {
            const siswaList = kelas.Siswas || [];
            if (siswaList.length === 0) return;

            const kelasAbsensi = absensiList.filter(a => a.Siswa && a.Siswa.kelas_id === kelas.id);

            // New page for each class
            doc.addPage();

            // Class header
            doc.fontSize(14).font('Helvetica-Bold').text(`DETAIL ABSENSI - ${kelas.nama}`, { align: 'center' });
            doc.fontSize(10).font('Helvetica').text(`Jurusan: ${kelas.Jurusan?.nama || '-'}`, { align: 'center' });
            doc.text(`Tanggal: ${tanggalFormatted}`, { align: 'center' });
            doc.moveDown(1);

            // Detail table
            const detailTop = doc.y;
            const detailLeft = 50;
            const detailWidths = [30, 70, 180, 70, 100];
            const detailHeaders = ['No', 'NIS', 'Nama Siswa', 'Status', 'Keterangan'];

            // Draw header
            doc.fontSize(10).font('Helvetica-Bold');
            xPos = detailLeft;
            detailHeaders.forEach((header, i) => {
                doc.text(header, xPos, detailTop, { width: detailWidths[i], align: i === 2 ? 'left' : 'center' });
                xPos += detailWidths[i];
            });

            doc.moveTo(detailLeft, detailTop + 15).lineTo(detailLeft + detailWidths.reduce((a, b) => a + b, 0), detailTop + 15).stroke();

            yPos = detailTop + 20;
            doc.font('Helvetica').fontSize(9);

            siswaList.forEach((siswa, index) => {
                const absensiSiswa = kelasAbsensi.filter(a => a.siswa_id === siswa.id);
                let status = 'Belum Absen';
                let keterangan = '-';

                if (absensiSiswa.length > 0) {
                    const hasAlpha = absensiSiswa.some(a => a.status === 'tanpa_ket');
                    const hasIzin = absensiSiswa.some(a => a.status === 'izin');

                    if (hasAlpha) {
                        status = 'Alpha';
                        const alphaAbsen = absensiSiswa.find(a => a.status === 'tanpa_ket');
                        keterangan = alphaAbsen?.keterangan || '-';
                    } else if (hasIzin) {
                        status = 'Izin';
                        const izinAbsen = absensiSiswa.find(a => a.status === 'izin');
                        keterangan = izinAbsen?.keterangan || '-';
                    } else {
                        status = 'Hadir';
                        keterangan = `${absensiSiswa.length} mapel`;
                    }
                }

                // Check if need new page
                if (yPos > 750) {
                    doc.addPage();
                    yPos = 50;

                    // Redraw header on new page
                    doc.fontSize(10).font('Helvetica-Bold');
                    xPos = detailLeft;
                    detailHeaders.forEach((header, i) => {
                        doc.text(header, xPos, yPos, { width: detailWidths[i], align: i === 2 ? 'left' : 'center' });
                        xPos += detailWidths[i];
                    });
                    doc.moveTo(detailLeft, yPos + 15).lineTo(detailLeft + detailWidths.reduce((a, b) => a + b, 0), yPos + 15).stroke();
                    yPos += 20;
                    doc.font('Helvetica').fontSize(9);
                }

                xPos = detailLeft;
                const rowData = [
                    (index + 1).toString(),
                    siswa.nis,
                    siswa.nama,
                    status,
                    (keterangan || '-').substring(0, 20)
                ];

                rowData.forEach((data, i) => {
                    doc.text(data || '-', xPos, yPos, { width: detailWidths[i], align: i === 2 ? 'left' : 'center' });
                    xPos += detailWidths[i];
                });

                yPos += 15;
            });

            // Summary for this class
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

            yPos += 10;
            doc.moveTo(detailLeft, yPos).lineTo(detailLeft + detailWidths.reduce((a, b) => a + b, 0), yPos).stroke();
            yPos += 10;

            doc.font('Helvetica-Bold').fontSize(10);
            doc.text(`Total: ${siswaList.length} siswa | Hadir: ${hadirCount} | Izin: ${izinCount} | Alpha: ${alphaCount} | Belum Absen: ${belumAbsen}`, detailLeft, yPos);
        });

        // Finalize PDF
        doc.end();

    } catch (error) {
        console.error('Export PDF error:', error);
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
                        jam_mulai: jurnal.jam_mulai,
                        tanggal: jurnal.tanggal,
                        Guru: jurnal.Guru
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
                a.Siswa && a.Siswa.kelas_id === kelas.id
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
        const totalSemuaIzin = rekapPerKelas.reduce((sum, k) => sum + k.statistik.total_izin, 0);
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

// Export rekap bulanan ke Excel
router.get('/export/bulanan/excel', authMiddleware, adminOnly, async (req, res) => {
    try {
        const { bulan, tahun, kelas_id, jurusan_id } = req.query;
        const { targetMonth, targetYear, daysInMonth, kelasList, absensiList } = await getRekapBulananData(bulan, tahun, kelas_id, jurusan_id);

        // Create workbook
        const wb = XLSX.utils.book_new();

        // Format bulan untuk nama file dan header
        const namaBulan = new Date(targetYear, targetMonth - 1, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

        // Sheet 1: Ringkasan
        const ringkasanData = [
            ['REKAP ABSENSI BULANAN'],
            [`Periode: ${namaBulan}`],
            [],
            ['No', 'Kelas', 'Jurusan', 'Total Siswa', 'Total Hadir', 'Total Izin', 'Total Alpha', 'Rata-rata % Hadir']
        ];

        let grandTotalSiswa = 0, grandTotalHadir = 0, grandTotalIzin = 0, grandTotalAlpha = 0;
        let totalPersentase = 0;

        kelasList.forEach((kelas, index) => {
            const siswaList = kelas.Siswas || [];
            const kelasAbsensi = absensiList.filter(a => a.Siswa && a.Siswa.kelas_id === kelas.id);

            let totalHadir = 0, totalIzin = 0, totalAlpha = 0;

            siswaList.forEach(siswa => {
                const absensiSiswa = kelasAbsensi.filter(a => a.siswa_id === siswa.id);

                // Group per tanggal
                const absensiPerTanggal = {};
                absensiSiswa.forEach(a => {
                    const tgl = new Date(a.Jurnal.tanggal).toISOString().split('T')[0];
                    if (!absensiPerTanggal[tgl]) absensiPerTanggal[tgl] = [];
                    absensiPerTanggal[tgl].push(a);
                });

                Object.keys(absensiPerTanggal).forEach(tgl => {
                    const absensiHari = absensiPerTanggal[tgl];
                    if (absensiHari.some(a => a.status === 'tanpa_ket')) {
                        totalAlpha++;
                    } else if (absensiHari.some(a => a.status === 'izin')) {
                        totalIzin++;
                    } else {
                        totalHadir++;
                    }
                });
            });

            const totalHariAktif = totalHadir + totalIzin + totalAlpha;
            const persen = totalHariAktif > 0 ? Math.round((totalHadir / totalHariAktif) * 100) : 0;

            grandTotalSiswa += siswaList.length;
            grandTotalHadir += totalHadir;
            grandTotalIzin += totalIzin;
            grandTotalAlpha += totalAlpha;
            totalPersentase += persen;

            ringkasanData.push([
                index + 1,
                kelas.nama,
                kelas.Jurusan?.nama || '-',
                siswaList.length,
                totalHadir,
                totalIzin,
                totalAlpha,
                `${persen}%`
            ]);
        });

        // Total row
        const avgPersen = kelasList.length > 0 ? Math.round(totalPersentase / kelasList.length) : 0;
        ringkasanData.push([]);
        ringkasanData.push(['', 'TOTAL', '', grandTotalSiswa, grandTotalHadir, grandTotalIzin, grandTotalAlpha, `${avgPersen}%`]);

        const wsRingkasan = XLSX.utils.aoa_to_sheet(ringkasanData);
        wsRingkasan['!cols'] = [
            { wch: 5 }, { wch: 15 }, { wch: 25 }, { wch: 12 },
            { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 18 }
        ];
        wsRingkasan['!merges'] = [
            { s: { r: 0, c: 0 }, e: { r: 0, c: 7 } },
            { s: { r: 1, c: 0 }, e: { r: 1, c: 7 } }
        ];
        XLSX.utils.book_append_sheet(wb, wsRingkasan, 'Ringkasan');

        // Sheet per kelas dengan detail siswa
        kelasList.forEach(kelas => {
            const siswaList = kelas.Siswas || [];
            if (siswaList.length === 0) return;

            const kelasAbsensi = absensiList.filter(a => a.Siswa && a.Siswa.kelas_id === kelas.id);

            const detailData = [
                [`REKAP ABSENSI BULANAN - ${kelas.nama}`],
                [`Jurusan: ${kelas.Jurusan?.nama || '-'}`],
                [`Periode: ${namaBulan}`],
                [],
                ['No', 'NIS', 'Nama Siswa', 'Hari Aktif', 'Hadir', 'Izin', 'Alpha', '% Hadir']
            ];

            siswaList.forEach((siswa, index) => {
                const absensiSiswa = kelasAbsensi.filter(a => a.siswa_id === siswa.id);

                // Group per tanggal
                const absensiPerTanggal = {};
                absensiSiswa.forEach(a => {
                    const tgl = new Date(a.Jurnal.tanggal).toISOString().split('T')[0];
                    if (!absensiPerTanggal[tgl]) absensiPerTanggal[tgl] = [];
                    absensiPerTanggal[tgl].push(a);
                });

                let hadir = 0, izin = 0, alpha = 0;
                Object.keys(absensiPerTanggal).forEach(tgl => {
                    const absensiHari = absensiPerTanggal[tgl];
                    if (absensiHari.some(a => a.status === 'tanpa_ket')) {
                        alpha++;
                    } else if (absensiHari.some(a => a.status === 'izin')) {
                        izin++;
                    } else {
                        hadir++;
                    }
                });

                const hariAktif = hadir + izin + alpha;
                const persen = hariAktif > 0 ? Math.round((hadir / hariAktif) * 100) : 0;

                detailData.push([
                    index + 1,
                    siswa.nis,
                    siswa.nama,
                    hariAktif,
                    hadir,
                    izin,
                    alpha,
                    `${persen}%`
                ]);
            });

            const wsDetail = XLSX.utils.aoa_to_sheet(detailData);
            wsDetail['!cols'] = [
                { wch: 5 }, { wch: 15 }, { wch: 30 }, { wch: 12 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 10 }
            ];
            wsDetail['!merges'] = [
                { s: { r: 0, c: 0 }, e: { r: 0, c: 7 } },
                { s: { r: 1, c: 0 }, e: { r: 1, c: 7 } },
                { s: { r: 2, c: 0 }, e: { r: 2, c: 7 } }
            ];

            const sheetName = kelas.nama.substring(0, 31).replace(/[\\\/\*\?\[\]:]/g, '');
            XLSX.utils.book_append_sheet(wb, wsDetail, sheetName);
        });

        // Generate buffer
        const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=rekap_bulanan_${targetYear}_${targetMonth.toString().padStart(2, '0')}.xlsx`);
        res.send(buffer);

    } catch (error) {
        console.error('Export bulanan Excel error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Export rekap bulanan ke PDF
router.get('/export/bulanan/pdf', authMiddleware, adminOnly, async (req, res) => {
    try {
        const { bulan, tahun, kelas_id, jurusan_id } = req.query;
        const { targetMonth, targetYear, daysInMonth, kelasList, absensiList } = await getRekapBulananData(bulan, tahun, kelas_id, jurusan_id);

        // Format bulan
        const namaBulan = new Date(targetYear, targetMonth - 1, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

        // Create PDF
        const doc = new PDFDocument({
            margin: 50,
            size: 'A4',
            bufferPages: true
        });

        // Collect chunks
        const chunks = [];
        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => {
            const pdfBuffer = Buffer.concat(chunks);
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=rekap_bulanan_${targetYear}_${targetMonth.toString().padStart(2, '0')}.pdf`);
            res.send(pdfBuffer);
        });

        // Title
        doc.fontSize(18).font('Helvetica-Bold').text('REKAP ABSENSI BULANAN', { align: 'center' });
        doc.fontSize(12).font('Helvetica').text(`Periode: ${namaBulan}`, { align: 'center' });
        doc.moveDown(2);

        // Ringkasan Table Header
        doc.fontSize(14).font('Helvetica-Bold').text('RINGKASAN PER KELAS');
        doc.moveDown(0.5);

        // Table settings
        const tableTop = doc.y;
        const tableLeft = 50;
        const colWidths = [25, 70, 70, 45, 45, 45, 45, 55];
        const headers = ['No', 'Kelas', 'Jurusan', 'Siswa', 'Hadir', 'Izin', 'Alpha', '% Hadir'];

        // Draw header
        doc.fontSize(9).font('Helvetica-Bold');
        let xPos = tableLeft;
        headers.forEach((header, i) => {
            doc.text(header, xPos, tableTop, { width: colWidths[i], align: 'center' });
            xPos += colWidths[i];
        });

        // Draw header line
        doc.moveTo(tableLeft, tableTop + 15).lineTo(tableLeft + colWidths.reduce((a, b) => a + b, 0), tableTop + 15).stroke();

        // Table data
        let yPos = tableTop + 20;
        let grandTotalSiswa = 0, grandTotalHadir = 0, grandTotalIzin = 0, grandTotalAlpha = 0;
        let totalPersentase = 0;

        doc.font('Helvetica').fontSize(8);

        kelasList.forEach((kelas, index) => {
            const siswaList = kelas.Siswas || [];
            const kelasAbsensi = absensiList.filter(a => a.Siswa && a.Siswa.kelas_id === kelas.id);

            let totalHadir = 0, totalIzin = 0, totalAlpha = 0;

            siswaList.forEach(siswa => {
                const absensiSiswa = kelasAbsensi.filter(a => a.siswa_id === siswa.id);
                const absensiPerTanggal = {};
                absensiSiswa.forEach(a => {
                    const tgl = new Date(a.Jurnal.tanggal).toISOString().split('T')[0];
                    if (!absensiPerTanggal[tgl]) absensiPerTanggal[tgl] = [];
                    absensiPerTanggal[tgl].push(a);
                });

                Object.keys(absensiPerTanggal).forEach(tgl => {
                    const absensiHari = absensiPerTanggal[tgl];
                    if (absensiHari.some(a => a.status === 'tanpa_ket')) {
                        totalAlpha++;
                    } else if (absensiHari.some(a => a.status === 'izin')) {
                        totalIzin++;
                    } else {
                        totalHadir++;
                    }
                });
            });

            const totalHariAktif = totalHadir + totalIzin + totalAlpha;
            const persen = totalHariAktif > 0 ? Math.round((totalHadir / totalHariAktif) * 100) : 0;

            grandTotalSiswa += siswaList.length;
            grandTotalHadir += totalHadir;
            grandTotalIzin += totalIzin;
            grandTotalAlpha += totalAlpha;
            totalPersentase += persen;

            // Check if need new page
            if (yPos > 700) {
                doc.addPage();
                yPos = 50;
            }

            xPos = tableLeft;
            const rowData = [
                (index + 1).toString(),
                kelas.nama,
                (kelas.Jurusan?.singkatan || '-'),
                siswaList.length.toString(),
                totalHadir.toString(),
                totalIzin.toString(),
                totalAlpha.toString(),
                `${persen}%`
            ];

            rowData.forEach((data, i) => {
                doc.text(data, xPos, yPos, { width: colWidths[i], align: 'center' });
                xPos += colWidths[i];
            });

            yPos += 15;
        });

        // Total row
        doc.moveTo(tableLeft, yPos).lineTo(tableLeft + colWidths.reduce((a, b) => a + b, 0), yPos).stroke();
        yPos += 5;

        doc.font('Helvetica-Bold');
        const avgPersen = kelasList.length > 0 ? Math.round(totalPersentase / kelasList.length) : 0;
        xPos = tableLeft;
        const totalRowData = ['', 'TOTAL', '', grandTotalSiswa.toString(), grandTotalHadir.toString(), grandTotalIzin.toString(), grandTotalAlpha.toString(), `${avgPersen}%`];
        totalRowData.forEach((data, i) => {
            doc.text(data, xPos, yPos, { width: colWidths[i], align: 'center' });
            xPos += colWidths[i];
        });

        // Detail per kelas
        kelasList.forEach(kelas => {
            const siswaList = kelas.Siswas || [];
            if (siswaList.length === 0) return;

            const kelasAbsensi = absensiList.filter(a => a.Siswa && a.Siswa.kelas_id === kelas.id);

            // New page for each class
            doc.addPage();

            // Class header
            doc.fontSize(14).font('Helvetica-Bold').text(`DETAIL REKAP BULANAN - ${kelas.nama}`, { align: 'center' });
            doc.fontSize(10).font('Helvetica').text(`Jurusan: ${kelas.Jurusan?.nama || '-'}`, { align: 'center' });
            doc.text(`Periode: ${namaBulan}`, { align: 'center' });
            doc.moveDown(1);

            // Detail table
            const detailTop = doc.y;
            const detailLeft = 50;
            const detailWidths = [25, 60, 160, 50, 40, 40, 40, 50];
            const detailHeaders = ['No', 'NIS', 'Nama Siswa', 'Hari Aktif', 'Hadir', 'Izin', 'Alpha', '% Hadir'];

            // Draw header
            doc.fontSize(9).font('Helvetica-Bold');
            xPos = detailLeft;
            detailHeaders.forEach((header, i) => {
                doc.text(header, xPos, detailTop, { width: detailWidths[i], align: i === 2 ? 'left' : 'center' });
                xPos += detailWidths[i];
            });

            doc.moveTo(detailLeft, detailTop + 15).lineTo(detailLeft + detailWidths.reduce((a, b) => a + b, 0), detailTop + 15).stroke();

            yPos = detailTop + 20;
            doc.font('Helvetica').fontSize(8);

            let classHadir = 0, classIzin = 0, classAlpha = 0;

            siswaList.forEach((siswa, index) => {
                const absensiSiswa = kelasAbsensi.filter(a => a.siswa_id === siswa.id);

                const absensiPerTanggal = {};
                absensiSiswa.forEach(a => {
                    const tgl = new Date(a.Jurnal.tanggal).toISOString().split('T')[0];
                    if (!absensiPerTanggal[tgl]) absensiPerTanggal[tgl] = [];
                    absensiPerTanggal[tgl].push(a);
                });

                let hadir = 0, izin = 0, alpha = 0;
                Object.keys(absensiPerTanggal).forEach(tgl => {
                    const absensiHari = absensiPerTanggal[tgl];
                    if (absensiHari.some(a => a.status === 'tanpa_ket')) {
                        alpha++;
                    } else if (absensiHari.some(a => a.status === 'izin')) {
                        izin++;
                    } else {
                        hadir++;
                    }
                });

                const hariAktif = hadir + izin + alpha;
                const persen = hariAktif > 0 ? Math.round((hadir / hariAktif) * 100) : 0;

                classHadir += hadir;
                classIzin += izin;
                classAlpha += alpha;

                // Check if need new page
                if (yPos > 750) {
                    doc.addPage();
                    yPos = 50;

                    // Redraw header on new page
                    doc.fontSize(9).font('Helvetica-Bold');
                    xPos = detailLeft;
                    detailHeaders.forEach((header, i) => {
                        doc.text(header, xPos, yPos, { width: detailWidths[i], align: i === 2 ? 'left' : 'center' });
                        xPos += detailWidths[i];
                    });
                    doc.moveTo(detailLeft, yPos + 15).lineTo(detailLeft + detailWidths.reduce((a, b) => a + b, 0), yPos + 15).stroke();
                    yPos += 20;
                    doc.font('Helvetica').fontSize(8);
                }

                xPos = detailLeft;
                const rowData = [
                    (index + 1).toString(),
                    siswa.nis,
                    siswa.nama,
                    hariAktif.toString(),
                    hadir.toString(),
                    izin.toString(),
                    alpha.toString(),
                    `${persen}%`
                ];

                rowData.forEach((data, i) => {
                    doc.text(data || '-', xPos, yPos, { width: detailWidths[i], align: i === 2 ? 'left' : 'center' });
                    xPos += detailWidths[i];
                });

                yPos += 15;
            });

            // Summary for this class
            yPos += 10;
            doc.moveTo(detailLeft, yPos).lineTo(detailLeft + detailWidths.reduce((a, b) => a + b, 0), yPos).stroke();
            yPos += 10;

            const totalHariAktifKelas = classHadir + classIzin + classAlpha;
            const avgPersenKelas = totalHariAktifKelas > 0 ? Math.round((classHadir / totalHariAktifKelas) * 100) : 0;

            doc.font('Helvetica-Bold').fontSize(10);
            doc.text(`Total: ${siswaList.length} siswa | Hadir: ${classHadir} | Izin: ${classIzin} | Alpha: ${classAlpha} | Rata-rata Kehadiran: ${avgPersenKelas}%`, detailLeft, yPos);
        });

        // Finalize PDF
        doc.end();

    } catch (error) {
        console.error('Export bulanan PDF error:', error);
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

module.exports = router;
