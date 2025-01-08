const sql = require('mssql/msnodesqlv8');
const logger = require('../utils/logger');

async function insertSensorData(customerPool, data) {
  try {
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