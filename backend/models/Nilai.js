const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Nilai = sequelize.define('Nilai', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  nilai: {
    type: DataTypes.FLOAT,
    allowNull: false,
    validate: {
      min: 0,
      max: 100
    }
  },
  keterangan: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Contoh: Ulangan Harian 1, Tugas 2, UTS, UAS'
  },
  mata_pelajaran: {
    type: DataTypes.STRING,
    allowNull: false
  },
  tanggal: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'nilai',
  timestamps: true
});

module.exports = Nilai;
