require('dotenv').config();
const path = require('path');
const fs = require('fs');
const logger = require('./utils/logger');

// Check if .env file exists and was loaded
const envPath = path.join(process.cwd(), '.env');
if (!fs.existsSync(envPath)) {
  logger.error(`.env file not found at ${envPath}`);
  process.exit(1);
}

// Verify essential environment variables
const requiredEnvVars = [
  ['DB_SERVER', 'SERVER'],
  ['DB_NAME', 'DATABASE'],
  ['DB_USER', 'USER'],
  ['DB_PASSWORD', 'PASSWORD'],
  ['MQTTBROKER']
];

const missingVars = requiredEnvVars.filter(varName => {
  if (Array.isArray(varName)) {
    // Check if at least one of the alternatives exists
    return !varName.some(v => process.env[v]);
  }
  return !process.env[varName];
});

if (missingVars.length > 0) {
  logger.error(`Missing required environment variables: ${missingVars.join(', ')}`);
  process.exit(1);
}

logger.info('Environment variables loaded successfully');

const { getCompanies } = require('./services/companyService');
const { getCustomerPool } = require('./config/database');
const { getActiveBaseUnits } = require('./services/baseUnitService');
const MqttClient = require('./mqtt/client');
const pollingService = require('./services/pollingService');

const clients = new Map();

async function setupCompanyConnection(company) {
  try {
    logger.info(`Setting up connection for company: ${company.Name}`);
    logger.info(`Connecting to database ${company.dbName} on ${company.dbHost}`);
    
    const customerPool = await getCustomerPool({
      dbHost: company.dbHost,
      dbName: company.dbName,
      dbUser: company.dbUser,
      dbPassword: company.dbPassword
    });

    const mqttClient = new MqttClient(
      process.env.MQTTBROKER || 'tcp://81.133.236.250:1883',
      company,
      customerPool
    );

    const baseUnits = await getActiveBaseUnits(customerPool, mqttClient, company);
    
    if (baseUnits.length === 0) {
      logger.warn(`No active base units found for company ${company.Name}`);
      await mqttClient.disconnect();
      return;
    }

    for (const serialNo of baseUnits) {
      const topic = `${company.mqtt_topic}/${serialNo}/#`;
      try {
        await mqttClient.subscribe(topic);
      } catch (err) {
        logger.error(`Failed to subscribe to topic ${topic}:`, err);
      }
    }

    clients.set(company.Name, mqttClient);
    pollingService.addClient(company.Name, mqttClient);
    logger.info(`Setup complete for company: ${company.Name}`);
  } catch (err) {
    logger.error(`Error setting up company ${company.Name}:`, err);
  }
}

async function main() {
  try {
    const companies = await getCompanies();
    logger.info(`Starting setup for ${companies.length} companies`);
    
    await Promise.all(companies.map(setupCompanyConnection));

    // Start polling service after initial setup
    pollingService.start();

    process.on('SIGTERM', async () => {
      logger.info('Received SIGTERM. Cleaning up...');
      pollingService.stop();
      for (const [name, client] of clients) {
        await client.disconnect();
        logger.info(`Disconnected client for ${name}`);
      }
      process.exit(0);
    });

  } catch (err) {
    logger.error('Fatal error:', err);
    process.exit(1);
  }
}

main();