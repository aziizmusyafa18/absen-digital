const http = require('http');
const socketIo = require('socket.io');
const app = require('./app');
const { sequelize } = require('./models');
const setupSocket = require('./socket/socketHandler');
require('dotenv').config();

// Inisialisasi WhatsApp Gateway (otomatis terpicu karena index file mengeksekusi client.initialize())
require('./utils/whatsapp');

// Inisialisasi Cron Jobs (Peringatan Harian)
require('./utils/cron');

const server = http.createServer(app);

// Setup Socket.io
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Initialize socket handler
const socketHandler = setupSocket(io);

// Make io accessible to routes via app.set
app.set('io', io);

const PORT = process.env.PORT || 3000;

// Initialize database and sync models
const initializeDatabase = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connection established successfully.');

    // Di Docker/Produksi dengan data yang sudah di-import manual, 
    // kita matikan sync() agar tidak bentrok dengan constraint SQL lokal.
    if (process.env.NODE_ENV !== 'production') {
      await sequelize.sync();
      console.log('✅ Database synchronized successfully.');
    } else {
      console.log('ℹ️  Skipping database sync in production mode.');
    }

    // Pastikan kolom no_hp_ortu dan nama_ortu ada di tabel siswa
    try {
      const [colsNoHpOrtu] = await sequelize.query("SHOW COLUMNS FROM `siswa` LIKE 'no_hp_ortu'");
      if (colsNoHpOrtu.length === 0) {
        await sequelize.query("ALTER TABLE `siswa` ADD COLUMN `no_hp_ortu` VARCHAR(255) NULL");
      }
      const [colsNamaOrtu] = await sequelize.query("SHOW COLUMNS FROM `siswa` LIKE 'nama_ortu'");
      if (colsNamaOrtu.length === 0) {
        await sequelize.query("ALTER TABLE `siswa` ADD COLUMN `nama_ortu` VARCHAR(255) NULL");
      }
    } catch (colErr) {
      console.warn('⚠️ Warning checking/adding siswa columns:', colErr.message);
    }

  } catch (error) {
    console.error('❌ Unable to connect to the database:', error);
    process.exit(1);
  }
};

// Start server
const startServer = async () => {
  await initializeDatabase();

  server.listen(PORT, () => {
    console.log(`🚀 Server is running on http://localhost:${PORT}`);
    console.log(`📡 Socket.io is ready for realtime connections`);
  });
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Promise Rejection:', err);
  server.close(() => {
    process.exit(1);
  });
});

startServer();
