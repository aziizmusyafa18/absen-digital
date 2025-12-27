const bcrypt = require('bcrypt');
const { sequelize, Guru, Kelas, Siswa, OrangTua, GuruKelas } = require('./models');

const seedDatabase = async () => {
  try {
    // Reset tables
    await sequelize.sync({ force: true });
    console.log('✅ Database synced');

    // Create Admin
    const adminPassword = await bcrypt.hash('admin123', 10);
    await Guru.create({
      username: 'admin',
      password: adminPassword,
      nama: 'Administrator Sekolah',
      nip: '198001012010011001',
      mapel: 'Administrasi',
      role: 'admin'
    });
    console.log('✅ Admin created');

    // Create Guru
    const guruPassword = await bcrypt.hash('guru123', 10);
    const guru1 = await Guru.create({
      username: 'sari',
      password: guruPassword,
      nama: 'Sari Indrawati',
      nip: '198505152010122001',
      mapel: 'Pemrograman Web',
      jam_mulai: '09:00:00', // Admin-set start time
      role: 'guru'
    });

    const guru2 = await Guru.create({
      username: 'budi',
      password: guruPassword,
      nama: 'Budi Santoso',
      nip: '197903102008011002',
      mapel: 'Jaringan Komputer',
      jam_mulai: '08:00:00', // Admin-set start time
      role: 'guru'
    });

    const guru3 = await Guru.create({
      username: 'ani',
      password: guruPassword,
      nama: 'Ani Wulandari',
      nip: '198807252012012001',
      mapel: 'Basis Data',
      jam_mulai: '10:00:00', // Admin-set start time
      role: 'guru'
    });

    console.log('✅ Guru users created');

    // Create Kelas
    const kelasXII = await Kelas.create({
      nama: 'XII TJKT A',
      tingkat: 'XII',
      tahun_ajaran: '2024/2025'
    });

    const kelasXI = await Kelas.create({
      nama: 'XI TJKT A',
      tingkat: 'XI',
      tahun_ajaran: '2024/2025'
    });

    const kelasX = await Kelas.create({
      nama: 'X TJKT A',
      tingkat: 'X',
      tahun_ajaran: '2024/2025'
    });

    console.log('✅ Kelas created');

    // Create Siswa untuk XII TJKT A
    const siswaData = [
      { nis: '2021001', nama: 'Ahmad Santoso', kelas_id: kelasXII.id },
      { nis: '2021002', nama: 'Budi Pratama', kelas_id: kelasXII.id },
      { nis: '2021003', nama: 'Citra Dewi', kelas_id: kelasXII.id },
      { nis: '2021004', nama: 'Dedi Kurniawan', kelas_id: kelasXII.id },
      { nis: '2021005', nama: 'Erika Putri', kelas_id: kelasXII.id },
      { nis: '2021006', nama: 'Fajar Rahman', kelas_id: kelasXII.id },
      { nis: '2021007', nama: 'Gita Sari', kelas_id: kelasXII.id },
      { nis: '2021008', nama: 'Hendra Wijaya', kelas_id: kelasXII.id },
      { nis: '2021009', nama: 'Indira Putri', kelas_id: kelasXII.id },
      { nis: '2021010', nama: 'Joko Susilo', kelas_id: kelasXII.id },
      { nis: '2021011', nama: 'Kartika Sari', kelas_id: kelasXII.id },
      { nis: '2021012', nama: 'Luki Hermawan', kelas_id: kelasXII.id },
      { nis: '2021013', nama: 'Maya Indriati', kelas_id: kelasXII.id },
      { nis: '2021014', nama: 'Nanda Pratama', kelas_id: kelasXII.id },
      { nis: '2021015', nama: 'Olivia Putri', kelas_id: kelasXII.id },
      { nis: '2021016', nama: 'Putra Santoso', kelas_id: kelasXII.id },
      { nis: '2021017', nama: 'Qori Amelia', kelas_id: kelasXII.id },
      { nis: '2021018', nama: 'Rizki Fadillah', kelas_id: kelasXII.id },
      { nis: '2021019', nama: 'Sari Pertiwi', kelas_id: kelasXII.id },
      { nis: '2021020', nama: 'Toni Setiawan', kelas_id: kelasXII.id }
    ];

    const siswa = await Siswa.bulkCreate(siswaData);
    console.log('✅ Siswa XII TJKT A created');

    // Create Orang Tua untuk 5 siswa pertama
    const ortuPassword = await bcrypt.hash('ortu123', 10);

    const ortu1 = await OrangTua.create({
      username: 'ortu_ahmad',
      password: ortuPassword,
      nama: 'Hasan Santoso (Ayah Ahmad)',
      email: 'hasan.santoso@email.com',
      phone: '081234567890'
    });

    const ortu2 = await OrangTua.create({
      username: 'ortu_budi',
      password: ortuPassword,
      nama: 'Siti Pratama (Ibu Budi)',
      email: 'siti.pratama@email.com',
      phone: '081234567891'
    });

    const ortu3 = await OrangTua.create({
      username: 'ortu_citra',
      password: ortuPassword,
      nama: 'Rudi Dewi (Ayah Citra)',
      email: 'rudi.dewi@email.com',
      phone: '081234567892'
    });

    const ortu4 = await OrangTua.create({
      username: 'ortu_dedi',
      password: ortuPassword,
      nama: 'Mila Kurniawan (Ibu Dedi)',
      email: 'mila.kurniawan@email.com',
      phone: '081234567893'
    });

    const ortu5 = await OrangTua.create({
      username: 'ortu_erika',
      password: ortuPassword,
      nama: 'Andi Putri (Ayah Erika)',
      email: 'andi.putri@email.com',
      phone: '081234567894'
    });

    console.log('✅ Orang Tua created');

    // Link ortu dengan siswa (many-to-many)
    await ortu1.addSiswa(siswa[0]); // Hasan -> Ahmad
    await ortu2.addSiswa(siswa[1]); // Siti -> Budi
    await ortu3.addSiswa(siswa[2]); // Rudi -> Citra
    await ortu4.addSiswa(siswa[3]); // Mila -> Dedi
    await ortu5.addSiswa(siswa[4]); // Andi -> Erika

    console.log('✅ Orang Tua - Siswa links created');

    // Create Guru-Kelas relationships (for auto-fill mata pelajaran)
    await GuruKelas.create({
      guru_id: guru1.id,
      kelas_id: kelasXII.id,
      mata_pelajaran: 'Pemrograman Web'
    });

    await GuruKelas.create({
      guru_id: guru1.id,
      kelas_id: kelasXI.id,
      mata_pelajaran: 'Pemrograman Web Dasar'
    });

    await GuruKelas.create({
      guru_id: guru2.id,
      kelas_id: kelasXII.id,
      mata_pelajaran: 'Jaringan Komputer'
    });

    await GuruKelas.create({
      guru_id: guru2.id,
      kelas_id: kelasXI.id,
      mata_pelajaran: 'Administrasi Jaringan'
    });

    await GuruKelas.create({
      guru_id: guru3.id,
      kelas_id: kelasXII.id,
      mata_pelajaran: 'Basis Data'
    });

    await GuruKelas.create({
      guru_id: guru3.id,
      kelas_id: kelasX.id,
      mata_pelajaran: 'Pengenalan Basis Data'
    });

    console.log('✅ Guru-Kelas relationships created');

    console.log('\n🎉 Database seeded successfully!\n');
    console.log('Login Credentials:');
    console.log('Admin: username=admin, password=admin123');
    console.log('Guru: username=sari/budi/ani, password=guru123');
    console.log('Orang Tua: username=ortu_ahmad/ortu_budi/etc, password=ortu123');
    console.log('');

    process.exit(0);

  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
};

seedDatabase();
