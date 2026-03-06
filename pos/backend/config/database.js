const dbManager = require('./databaseManager');

const connectDB = async () => {
  try {
    await dbManager.initialize();
    console.log('Database connected successfully');
  } catch (error) {
    console.error(`Error connecting to database: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
