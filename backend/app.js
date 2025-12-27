const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from frontend
app.use(express.static(path.join(__dirname, '../frontend/public')));

// Routes
const authRoutes = require('./routes/auth');
const guruRoutes = require('./routes/guru');
const adminRoutes = require('./routes/admin');
const adminCrudRoutes = require('./routes/adminCrud');
const orangTuaRoutes = require('./routes/orangTua');
const importRoutes = require('./routes/import');
const rekapRoutes = require('./routes/rekap');

app.use('/api/auth', authRoutes);
app.use('/api/guru', guruRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/master-data', adminCrudRoutes);
app.use('/api/orang-tua', orangTuaRoutes);
app.use('/api/import', importRoutes);
app.use('/api/rekap', rekapRoutes);

// Serve index.html for root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/index.html'));
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
