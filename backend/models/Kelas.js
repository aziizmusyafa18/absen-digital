const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Kelas = sequelize.define('Kelas', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  nama: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  tingkat: {
    type: DataTypes.STRING,
    allowNull: false
  },
  tahun_ajaran: {
    type: DataTypes.STRING,
    allowNull: false
  },
  jurusan_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  }
}, {
  tableName: 'kelas',
  timestamps: true
});

module.exports = Kelas;
