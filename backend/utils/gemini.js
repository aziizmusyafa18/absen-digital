const { GoogleGenerativeAI } = require("@google/generative-ai");

// Inisialisasi Gemini API
// Pastikan GEMINI_API_KEY diset di environment variables (.env)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'dummy_key');
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

/**
 * Generate pesan peringatan untuk 3x Alpa berturut-turut
 */
async function generateWarningTigaAlpa(namaSiswa, mapel) {
    try {
        if (!process.env.GEMINI_API_KEY) {
            throw new Error("GEMINI_API_KEY is not set");
        }
        
        // Dapatkan waktu saat ini untuk membantu AI
        const jam = new Date().getHours();
        let waktu = 'Pagi';
        if (jam >= 11 && jam < 15) waktu = 'Siang';
        else if (jam >= 15 && jam < 18) waktu = 'Sore';
        else if (jam >= 18) waktu = 'Malam';

        const prompt = `Kamu adalah Asisten AI Bimbingan Konseling Sekolah.
Tugasmu adalah membuat pesan WhatsApp peringatan yang sopan, profesional, namun tegas untuk orang tua siswa.
Data siswa:
- Nama: ${namaSiswa}
- Masalah: Tidak hadir (Alpa) 3 kali berturut-turut pada mata pelajaran ${mapel}.

Instruksi Khusus (SANGAT PENTING):
1. Waktu saat ini adalah ${waktu}. Awali pesan TEPAT dengan format kalimat ini (tanpa tanda kutip):
"Selamat ${waktu.toLowerCase()} Bapak/Ibu, saat ini sistem kami mendeteksi..."
2. Lanjutkan kalimat tersebut dengan menjelaskan masalah ketidakhadiran berulang ini secara halus namun tegas.
3. Sampaikan mohon kerja sama orang tua untuk menindaklanjuti.
4. Jangan gunakan format markdown berlebihan selain format *tebal* atau _italic_ khas whatsapp.`;
        
        const result = await model.generateContent(prompt);
        return result.response.text().trim();
    } catch (error) {
        console.error("Gemini AI Error:", error.message);
        return `Selamat pagi/siang/malam Bapak/Ibu, saat ini sistem kami mendeteksi bahwa ananda *${namaSiswa}* telah tercatat *ALPA 3 KALI BERTURUT-TURUT* pada mata pelajaran *${mapel}*. Mohon kerja samanya untuk segera mengkonfirmasi ke pihak sekolah atau guru bimbingan konseling guna menindaklanjuti permasalahan ini.`;
    }
}

/**
 * Generate pesan peringatan untuk persentase kehadiran di bawah 75%
 */
async function generateWarningKehadiran(namaSiswa, persentase, bulan, tahun) {
    try {
        if (!process.env.GEMINI_API_KEY) {
            throw new Error("GEMINI_API_KEY is not set");
        }

        const jam = new Date().getHours();
        let waktu = 'Pagi';
        if (jam >= 11 && jam < 15) waktu = 'Siang';
        else if (jam >= 15 && jam < 18) waktu = 'Sore';
        else if (jam >= 18) waktu = 'Malam';

        const prompt = `Kamu adalah Asisten AI Akademik Sekolah.
Tugasmu adalah membuat pesan WhatsApp peringatan evaluasi bulanan yang empati namun menyoroti risiko akademis.
Data siswa:
- Nama: ${namaSiswa}
- Persentase Kehadiran: ${persentase}% (berada di bawah batas minimal 75%)
- Periode: Bulan ${bulan} Tahun ${tahun}

Instruksi Khusus (SANGAT PENTING):
1. Waktu saat ini adalah ${waktu}. Awali pesan TEPAT dengan format kalimat ini (tanpa tanda kutip):
"Selamat ${waktu.toLowerCase()} Bapak/Ibu, saat ini sistem kami mendeteksi..."
2. Lanjutkan kalimat tersebut dengan menjelaskan bahwa persentase kehadiran ananda berada di bawah standar kelulusan.
3. Sebutkan dengan jelas bahwa AI sekolah memprediksi siswa ini pada indikator berisiko "Terancam Tidak Lulus / Tidak Naik Kelas" jika tren kehadiran tidak membaik.
4. Ajak orang tua bekerja sama. Buat natural layaknya chat WA, bisa pakai emoji peringatan.`;
        
        const result = await model.generateContent(prompt);
        return result.response.text().trim();
    } catch (error) {
        console.error("Gemini AI Error:", error.message);
        return `Selamat pagi/siang/malam Bapak/Ibu, saat ini sistem kami mendeteksi bahwa berdasarkan hasil rekapitulasi presensi otomatis bulan ${bulan}/${tahun}, persentase kehadiran ananda *${namaSiswa}* adalah *${persentase}%*. Angka ini berada DI BAWAH ambang batas kelulusan minimal (75%). Indikator: TERANCAM TIDAK LULUS / TIDAK NAIK KELAS. Mohon segera menghubungi pihak sekolah demi perbaikan kehadiran ananda ke depannya. Terima kasih.`;
    }
}

module.exports = {
    generateWarningTigaAlpa,
    generateWarningKehadiran
};
