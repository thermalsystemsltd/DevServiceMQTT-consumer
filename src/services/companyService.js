const sql = require('mssql/msnodesqlv8');
const { getMainPool } = require('../config/database');
const logger = require('../utils/logger');

async function getCompanies() {
  try {
    const pool = await getMainPool();
    const result = await pool.request()
      .query(`
        SELECT Name, dbUser, dbPassword, dbHost, dbName, mqtt_topic 
        FROM [${pool.config.database}].dbo.companies
      `);
    
    return result.recordset;
  } catch (err) {
    logger.error('Error fetching companies:', err);
    throw err;
  }
}

module.exports = {
  getCompanies
};