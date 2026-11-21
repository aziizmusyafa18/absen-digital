const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const {
  Siswa,
  OrangTua,
  GuruKelas,
  Kelas,
  Absensi,
  Jurnal,
  Nilai
} = require('../models');
const { Op } = require('sequelize');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const {
  findSiswaByNameOrId,
  verifySiswaAccess,
  getSiswaWeeklyActivity,
  buildAcademicContext
} = require('../utils/academicContext');

const router = express.Router();

async function generateGeminiContent(prompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'dummy_key') {
    throw new Error('GEMINI_API_KEY belum dikonfigurasi di file .env');
  }
  const genAI = new GoogleGenerativeAI(apiKey);
  const preferredModel = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
  const modelsToTry = [preferredModel, 'gemini-flash-lite-latest', 'gemini-3.5-flash'].filter((v, i, a) => a.indexOf(v) === i);

  let lastError;
  for (const modelName of modelsToTry) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      return result.response.text().trim();
    } catch (err) {
      console.warn(`[Chatbot] Model ${modelName} gagal: ${err.message}. Mencoba model alternatif...`);
      lastError = err;
    }
  }
  throw lastError;
}

const ACADEMIC_SYSTEM_PROMPT = `
Kamu adalah Asisten AI Akademik Sekolah ADINDA. Tugasmu adalah menjawab pertanyaan seputar akademik siswa, khususnya mengenai keaktifan belajar, kehadiran absensi, jurnal pembelajaran, catatan guru, dan nilai siswa.

ATURAN KETAT (HARUS DIPATUHI):
1. HANYA menjawab pertanyaan yang berkaitan dengan akademik dan kegiatan belajar di sekolah (absensi, nilai, jurnal, mata pelajaran, materi, kehadiran, kedisiplinan, perilaku belajar di kelas, evaluasi belajar, dll).
2. Jika pertanyaan di luar topik akademik sekolah (contoh: rekomendasi tempat wisata, liburan, resep masakan, cuaca, politik, hiburan, film, game, zodiak, atau topik umum non-sekolah lainnya), tolak dengan sopan SECARA PERSIS dengan kalimat berikut:

"Maaf, saya tidak dapat menjawab pertanyaan tersebut. Saya adalah Asisten AI Akademik yang hanya melayani pertanyaan seputar kegiatan akademik, absensi, jurnal pembelajaran, catatan guru, dan perkembangan belajar siswa di sekolah."

3. Jika pertanyaan seputar akademik namun data yang ditanyakan belum tersedia di konteks, sampaikan dengan jujur dan sopan bahwa data belum tercatat di sistem.
4. Gunakan bahasa Indonesia yang santun, jelas, terstruktur (gunakan bullet point atau penomoran jika relevan), dan mudah dipahami orang tua serta guru.
5. Bila pengguna menanyakan ringkasan pembelajaran, jabarkan mata pelajaran dan materi yang telah dipelajari.
6. Bila pengguna menanyakan kehadiran/persentase, jelaskan rincian hadir, izin, sakit, alpa, dan persentase kehadirannya.
7. Bila pengguna menanyakan keaktifan atau kedisiplinan, jelaskan status kedatangan siswa (apakah tepat waktu/terlambat) dan catatan penting dari guru kelas.
8. Bila pengguna menanyakan nilai, paparkan daftar nilai yang tercatat secara ringkas dan objektif.
`;

/**
 * Mengecek apakah pertanyaan di luar topik akademik berdasarkan kata kunci
 */
