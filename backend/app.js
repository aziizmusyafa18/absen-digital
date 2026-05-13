const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

// Disable cache for HTML files to prevent login stuck issues
app.use((req, res, next) => {
  if (req.url.endsWith('.html') || req.url === '/') {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
  }
  next();
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Middleware untuk Socket.io
app.use((req, res, next) => {
  req.io = app.get('io');
  next();
});

// Serve static files from frontend
app.use(express.static(path.join(__dirname, '../frontend/public')));
// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
const authRoutes = require('./routes/auth');
const guruRoutes = require('./routes/guru');
const adminRoutes = require('./routes/admin');
const adminCrudRoutes = require('./routes/adminCrud');
const importRoutes = require('./routes/import');
const rekapRoutes = require('./routes/rekap');
const publicSearchRoutes = require('./routes/publicSearch');

app.use('/api/auth', authRoutes);
app.use('/api/guru', guruRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/master-data', adminCrudRoutes);
app.use('/api/import', importRoutes);
app.use('/api/rekap', rekapRoutes);
app.use('/api/public', publicSearchRoutes);

// Serve index.html for root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/login.html'));
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Absen Digital Server is running' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

module.exports = app;
