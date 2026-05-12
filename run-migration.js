const { sequelize } = require('./backend/models');
const { DataTypes } = require('sequelize');

async function migrate() {
  try {
    const queryInterface = sequelize.getQueryInterface();
    const tables = await queryInterface.showAllTables();
    
    const targets = [
      { table: 'guru', column: 'foto' },
      { table: 'siswa', column: 'foto' },
      { table: 'orang_tua', column: 'foto' }
    ];

    for (const target of targets) {
      const tableInfo = await queryInterface.describeTable(target.table);
      if (!tableInfo[target.column]) {
        console.log(`Adding column ${target.column} to ${target.table}...`);
        await queryInterface.addColumn(target.table, target.column, {
          type: DataTypes.STRING,
          allowNull: true
        });
        console.log(`Successfully added ${target.column} to ${target.table}.`);
      } else {
        console.log(`Column ${target.column} already exists in ${target.table}.`);
      }
    }

    console.log('Migration completed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrate();
