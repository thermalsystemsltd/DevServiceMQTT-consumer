const sql = require('mssql/msnodesqlv8');
const logger = require('../utils/logger');

async function insertSensorData(customerPool, data) {
  try {
    // First check if this data point already exists
    const existingData = await customerPool.request()
      .input('sensor_id', sql.VarChar, data.serialNumber)
      .input('timestamp', sql.DateTime, new Date(data.timestamp))
      .query(`
        SELECT TOP 1 1 
        FROM [${customerPool.config.database}].dbo.sensor_data 
        WHERE sensor_id = @sensor_id 
        AND log_datetime = @timestamp
      `);

    if (existingData.recordset.length > 0) {
      logger.warn(`Duplicate data point detected for sensor ${data.serialNumber} at ${data.timestamp}`);
      return;
    }

    // Proceed with insert if no duplicate found
    await customerPool.request()
      .input('sensor_id', sql.VarChar, data.serialNumber)
      .input('temperature', sql.Float, parseFloat(data.temperature))
      .input('timestamp', sql.DateTime, new Date(data.timestamp))
      .input('battery', sql.Float, data.Voltage ? parseFloat(data.Voltage) : null)
      .input('RSSI', sql.Int, data.RSSI ? parseInt(data.RSSI) : null)
      .input('SNR', sql.Float, data.SNR ? parseFloat(data.SNR) : null)
      .input('humidity', sql.Float, data.humidity ? parseFloat(data.humidity) : null)
      .query(`
        INSERT INTO [${customerPool.config.database}].dbo.sensor_data 
        (sensor_id, temperature, log_datetime, battery, RSSI, SNR, hum)
        VALUES (@sensor_id, @temperature, @timestamp, @battery, @RSSI, @SNR, @humidity)
      `);
    
    logger.info(`Inserted data for sensor ${data.serialNumber}`);
  } catch (err) {
    logger.error(`Error inserting sensor data for ${data.serialNumber}:`, err);
    throw err;
  }
}

module.exports = {
  insertSensorData
};