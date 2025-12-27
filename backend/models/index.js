const sequelize = require('../config/database');
const Guru = require('./Guru');
const Kelas = require('./Kelas');
const Siswa = require('./Siswa');
const OrangTua = require('./OrangTua');
const Jurnal = require('./Jurnal');
const Absensi = require('./Absensi');
const GuruKelas = require('./GuruKelas');
const Jurusan = require('./Jurusan');

// Define Associations
// Kelas - Siswa (one-to-many)
Kelas.hasMany(Siswa, { foreignKey: 'kelas_id', onDelete: 'CASCADE' });
Siswa.belongsTo(Kelas, { foreignKey: 'kelas_id' });

// Siswa - OrangTua (many-to-many)
Siswa.belongsToMany(OrangTua, { through: 'SiswaOrangTua', foreignKey: 'siswa_id' });
OrangTua.belongsToMany(Siswa, { through: 'SiswaOrangTua', foreignKey: 'orang_tua_id' });

// Guru - Jurnal (one-to-many)
Guru.hasMany(Jurnal, { foreignKey: 'guru_id', onDelete: 'CASCADE' });
Jurnal.belongsTo(Guru, { foreignKey: 'guru_id', as: 'Guru' });

// Kelas - Jurnal (one-to-many)
Kelas.hasMany(Jurnal, { foreignKey: 'kelas_id', onDelete: 'CASCADE' });
Jurnal.belongsTo(Kelas, { foreignKey: 'kelas_id', as: 'Kelas' });

// Jurnal - Absensi (one-to-many)
Jurnal.hasMany(Absensi, { foreignKey: 'jurnal_id', onDelete: 'CASCADE' });
Absensi.belongsTo(Jurnal, { foreignKey: 'jurnal_id' });

// Siswa - Absensi (one-to-many)
Siswa.hasMany(Absensi, { foreignKey: 'siswa_id', onDelete: 'CASCADE' });
Absensi.belongsTo(Siswa, { foreignKey: 'siswa_id' });

// Guru - Kelas (many-to-many via GuruKelas)
Guru.belongsToMany(Kelas, { through: GuruKelas, foreignKey: 'guru_id', as: 'KelasDiajar' });
Kelas.belongsToMany(Guru, { through: GuruKelas, foreignKey: 'kelas_id', as: 'GuruMengajar' });

// GuruKelas - Guru (belongsTo)
GuruKelas.belongsTo(Guru, { foreignKey: 'guru_id' });
Guru.hasMany(GuruKelas, { foreignKey: 'guru_id', onDelete: 'CASCADE' });

// GuruKelas - Kelas (belongsTo)
GuruKelas.belongsTo(Kelas, { foreignKey: 'kelas_id' });
Kelas.hasMany(GuruKelas, { foreignKey: 'kelas_id', onDelete: 'CASCADE' });

// Jurusan - Kelas (one-to-many)
Jurusan.hasMany(Kelas, { foreignKey: 'jurusan_id', onDelete: 'SET NULL' });
Kelas.belongsTo(Jurusan, { foreignKey: 'jurusan_id', allowNull: true });

module.exports = {
  sequelize,
  Guru,
  Kelas,
  Siswa,
  OrangTua,
  Jurnal,
  Absensi,
  GuruKelas,
  Jurusan
};
