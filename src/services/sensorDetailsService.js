const logger = require('../utils/logger');

class SensorDetailsService {
  constructor() {
    this.sensorCache = new Map(); // baseUnit -> Set of sensors
  }

  async publishSensorDetails(mqttClient, company, baseUnit, sensors) {
    if (!company || !company.mqtt_topic) {
      throw new Error(`Invalid company object or missing mqtt_topic for base unit ${baseUnit}`);
    }

    const topic = `${company.mqtt_topic}/${baseUnit}/sensordetails`;
    // Ensure unique sensors using Set
    const uniqueSensors = [...new Set(sensors)];
    const message = {
      "sensors": uniqueSensors.sort((a, b) => a - b)
    };

    try {
      logger.info(`Publishing sensor details to topic ${topic}`);
      const formattedMessage = JSON.stringify(message, null, 2);
      await mqttClient.publishRetained(topic, formattedMessage);
      logger.info(`Published sensor details for base unit ${baseUnit} to ${topic}`);
    } catch (err) {
      logger.error(`Error publishing sensor details for base unit ${baseUnit}:`, err);
      throw err;
    }
  }

  hasChanged(baseUnit, newSensors) {
    // Convert newSensors to Set for unique values
    const newSensorSet = new Set(newSensors);
    const currentSensorSet = this.sensorCache.get(baseUnit) || new Set();
    
    if (currentSensorSet.size !== newSensorSet.size) return true;
    
    // Compare sets
    return ![...newSensorSet].every(sensor => currentSensorSet.has(sensor));
  }

  updateCache(baseUnit, sensors) {
    // Store unique sensors only
    this.sensorCache.set(baseUnit, new Set(sensors));
  }
}

module.exports = new SensorDetailsService();