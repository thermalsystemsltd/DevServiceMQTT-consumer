function isValidTemperature(temperature) {
  // First convert to string in case we receive a number
  const tempStr = String(temperature);
  
  // Allow negative or positive numbers with optional decimal places
  const isValid = /^-?\d+\.?\d*$/.test(tempStr);
  
  // Add debug logging
  if (!isValid) {
    logger.debug(`Temperature validation failed for value: ${temperature}, type: ${typeof temperature}`);
  }
  
  return isValid;
}

function isValidTimestamp(timestamp) {
  return /^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}$/.test(timestamp);
}

function isValidSerialNumber(serialNumber) {
  return !isNaN(parseInt(serialNumber, 10)) && serialNumber !== "unknown";
}

function isValidVoltage(voltage) {
  return voltage && /^\d+\.\d+$/.test(voltage);
}

function isValidRSSI(rssi) {
  return rssi && /^-?\d+$/.test(rssi);
}

function isValidSNR(snr) {
  return snr && /^\d+\.\d+$/.test(snr);
}

function isValidHumidity(humidity) {
  return humidity && /^\d+\.\d+$/.test(humidity);
}

module.exports = {
  isValidTemperature,
  isValidTimestamp,
  isValidSerialNumber,
  isValidVoltage,
  isValidRSSI,
  isValidSNR,
  isValidHumidity
};