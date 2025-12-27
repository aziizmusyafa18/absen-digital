const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Jurusan = sequelize.define('Jurusan', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  nama: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  singkatan: {
    type: DataTypes.STRING(20),
    allowNull: true
  },
  deskripsi: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'jurusans',
  timestamps: true
});

module.exports = Jurusan;
