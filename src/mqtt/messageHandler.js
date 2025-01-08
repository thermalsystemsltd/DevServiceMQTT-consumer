const logger = require('../utils/logger');
const { isValidSensor } = require('../services/baseUnitService');
const { insertSensorData } = require('../services/sensorDataService');
const validation = require('../utils/validation');

async function handleMessage(topic, message, customerPool) {
  try {
    const data = JSON.parse(message.toString());
    logger.info(`Processing message for sensor ${data.serialNumber}`);

    // Skip non-data messages
    if (topic.endsWith('/config') || topic.endsWith('/sensordetails') || topic.endsWith('/unknown')) {
      logger.info('Skipping non-data message');
      return;
    }

    // Validate required fields
    if (!validation.isValidSerialNumber(data.serialNumber)) {
      logger.warn(`Invalid serial number format: ${data.serialNumber}`);
      return;
    }

    if (!validation.isValidTemperature(data.temperature)) {
      logger.warn(`Invalid temperature format: ${data.temperature}`);
      return;
    }

    if (!validation.isValidTimestamp(data.timestamp)) {
      logger.warn(`Invalid timestamp format: ${data.timestamp}`);
      return;
    }

    if (data.humidity && !validation.isValidHumidity(data.humidity)) {
      logger.warn(`Invalid humidity format: ${data.humidity}`);
      return;
    }

    // Validate sensor exists and is active
    const isValid = await isValidSensor(customerPool, data.serialNumber);
    if (!isValid) {
      logger.warn(`Invalid or inactive sensor: ${data.serialNumber}`);
      return;
    }

    // Handle backfill data
    if (data.firmwareVersion === 'N/A') {
      logger.info(`Processing backfill data for sensor ${data.serialNumber}`);
    }

    // Insert data with retries
    await retryOperation(() => insertSensorData(customerPool, data), 3, 5000);
    logger.info(`Successfully processed message for sensor ${data.serialNumber}`);
  } catch (err) {
    logger.error('Error handling message:', err);
  }
}

async function retryOperation(operation, retries, delay) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await operation();
      return;
    } catch (err) {
      if (attempt < retries) {
        logger.warn(`Attempt ${attempt} failed. Retrying in ${delay / 1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        logger.error(`All ${retries} attempts failed:`, err);
        throw err;
      }
    }
  }
}

module.exports = {
  handleMessage
};