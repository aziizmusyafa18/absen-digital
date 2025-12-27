const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Absensi = sequelize.define('Absensi', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  status: {
    type: DataTypes.ENUM('hadir', 'izin', 'tanpa_ket'),
    allowNull: false,
    defaultValue: 'hadir'
  },
  keterangan: {
    type: DataTypes.TEXT
  }
}, {
  tableName: 'absensi',
  timestamps: true
});

module.exports = Absensi;
