const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const OrangTua = sequelize.define('OrangTua', {
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
  email: {
    type: DataTypes.STRING,
    unique: true
  },
  phone: {
    type: DataTypes.STRING
  }
}, {
  tableName: 'orang_tua',
  timestamps: true
});

module.exports = OrangTua;
