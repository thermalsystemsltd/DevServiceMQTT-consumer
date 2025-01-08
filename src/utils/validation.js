function isValidTemperature(temperature) {
  return /^\d+\.\d+$/.test(temperature);
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