function isNonAcademicQuestion(message) {
  const nonAcademicKeywords = [
    // Wisata & Travel
    'wisata', 'liburan', 'tempat wisata', 'destinasi', 'hotel', 'pesawat', 'pantai', 'gunung', 'villa', 'travel',
    // Makanan & Kuliner
    'masakan', 'resep', 'makanan', 'minuman', 'kue', 'mie', 'nasi goreng', 'kuliner', 'restoran', 'cafe',
    // Cuaca
    'cuaca', 'temperatur', 'hujan', 'panas', 'prakiraan cuaca', 'iklim',
    // Politik
    'politik', 'pemilu', 'presiden', 'gubernur', 'partai', 'pilkada', 'menteri', 'dpr', 'caleg',
    // Hiburan
    'film', 'movie', 'cinema', 'bioskop', 'music', 'musik', 'lagu', 'chord', 'artis', 'celebritas', 'game', 'gaming',
    // Olahraga
    'sepakbola', 'sepak bola', 'basket', 'bulu tangkis', 'badminton', 'motogp', 'f1', 'liga inggris', 'liga champion',
    // Finansial umum
    'pinjol', 'pinjaman online', 'saham', 'crypto', 'kripto', 'bitcoin', 'trading', 'investasi',
    // Medis umum
    'obat', 'resep obat', 'gejala penyakit', 'rumah sakit',
    // Zodiak / Romance
    'zodiak', 'horoskop', 'ramalan', 'jodoh', 'pacar', 'cinta', 'lelucon', 'jokes'
  ];

  const academicKeywords = [
    'absensi', 'absen', 'kehadiran', 'jurnal', 'mata pelajaran', 'mapel',
    'materi', 'kelas', 'sekolah', 'siswa', 'guru', 'nilai', 'raport', 'pelajaran',
    'keaktifan', 'belajar', 'pertemuan', 'hadir', 'izin', 'alpha', 'alpa', 'sakit',
    'kondisi kelas', 'catatan', 'rata-rata', 'pertumbuhan', 'prestasi', 'keterlambatan',
    'terlambat', 'disiplin', 'perilaku', 'tugas', 'ulangan', 'ujian', 'adinda'
  ];

  const lowerMsg = message.toLowerCase();
  const hasAcademic = academicKeywords.some(kw => lowerMsg.includes(kw));
  const hasNonAcademic = nonAcademicKeywords.some(kw => lowerMsg.includes(kw));

  if (hasNonAcademic && !hasAcademic) {
    return true;
  }

  return false;
}

/**
 * Mengecek apakah pesan berupa sapaan murni (tanpa pertanyaan akademik lanjutan)
 */
function isGreetingMessage(message) {
  const cleanMsg = message.trim().toLowerCase().replace(/[!?.,;:]/g, '');
  const greetingKeywords = [
    'halo', 'halo bot', 'halo ai', 'hai', 'hi', 'hey', 'hei',
    'assalamualaikum', 'assalamu alaikum', 'assalamu\'alaikum',
    'selamat pagi', 'selamat siang', 'selamat sore', 'selamat malam',
    'pagi', 'siang', 'sore', 'malam',
    'tes', 'test', 'ping', 'halo assalamualaikum'
  ];

  const words = cleanMsg.split(/\s+/);
  // Sapaan biasanya pendek (maksimal 4 kata)
  if (words.length <= 4) {
    const isGreetingWord = greetingKeywords.some(gw => cleanMsg === gw || cleanMsg.startsWith(gw + ' ') || cleanMsg.endsWith(' ' + gw));
    if (isGreetingWord) {
      // Pastikan bukan sapaan yang langsung bertanya akademik
      const hasSpecificAction = [
        'absensi', 'nilai', 'jurnal', 'kehadiran', 'keaktifan', 'bagaimana', 'rekap', 'berapa',
        'atas nama', 'nama', 'anak', 'siswa', 'tampilkan', 'lihat'
      ].some(k => cleanMsg.includes(k));

      return !hasSpecificAction;
    }
  }

  return false;
}

/**
 * Mengekstrak nama siswa dari pesan pengguna dengan berbagai variasi pola
 */
