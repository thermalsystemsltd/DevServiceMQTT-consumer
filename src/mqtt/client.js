const mqtt = require('mqtt');
const logger = require('../utils/logger');
const { handleMessage } = require('./messageHandler');
const retry = require('../utils/retry');

const RECONNECT_INTERVAL = 5 * 60 * 1000; // 5 minutes
const KEEPALIVE = 60; // seconds

class MqttClient {
  constructor(brokerUrl, company, customerPool) {
    this.client = mqtt.connect(brokerUrl, {
      keepalive: KEEPALIVE,
      reconnectPeriod: 5000,
      connectTimeout: 30000,
      clean: true,
      clientId: `mqtt-client-${company.Name}-${Math.random().toString(16).substring(2, 8)}`
    });
    this.company = company;
    this.customerPool = customerPool;
    this.topics = new Set();
    this.isConnected = false;
    this.subscriptionQueue = [];
    this.retainedTopics = new Set();
    
    this.setupEventHandlers();
    this.setupPeriodicReconnect();
  }

  setupEventHandlers() {
    this.client.on('connect', () => {
      this.isConnected = true;
      logger.info(`Connected to MQTT broker for ${this.company.Name}`);
      this.processSubscriptionQueue();
    });

    this.client.on('reconnect', () => {
      logger.info(`Attempting to reconnect MQTT client for ${this.company.Name}`);
    });

    this.client.on('offline', () => {
      this.isConnected = false;
      logger.warn(`MQTT client offline for ${this.company.Name}`);
    });

    this.client.on('close', () => {
      this.isConnected = false;
      logger.warn(`MQTT connection closed for ${this.company.Name}`);
    });

    this.client.on('message', (topic, message) => {
      handleMessage(topic, message, this.customerPool);
    });

    this.client.on('error', (err) => {
      logger.error(`MQTT client error for ${this.company.Name}:`, err);
    });
  }

  addTopic(baseUnitSerial) {
    const topic = `${this.company.mqtt_topic}/${baseUnitSerial}/#`;
    this.topics.add(topic);
    this.subscriptionQueue.push(topic);
    
    if (this.isConnected) {
      this.processSubscriptionQueue();
    }
  }

  async processSubscriptionQueue() {
    while (this.subscriptionQueue.length > 0) {
      const topic = this.subscriptionQueue.shift();
      try {
        await new Promise((resolve, reject) => {
          this.client.subscribe(topic, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
        logger.info(`Subscribed to topic: ${topic}`);
      } catch (err) {
        logger.error(`Error subscribing to ${topic}:`, err);
        this.subscriptionQueue.push(topic); // Re-queue failed subscriptions
        break;
      }
    }
  }

  subscribe(topic) {
    return new Promise((resolve, reject) => {
      if (!this.isConnected) {
        this.subscriptionQueue.push(topic);
        resolve();
        return;
      }

      this.client.subscribe(topic, { qos: 1, nl: true }, (err, granted) => {
        if (err) {
          logger.error(`Failed to subscribe to ${topic}:`, err);
          reject(err);
        } else {
          logger.info(`Successfully subscribed to ${topic}`);
          resolve(granted);
        }
      });
    });
  }

  publishRetained(topic, message) {
    return new Promise((resolve, reject) => {
      this.client.publish(
        topic,
        typeof message === 'string' ? message : JSON.stringify(message, null, 2),
        { retain: true, qos: 1 },
        (err) => {
          if (err) reject(err);
          else {
            this.retainedTopics.add(topic);
            resolve();
          }
        }
      );
    });
  }

  setupPeriodicReconnect() {
    setInterval(async () => {
      if (!this.isConnected) {
        logger.info(`Periodic reconnection attempt for ${this.company.Name}`);
        await retry.withRetries(
          async () => {
            if (!this.isConnected) {
              this.client.reconnect();
            }
          },
          3,
          `MQTT reconnection for ${this.company.Name}`
        );
      }
    }, RECONNECT_INTERVAL);
  }

  disconnect() {
    return new Promise((resolve) => {
      this.client.end(true, {}, resolve);
    });
  }
}

module.exports = MqttClient;
