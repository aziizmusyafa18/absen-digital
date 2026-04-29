const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const MataPelajaran = sequelize.define('MataPelajaran', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  nama: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  }
}, {
  tableName: 'mata_pelajaran',
  timestamps: false // Tidak perlu created_at/updated_at untuk data master seperti ini
});

module.exports = MataPelajaran;
