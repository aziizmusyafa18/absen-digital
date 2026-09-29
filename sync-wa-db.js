const { sequelize, Siswa, LogNotifikasi } = require('./backend/models');

async function migrate() {
  try {
    await sequelize.query("ALTER TABLE siswa ADD COLUMN no_hp_ortu VARCHAR(255) NULL");
    await sequelize.query("ALTER TABLE siswa ADD COLUMN nama_ortu VARCHAR(255) NULL");
    console.log("Columns added to siswa.");
  } catch (err) {
    console.log("Columns might already exist or error:", err.message);
  }
  
  try {
    await LogNotifikasi.sync({ alter: true });
    console.log("LogNotifikasi table synced.");
  } catch (err) {
    console.log("Error syncing LogNotifikasi:", err.message);
  }
  process.exit();
}
migrate();
