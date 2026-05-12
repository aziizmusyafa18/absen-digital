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
  foto: {
    type: DataTypes.STRING,
    allowNull: true
  }
}, {
  tableName: 'siswa',
  timestamps: true
});

module.exports = Siswa;
