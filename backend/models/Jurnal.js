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
  }
}, {
  tableName: 'jurnal',
  timestamps: true
});

module.exports = Jurnal;
