const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Jurnal = sequelize.define('Jurnal', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  tanggal: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  jam_mulai: {
    type: DataTypes.TIME,
    allowNull: false
  },
  jam_selesai: {
    type: DataTypes.TIME,
    allowNull: false
  },
  mata_pelajaran: {
    type: DataTypes.STRING,
    allowNull: false
  },
  materi: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  foto_kegiatan: {
    type: DataTypes.TEXT({ length: 'long' }),
    allowNull: true
  },
  status_masuk: {
    type: DataTypes.ENUM('tepat_waktu', 'terlambat'),
    defaultValue: 'tepat_waktu'
  },
  menit_keterlambatan: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  catatan: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Catatan kondisi kelas dari guru'
  }
}, {
  tableName: 'jurnal',
  timestamps: true
});

module.exports = Jurnal;
