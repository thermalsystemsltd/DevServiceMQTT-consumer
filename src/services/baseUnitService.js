const sql = require('mssql/msnodesqlv8');
const logger = require('../utils/logger');
const sensorDetailsService = require('./sensorDetailsService');
const baseTypeService = require('./baseTypeService');

async function getActiveBaseUnitsFromDb(customerPool) {
  try {
    const result = await customerPool.request()
      .query(`
        SELECT bu.serialNo, bu.id, bt.type
        FROM [${customerPool.config.database}].dbo.base_units bu
        LEFT JOIN [${customerPool.config.database}].dbo.base_types bt 
          ON bu.id = bt.base_id
        WHERE bu.is_deleted = 0
      `);
    return result.recordset;
  } catch (err) {
    logger.error('Error querying active base units:', err);
    throw err;
  }
}

async function getActiveSensorsFromDb(customerPool) {
  try {
    const result = await customerPool.request()
      .query(`
        SELECT s.serialNo, bt.type
        FROM [${customerPool.config.database}].dbo.sensors s
        LEFT JOIN [${customerPool.config.database}].dbo.base_types bt 
          ON s.type = bt.type
        WHERE s.is_deleted = 0
      `);
    return result.recordset.map(sensor => ({
      serialNo: parseInt(sensor.serialNo),
      type: sensor.type
    }));
  } catch (err) {
    logger.error('Error querying active sensors:', err);
    throw err;
  }
}

async function getActiveBaseUnits(customerPool, mqttClient, company) {
  try {
    const baseUnits = await getActiveBaseUnitsFromDb(customerPool);
    const activeSensors = await getActiveSensorsFromDb(customerPool);
    
    // If we have an MQTT client and active sensors, publish to all base units
    if (mqttClient && baseUnits.length > 0) {
      logger.info(`Publishing sensor details to ${baseUnits.length} base units`);
      for (const baseUnit of baseUnits) {
        // Only process base units that have a type
        if (baseUnit.type !== null) {
          // Filter sensors matching base unit type
          const matchingSensors = activeSensors
            .filter(sensor => sensor.type === baseUnit.type)
            .map(sensor => sensor.serialNo);

          if (sensorDetailsService.hasChanged(baseUnit.serialNo, matchingSensors)) {
            logger.info(`Sensor list changed for base unit ${baseUnit.serialNo} (type ${baseUnit.type}), publishing update`);
            await sensorDetailsService.publishSensorDetails(mqttClient, company, baseUnit.serialNo, matchingSensors);
            sensorDetailsService.updateCache(baseUnit.serialNo, matchingSensors);
          }
        } else {
          logger.warn(`Base unit ${baseUnit.serialNo} has no type assigned, skipping sensor details publication`);
        }
      }
    }
    
    return baseUnits.map(unit => unit.serialNo);
  } catch (err) {
    logger.error('Error in getActiveBaseUnits:', err);
    throw err;
  }
}

async function isValidSensor(customerPool, serialNumber) {
  try {
    const result = await customerPool.request()
      .input('serialNo', sql.VarChar, serialNumber)
      .query(`
        SELECT 1 
        FROM [${customerPool.config.database}].dbo.sensors 
        WHERE serialNo = @serialNo 
        AND is_deleted = 0
      `);
    
    return result.recordset.length > 0;
  } catch (err) {
    logger.error('Error checking sensor validity:', err);
    throw err;
  }
}

module.exports = {
  getActiveBaseUnits,
  isValidSensor
};