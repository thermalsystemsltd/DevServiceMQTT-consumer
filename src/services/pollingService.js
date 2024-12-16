const logger = require('../utils/logger');
const { getCompanies } = require('./companyService');
const { getCustomerPool } = require('../config/database');
const { getActiveBaseUnits } = require('./baseUnitService');

class PollingService {
  constructor(pollingInterval = 60 * 1000) { // 1 minute default
    this.pollingInterval = pollingInterval;
    this.isPolling = false;
    this.timer = null;
    this.currentPoll = null;
    this.clients = new Map(); // Store MQTT clients
  }

  addClient(companyName, mqttClient) {
    this.clients.set(companyName, mqttClient);
  }

  async pollDatabases() {
    if (this.currentPoll) {
      logger.warn('Previous poll still in progress, skipping this iteration');
      return;
    }

    this.currentPoll = (async () => {
      try {
        logger.info('Starting database poll...');
        const companies = await getCompanies();
        
        for (const company of companies) {
          try {
            logger.info(`Polling company ${company.Name}...`);
            
            // Get customer-specific connection pool
            const customerPool = await getCustomerPool({
              dbHost: company.dbHost,
              dbName: company.dbName,
              dbUser: company.dbUser,
              dbPassword: company.dbPassword
            });
            
            // Verify we're connected to the correct customer database
            const dbCheck = await customerPool.request()
              .query('SELECT DB_NAME() as currentDb');
            logger.info(`Using customer database: ${dbCheck.recordset[0].currentDb}`);

            // Get base units from customer database
            const mqttClient = this.clients.get(company.Name);
            if (!mqttClient) {
              logger.warn(`No MQTT client found for company ${company.Name}`);
              return;
            }

            const baseUnits = await getActiveBaseUnits(customerPool, mqttClient, company);
            if (baseUnits.length > 0) {
              logger.info(`Found ${baseUnits.length} active base units for ${company.Name}`);
              
              // Update subscriptions for each base unit
              for (const serialNo of baseUnits) {
                const topic = `${company.mqtt_topic}/${serialNo}/#`;
                try {
                  await mqttClient.subscribe(topic);
                } catch (err) {
                  logger.error(`Failed to subscribe to topic ${topic}:`, err);
                }
              }
              
              logger.info(`Successfully updated subscriptions for ${company.Name}`);
            } else {
              logger.warn(`No active base units found for ${company.Name}`);
            }
          } catch (err) {
            logger.error(`Error polling company ${company.Name}:`, err);
          }
        }
        logger.info('Database poll completed');
      } catch (err) {
        logger.error('Error during database polling:', err);
      } finally {
        this.currentPoll = null;
      }
    })();

    await this.currentPoll;
  }

  start() {
    if (this.isPolling) return;
    
    this.isPolling = true;
    logger.info(`Starting database polling service (interval: ${this.pollingInterval}ms)`);
    
    // Initial poll
    this.pollDatabases();
    
    // Setup recurring poll
    this.timer = setInterval(() => {
      this.pollDatabases();
    }, this.pollingInterval);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isPolling = false;
    logger.info('Stopped database polling service');
  }
}

module.exports = new PollingService();