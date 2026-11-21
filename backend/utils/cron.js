const cron = require('node-cron');
const { Op } = require('sequelize');
const { Absensi, Siswa, Jurnal } = require('../models');
const { sendWhatsAppMessage } = require('./whatsapp');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'dummy_key');
const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || "gemini-3.5-flash-lite" });

// Jalankan setiap hari jam 14:00 (0 14 * * *)
cron.schedule('0 14 * * *', async () => {
    console.log("Menjalankan CRON: Mengirim Rekapan Absensi Harian via AI...");
    try {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);

        // Ambil semua absensi hari ini yang bermasalah (tidak hadir)
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
            console.log("Tidak ada absen bermasalah hari ini.");
            return;
        }

        // Kelompokkan berdasarkan siswa
        const absensiPerSiswa = {};
        absensiHariIni.forEach(absen => {
            if (!absen.Siswa) return;
            const sId = absen.Siswa.id;
            if (!absensiPerSiswa[sId]) {
                absensiPerSiswa[sId] = {
                    siswa: absen.Siswa,
                    rekapan: []
                };
            }
            // Ubah tanpa_ket jadi alpa biar lebih enak dibaca
            const statusLabel = absen.status === 'tanpa_ket' ? 'alpa' : absen.status;
            
            absensiPerSiswa[sId].rekapan.push({
                mapel: absen.Jurnal ? absen.Jurnal.mata_pelajaran : '-',
                status: statusLabel
            });
        });

        // Proses setiap siswa dan kirim WA
        const tanggalStr = new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' });
        
        for (const sId in absensiPerSiswa) {
            const data = absensiPerSiswa[sId];
            if (!data.siswa.no_hp_ortu) continue;

            let adaPeringatanDini = false;
            let infoTambahan = "";

            // Cek 3x alpa berturut-turut untuk list mapel hari ini
            for (const r of data.rekapan) {
                if (r.status === 'alpa') {
                    const riwayat = await Absensi.findAll({
                        where: { siswa_id: data.siswa.id, status: 'tanpa_ket' },
                        include: [{ model: Jurnal, where: { mata_pelajaran: r.mapel } }],
                        order: [['createdAt', 'DESC']],
                        limit: 3
                    });

                    if (riwayat.length === 3) {
                        adaPeringatanDini = true;
                        infoTambahan += `\n[PENTING] Siswa ini terdeteksi ALPA 3 KALI BERTURUT-TURUT pada mapel ${r.mapel}. `;
                    }
                }
            }

            const listMasalah = data.rekapan.map(r => `- Mapel ${r.mapel}: ${r.status.toUpperCase()}`).join("\n");
            
            // Cek AI
            let pesan = "";
            try {
                if (!process.env.GEMINI_API_KEY) throw new Error("No API Key");
                
                const prompt = `Kamu adalah Asisten AI Sekolah.
Tugasmu merangkum daftar ketidakhadiran harian siswa dan memberitahu orang tuanya via WhatsApp.
Data Siswa: ${data.siswa.nama}
Tanggal: ${tanggalStr}
Rincian Absen Hari Ini:
${listMasalah}
${infoTambahan ? `\nINFORMASI PERINGATAN DINI: ${infoTambahan}\n(Tolong berikan teguran/peringatan tegas terkait hal ini di dalam pesan!)` : ''}

Instruksi Khusus (SANGAT PENTING):
1. Awali kalimat pertama dengan: "Selamat siang Bapak/Ibu, berikut adalah rekap absensi harian ananda ${data.siswa.nama} pada hari ini..."
2. Buatlah laporan singkat (maks 2-3 paragraf) berdasarkan list absen di atas. Gunakan bahasa yang natural, berempati namun informatif.
3. Jangan gunakan markdown yang aneh-aneh (hindari bintang * di awal list).`;
                
                const result = await model.generateContent(prompt);
                pesan = result.response.text().trim();
            } catch (err) {
                // Fallback
                pesan = `Selamat siang Bapak/Ibu, berikut adalah rekap absensi harian ananda *${data.siswa.nama}* pada hari ini (${tanggalStr}):\n\n${listMasalah}\n\nMohon perhatian dan konfirmasinya ke pihak sekolah jika terdapat kekeliruan. Terima kasih.`;
            }

            // Panggil sendWhatsAppMessage
            sendWhatsAppMessage(data.siswa.no_hp_ortu, pesan, data.siswa.id);
        }
        console.log(`Berhasil mengirim rekap harian ke ${Object.keys(absensiPerSiswa).length} siswa.`);
    } catch (error) {
        console.error("Error saat eksekusi CRON rekap harian:", error);
    }
});

module.exports = cron;
