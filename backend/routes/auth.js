const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Guru, OrangTua } = require('../models');
const router = express.Router();

// Login untuk Guru/Admin
router.post('/login/guru', async (req, res) => {
  try {
    const { username, password } = req.body;

    const guru = await Guru.findOne({ where: { username } });

    if (!guru || !await bcrypt.compare(password, guru.password)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: guru.id, role: guru.role, nama: guru.nama },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      token,
      user: {
        id: guru.id,
        nama: guru.nama,
        role: guru.role,
        mapel: guru.mapel,
        nip: guru.nip
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