function extractSiswaName(message) {
  const patterns = [
    /atas\s+nama\s+(.+?)(?:\s+(?:tolong|berikan|minta|lihat|tampilkan|apakah|bagaimana|dan|untuk)|$)/i,
    /nama\s+siswa\s+(.+?)(?:\s+(?:tolong|berikan|minta|lihat|tampilkan|apakah|bagaimana|dan|untuk)|$)/i,
    /nama\s+anak\s+(.+?)(?:\s+(?:tolong|berikan|minta|lihat|tampilkan|apakah|bagaimana|dan|untuk)|$)/i,
    /nama\s+(.+?)(?:\s+(?:tolong|berikan|minta|lihat|tampilkan|apakah|bagaimana|dan|untuk)|$)/i,
    /siswa\s+(.+?)(?:\s+(?:tolong|berikan|minta|lihat|tampilkan|apakah|bagaimana|dan|untuk)|$)/i,
    /ananda\s+(.+?)(?:\s+(?:tolong|berikan|minta|lihat|tampilkan|apakah|bagaimana|dan|untuk)|$)/i,
    /anak\s+(.+?)(?:\s+(?:tolong|berikan|minta|lihat|tampilkan|apakah|bagaimana|dan|untuk)|$)/i,
    /untuk\s+(.+?)(?:\s+(?:tolong|berikan|minta|lihat|tampilkan|apakah|bagaimana|dan)|$)/i
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match && match[1]) {
      let name = match[1].trim();
      name = name.replace(/[,\.\?!]+$/, '');
      if (name.length >= 2) {
        return name;
      }
    }
  }

  return null;
}

/**
 * Mengecek apakah pesan mengandung pertanyaan spesifik seputar akademik
 */
function isSpecificQuery(message) {
  const queryRegex = /(kehadiran|absensi|absen|persentase|jurnal|materi|mapel|mata\s+pelajaran|nilai|raport|keaktifan|perilaku|catatan|terlambat|alpa|izin|sakit|hadir|bagaimana|gimana|kenapa|mengapa|berapa|apa\s+saja|tolong|rangkum|ringkas|evaluasi|prestasi|rekap|tampilkan|cek|lihat|info)/i;
  return queryRegex.test(message);
}

