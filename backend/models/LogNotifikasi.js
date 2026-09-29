const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const LogNotifikasi = sequelize.define('LogNotifikasi', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  pesan: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  no_tujuan: {
    type: DataTypes.STRING,
    allowNull: false
  },
  status: {
    type: DataTypes.STRING,
    defaultValue: 'pending' // pending, sent, delivered, failed
  },
  keterangan: {
    type: DataTypes.STRING,
    allowNull: true
  },
  siswa_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  }
}, {
  tableName: 'log_notifikasi',
  timestamps: true
});

module.exports = LogNotifikasi;
