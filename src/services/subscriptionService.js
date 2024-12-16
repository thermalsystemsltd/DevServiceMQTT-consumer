const logger = require('../utils/logger');

class SubscriptionService {
  constructor() {
    this.subscriptions = new Map(); // company -> Set of topics
    this.clients = new Map(); // company -> MqttClient
  }

  addClient(company, mqttClient) {
    this.clients.set(company.Name, mqttClient);
    this.subscriptions.set(company.Name, new Set());
  }

  getTopics(companyName) {
    return this.subscriptions.get(companyName) || new Set();
  }

  async updateSubscriptions(company, baseUnits) {
    const client = this.clients.get(company.Name);
    if (!client) {
      logger.error(`No MQTT client found for company ${company.Name}`);
      return;
    }

    const currentTopics = this.getTopics(company.Name);
    const newTopics = new Set(baseUnits.map(serialNo => `${company.mqtt_topic}/${serialNo}/#`));

    // Subscribe to new topics
    for (const topic of newTopics) {
      if (!currentTopics.has(topic)) {
        try {
          await client.subscribe(topic);
          currentTopics.add(topic);
          logger.info(`Subscribed to new topic: ${topic}`);
        } catch (err) {
          logger.error(`Error subscribing to ${topic}:`, err);
        }
      }
    }

    // Unsubscribe from removed topics
    for (const topic of currentTopics) {
      if (!newTopics.has(topic)) {
        try {
          await client.unsubscribe(topic);
          currentTopics.delete(topic);
          logger.info(`Unsubscribed from topic: ${topic}`);
        } catch (err) {
          logger.error(`Error unsubscribing from ${topic}:`, err);
        }
      }
    }

    this.subscriptions.set(company.Name, currentTopics);
  }
}

module.exports = new SubscriptionService();