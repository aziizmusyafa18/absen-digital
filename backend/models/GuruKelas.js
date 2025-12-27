const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const GuruKelas = sequelize.define('GuruKelas', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  guru_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  kelas_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  mata_pelajaran: {
    type: DataTypes.STRING,
    allowNull: true
  }
}, {
  tableName: 'guru_kelas',
  timestamps: true
});

module.exports = GuruKelas;
