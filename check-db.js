const { Kelas, Guru, GuruKelas } = require('./backend/models');

async function checkData() {
  try {
    const kCount = await Kelas.count();
    const gCount = await Guru.count();
    const gkCount = await GuruKelas.count();
    
    console.log(`Jumlah Kelas: ${kCount}`);
    console.log(`Jumlah Guru: ${gCount}`);
    console.log(`Jumlah GuruKelas: ${gkCount}`);
    
    if (kCount > 0) {
      const kelas = await Kelas.findAll({ limit: 5 });
      console.log('Contoh Kelas:', JSON.stringify(kelas, null, 2));
    }
    
    if (gCount > 0) {
      const guru = await Guru.findAll({ limit: 5 });
      console.log('Contoh Guru:', JSON.stringify(guru, null, 2));
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkData();
