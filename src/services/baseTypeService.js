const sql = require('mssql/msnodesqlv8');
const logger = require('../utils/logger');

async function getBaseTypes(customerPool) {
  try {
    const result = await customerPool.request()
      .query(`
        SELECT base_id, type, description
        FROM [${customerPool.config.database}].dbo.base_types
      `);
    return result.recordset;
  } catch (err) {
    logger.error('Error fetching base types:', err);
    throw err;
  }
}

async function getBaseTypeById(customerPool, baseId) {
  try {
    const result = await customerPool.request()
      .input('baseId', sql.Int, baseId)
      .query(`
        SELECT type, description
        FROM [${customerPool.config.database}].dbo.base_types
        WHERE base_id = @baseId
      `);
    return result.recordset[0];
  } catch (err) {
    logger.error(`Error fetching base type for ID ${baseId}:`, err);
    throw err;
  }
}

module.exports = {
  getBaseTypes,
  getBaseTypeById
};