// POST /api/chatbot/ask
router.post('/ask', authMiddleware, async (req, res) => {
  try {
    const { message, siswa_id } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;

    if (!message || message.trim() === '') {
      return res.status(400).json({ error: 'Pesan tidak boleh kosong' });
    }

    const trimmedMsg = message.trim();

    // 1. Cek apakah pertanyaan di luar topik akademik
    if (isNonAcademicQuestion(trimmedMsg)) {
      return res.json({
        reply: 'Maaf, saya tidak dapat menjawab pertanyaan tersebut. Saya adalah Asisten AI Akademik yang hanya melayani pertanyaan seputar kegiatan akademik, absensi, jurnal pembelajaran, catatan guru, dan perkembangan belajar siswa di sekolah.',
        isAcademic: false
      });
    }

    // 2. Cek apakah pesan berupa sapaan murni
    if (isGreetingMessage(trimmedMsg)) {
      if (userRole === 'ortu') {
        const ortuSiswa = await OrangTua.findOne({
          where: { id: userId },
          include: [{
            model: Siswa,
            attributes: ['id', 'nama', 'nis'],
            include: [{ model: Kelas, attributes: ['nama'] }]
          }]
        });

        if (ortuSiswa && ortuSiswa.Siswas && ortuSiswa.Siswas.length > 0) {
          const anak = ortuSiswa.Siswas[0];
          const kelasNama = anak.Kelas ? anak.Kelas.nama : '-';
          return res.json({
            reply: `Halo Bapak/Ibu! Selamat datang di **Asisten AI Akademik Sekolah ADINDA** 👋\n\nSaya siap membantu Anda memantau perkembangan belajar ananda **${anak.nama}** (Kelas: ${kelasNama}, NIS: ${anak.nis}).\n\nBerikut beberapa opsi informasi yang dapat Anda tanyakan:\n1. 📋 **Ringkasan Pembelajaran**: Materi belajar dan jurnal kelas ananda.\n2. 📊 **Persentase Kehadiran**: Rekapitulasi absensi hadir, izin, sakit, dan alpa.\n3. 🌟 **Ringkasan Keaktifan**: Kedisiplinan jam kedatangan dan catatan keaktifan guru.\n4. 📝 **Informasi Nilai**: Capaian belajar dan catatan evaluasi materi.\n\nSilakan ketik pertanyaan Anda, atau pilih opsi di bawah ini:`,
            isAcademic: true,
            isGreeting: true,
            siswa: {
              id: anak.id,
              nama: anak.nama,
              nis: anak.nis,
              kelas: kelasNama
            },
            options: [
              `Ringkasan pembelajaran ${anak.nama}`,
              `Persentase kehadiran ${anak.nama}`,
              `Ringkasan keaktifan ${anak.nama}`,
              `Lihat nilai ${anak.nama}`
            ]
          });
        }
      }

      // Greeting untuk Guru atau Admin (atau Ortu tanpa data anak)
      const roleTitle = userRole === 'guru' ? 'Bapak/Ibu Guru' : (userRole === 'admin' ? 'Bapak/Ibu Admin' : 'Bapak/Ibu');
      return res.json({
        reply: `Halo ${roleTitle}! Selamat datang di **Asisten AI Akademik Sekolah ADINDA** 👋\n\nSaya siap membantu Anda menganalisis data akademik siswa secara cepat dan terintegrasi:\n1. 📋 **Ringkasan Pembelajaran & Jurnal**: Rangkuman materi mata pelajaran dan catatan mengajar.\n2. 📊 **Persentase & Rekap Kehadiran**: Tingkat kehadiran, sakit, izin, dan alpa siswa.\n3. 🌟 **Ringkasan Keaktifan Belajar**: Ketepatan jam hadir dan evaluasi kedisiplinan siswa.\n4. 📝 **Informasi Nilai & Perkembangan**: Pemantauan hasil evaluasi belajar siswa.\n\n💡 **Cara Memulai:**\nCukup ketikkan **nama siswa** yang ingin Anda periksa (contoh: *"Budi Santoso"* atau *"Bagaimana kehadiran Ahmad minggu ini?"*).`,
        isAcademic: true,
        isGreeting: true
      });
    }

    // 3. Tentukan siswa yang ditanyakan
    let targetSiswaId = siswa_id ? parseInt(siswa_id) : null;
    let siswaNameFromMessage = null;

    if (!targetSiswaId) {
      siswaNameFromMessage = extractSiswaName(trimmedMsg);
    }

    let siswaData = null;

    if (targetSiswaId) {
      const access = await verifySiswaAccess(targetSiswaId, userId, userRole);
      if (!access.hasAccess) {
        return res.status(403).json({ error: access.error });
      }
      siswaData = access.siswa;
    } else if (siswaNameFromMessage) {
      const found = await findSiswaByNameOrId(siswaNameFromMessage, userId, userRole);
      if (found && found.length > 0) {
        for (const s of found) {
          const access = await verifySiswaAccess(s.id, userId, userRole);
          if (access.hasAccess) {
            siswaData = access.siswa;
            targetSiswaId = siswaData.id;
            break;
          }
        }
      }
      if (!siswaData) {
        return res.status(404).json({
          error: `Siswa dengan nama "${siswaNameFromMessage}" tidak ditemukan atau Anda tidak memiliki akses ke data tersebut.`
        });
      }
    } else {
      // Cek apakah pesan pengguna adalah nama siswa langsung (contoh: "Budi", "Budi Santoso", "Siti")
      const cleanedMsg = trimmedMsg.replace(/^(siswa|ananda|anak)\s+/i, '').replace(/[,\.\?!]+$/, '').trim();
      if (cleanedMsg.length >= 2 && cleanedMsg.length <= 40) {
        const foundDirect = await findSiswaByNameOrId(cleanedMsg, userId, userRole);
        if (foundDirect && foundDirect.length > 0) {
          for (const s of foundDirect) {
            const access = await verifySiswaAccess(s.id, userId, userRole);
            if (access.hasAccess) {
              siswaData = access.siswa;
              targetSiswaId = siswaData.id;
              break;
            }
          }
        }
      }

      // Jika tetap belum ditemukan dan user adalah ortu, otomatis arahkan ke anak pertamanya
      if (!siswaData) {
        if (userRole === 'ortu') {
          const ortuSiswa = await OrangTua.findOne({
            where: { id: userId },
            include: [{
              model: Siswa,
              attributes: ['id', 'nama', 'nis'],
              include: [{ model: Kelas, attributes: ['nama'] }]
            }]
          });
          if (ortuSiswa && ortuSiswa.Siswas && ortuSiswa.Siswas.length > 0) {
            siswaData = ortuSiswa.Siswas[0];
            targetSiswaId = siswaData.id;
          } else {
            return res.status(404).json({ error: 'Anda belum memiliki data anak yang tercatat di sistem.' });
          }
        } else {
          return res.json({
            reply: 'Silakan sebutkan nama siswa atau pilih siswa yang ingin Anda tanyakan terlebih dahulu (contoh: *"Budi Santoso"* atau *"Bagaimana kehadiran Budi?"*).',
            isAcademic: true
          });
        }
      }
    }

    // 4. Cek apakah input hanya mengirimkan nama anak (tanpa pertanyaan spesifik)
    const hasSpecificQuery = isSpecificQuery(trimmedMsg);
    if (!hasSpecificQuery) {
      const kelasNama = siswaData.Kelas ? siswaData.Kelas.nama : '-';
      return res.json({
        reply: `Data ananda **${siswaData.nama}** (NIS: ${siswaData.nis}, Kelas: ${kelasNama}) telah ditemukan! 🎉\n\nSilakan pilih informasi apa yang ingin Anda ketahui seputar ananda:\n1. 📋 **Ringkasan Pembelajaran**: Rangkuman materi pelajaran yang telah dipelajari dan jurnal kelas.\n2. 📊 **Persentase Kehadiran**: Rincian total absensi hadir, sakit, izin, alpa, dan persentase kehadiran.\n3. 🌟 **Ringkasan Keaktifan & Kedisiplinan**: Waktu kedatangan (keterlambatan) serta catatan keaktifan guru di kelas.\n4. 📝 **Informasi Nilai / Akademik**: Rincian capaian nilai tugas, ulangan, dan evaluasi belajar.\n\nSilakan ketik pertanyaan atau klik opsi di bawah ini:`,
        isAcademic: true,
        isStudentMenu: true,
        siswa: {
          id: siswaData.id,
          nama: siswaData.nama,
          nis: siswaData.nis,
          kelas: kelasNama
        },
        options: [
          `Ringkasan pembelajaran ${siswaData.nama}`,
          `Persentase kehadiran ${siswaData.nama}`,
          `Ringkasan keaktifan ${siswaData.nama}`,
          `Lihat nilai ${siswaData.nama}`
        ]
      });
    }

    // 5. Jika pertanyaan spesifik terkait akademik, ambil data lengkap dan panggil Gemini AI
    const { absensi: weeklyAbsensi, infoNote, nilai: studentNilai } = await getSiswaWeeklyActivity(targetSiswaId);
    const academicContext = buildAcademicContext(siswaData, weeklyAbsensi, infoNote, studentNilai);

    const fullPrompt = `${ACADEMIC_SYSTEM_PROMPT}

${academicContext}

Pertanyaan pengguna: ${trimmedMsg}`;

    const aiReply = await generateGeminiContent(fullPrompt);

    res.json({
      reply: aiReply,
      isAcademic: true,
      siswa: {
        id: siswaData.id,
        nama: siswaData.nama,
        nis: siswaData.nis,
        kelas: siswaData.Kelas ? siswaData.Kelas.nama : '-'
      }
    });

  } catch (error) {
    console.error('[Chatbot] Error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan server: ' + error.message });
  }
});

module.exports = router;
