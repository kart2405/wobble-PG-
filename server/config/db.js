const { Sequelize } = require('sequelize');
const config = require('config');

const sequelize = new Sequelize(config.get('DATABASE_URL'), {
  dialect: 'postgres',
  logging: false, // Set to console.log to see SQL queries
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  }
});

const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log('Successfully connected to PostgreSQL');
    
    // Sync all models with database
    await sequelize.sync({ alter: true });
    console.log('Database synchronized');
  } catch (err) {
    console.error('Database connection error:', err.message);
    process.exit(1);
  }
};

module.exports = { connectDB, sequelize };
