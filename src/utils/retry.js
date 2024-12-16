const logger = require('./logger');

async function withRetries(operation, maxRetries, operationName, delay = 5000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (err) {
      if (attempt === maxRetries) {
        logger.error(`All ${maxRetries} attempts failed for ${operationName}:`, err);
        throw err;
      }
      
      logger.warn(`Attempt ${attempt}/${maxRetries} failed for ${operationName}, retrying in ${delay/1000}s...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

module.exports = {
  withRetries
};