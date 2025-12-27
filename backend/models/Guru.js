const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Guru = sequelize.define('Guru', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  username: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false
  },
  nama: {
    type: DataTypes.STRING,
    allowNull: false
  },
  nip: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false
  },
  mapel: {
    type: DataTypes.STRING,
    allowNull: false
  },
  jam_mulai: {
    type: DataTypes.TIME,
    allowNull: true,
    defaultValue: null
  },
  role: {
    type: DataTypes.ENUM('guru', 'admin'),
    defaultValue: 'guru'
  }
}, {
  tableName: 'guru',
  timestamps: true
});

module.exports = Guru;
