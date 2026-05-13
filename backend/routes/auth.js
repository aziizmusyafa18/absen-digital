const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { Guru, OrangTua, Siswa } = require('../models');
const { authMiddleware } = require('../middleware/auth');
const router = express.Router();

// Configure multer for profile pictures
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/profiles');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'profile-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Hanya file gambar (.jpg, .jpeg, .png, .webp) yang diizinkan'), false);
    }
  },
  limits: {
    fileSize: 2 * 1024 * 1024 // 2MB limit
  }
});

// Login untuk Guru/Admin
router.post('/login/guru', async (req, res) => {
  try {
    const { username, password } = req.body;
    console.log(`Login attempt for username: ${username}`);

    const guru = await Guru.findOne({ where: { username } });

    if (!guru) {
      console.log(`Login failed: User ${username} not found`);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    console.log(`User found, comparing password for: ${username}`);
    const isMatch = await bcrypt.compare(password, guru.password);
    
    if (!isMatch) {
      console.log(`Login failed: Password mismatch for ${username}`);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    console.log(`Login success: ${username}, generating token...`);
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
        nip: guru.nip,
        foto: guru.foto
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update Profile
router.put('/profile', authMiddleware, upload.single('foto'), async (req, res) => {
  try {
    const userId = req.user.id;
    const role = req.user.role; // Assuming role is in jwt
    
    let user;
    if (role === 'guru' || role === 'admin') {
      user = await Guru.findByPk(userId);
    } else if (role === 'orang_tua') {
      user = await OrangTua.findByPk(userId);
    } else if (role === 'siswa') {
      user = await Siswa.findByPk(userId);
    }

    if (!user) {
      return res.status(404).json({ success: false, error: 'User tidak ditemukan' });
    }

    const updateData = {};
    if (req.body.nama) updateData.nama = req.body.nama;
    if (req.body.password) {
      updateData.password = await bcrypt.hash(req.body.password, 10);
    }

    if (req.file) {
      // Delete old photo if exists
      if (user.foto) {
        const oldPath = path.join(__dirname, '..', user.foto);
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
        }
      }
      updateData.foto = 'uploads/profiles/' + req.file.filename;
    }

    await user.update(updateData);

    res.json({
      success: true,
      message: 'Profil berhasil diperbarui',
      user: {
        id: user.id,
        nama: user.nama,
        role: user.role,
        foto: user.foto
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get Profile Info
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const role = req.user.role;

    let user;
    if (role === 'guru' || role === 'admin') {
      user = await Guru.findByPk(userId, {
        attributes: { exclude: ['password'] }
      });
    } else if (role === 'orang_tua') {
      user = await OrangTua.findByPk(userId, {
        attributes: { exclude: ['password'] }
      });
    } else if (role === 'siswa') {
      user = await Siswa.findByPk(userId);
    }

    if (!user) {
      return res.status(404).json({ success: false, error: 'User tidak ditemukan' });
    }

    res.json({
      success: true,
      user
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
