const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Siswa = sequelize.define('Siswa', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  nis: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false
  },
  nama: {
    type: DataTypes.STRING,
    allowNull: false
  },
  kelamin: {
    type: DataTypes.STRING
  },
  status: {
    type: DataTypes.STRING,
    defaultValue: 'aktif'
  },
  kelas_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  foto: {
    type: DataTypes.STRING,
    allowNull: true
  },
  no_hp_ortu: {
    type: DataTypes.STRING,
    allowNull: true
  },
  nama_ortu: {
    type: DataTypes.STRING,
    allowNull: true
  }
}, {
  tableName: 'siswa',
  timestamps: true
});

module.exports = Siswa;
