const sql = require('mssql/msnodesqlv8');
const logger = require('../utils/logger');
const retry = require('../utils/retry');

const mainConfig = {
  server: process.env.SERVER,
  database: process.env.DATABASE,
  user: process.env.USER,
  password: process.env.PASSWORD,
  driver: 'msnodesqlv8',
  options: {
    encrypt: false,
    trustServerCertificate: true,
    trustedConnection: false,
    enableArithAbort: true
  },
  connectionTimeout: 30000,
  requestTimeout: 30000,
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  }
};

const pools = new Map();
const RECONNECT_INTERVAL = 5 * 60 * 1000; // 5 minutes
const MAX_RETRIES = 3;
const poolTimeouts = new Map();

async function getMainPool() {
  if (!pools.has('main')) {
    try {
      logger.info('Attempting database connection with config:', {
        server: mainConfig.server,
        database: mainConfig.database,
        user: mainConfig.user
      });

      const pool = await retry.withRetries(
        async () => {
          const newPool = new sql.ConnectionPool(mainConfig);
          await newPool.connect();
          return newPool;
        },
        MAX_RETRIES,
        'main database'
      );
      
      await pool.request().query('SELECT @@VERSION as version');
      
      pools.set('main', pool);
      logger.info('Successfully connected to main database');
      
      // Setup periodic connection check
      setInterval(async () => {
        try {
          await pool.request().query('SELECT 1');
        } catch (err) {
          logger.warn('Main database connection lost, attempting reconnect...');
          pools.delete('main');
          await getMainPool();
        }
      }, RECONNECT_INTERVAL);
      
      return pool;
    } catch (err) {
      logger.error('Error connecting to main database:', {
        error: err.message,
        code: err.code,
        state: err.state,
        server: mainConfig.server,
        database: mainConfig.database,
        user: mainConfig.user
      });
      throw err;
    }
  }
  return pools.get('main');
}

async function getCustomerPool(config) {
  const poolKey = `${config.dbHost}_${config.dbName}`;
  
  if (poolTimeouts.has(poolKey)) {
    clearTimeout(poolTimeouts.get(poolKey));
  }

  if (!pools.has(poolKey)) {
    logger.info(`Creating new connection pool for ${config.dbName}`);
    
    const customerConfig = {
      server: config.dbHost,
      database: config.dbName,
      user: config.dbUser,
      password: config.dbPassword,
      driver: 'msnodesqlv8',
      options: {
        encrypt: false,
        trustServerCertificate: true,
        trustedConnection: false
      },
      connectionTimeout: 30000,
      requestTimeout: 30000,
      pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
      }
    };

    try {
      const pool = await retry.withRetries(
        async () => {
          const newPool = new sql.ConnectionPool(customerConfig);
          await newPool.connect();
          return newPool;
        },
        MAX_RETRIES,
        `customer database ${config.dbName}`
      );
      
      pools.set(poolKey, pool);
      logger.info(`Connected to customer database: ${config.dbName}`);
      
      // Setup periodic connection check
      setInterval(async () => {
        try {
          await pool.request().query('SELECT 1');
        } catch (err) {
          logger.warn(`Customer database ${config.dbName} connection lost, attempting reconnect...`);
          pools.delete(poolKey);
          await getCustomerPool(config);
        }
      }, RECONNECT_INTERVAL);
      
      return pool;
    } catch (err) {
      logger.error(`Error connecting to customer database ${config.dbName}:`, err);
      throw err;
    }
  }

  poolTimeouts.set(poolKey, setTimeout(async () => {
    try {
      const pool = pools.get(poolKey);
      if (pool) {
        await pool.close();
        pools.delete(poolKey);
        poolTimeouts.delete(poolKey);
        logger.info(`Closed inactive pool for ${poolKey}`);
      }
    } catch (err) {
      logger.error(`Error closing pool ${poolKey}:`, err);
    }
  }, 15 * 60 * 1000));

  return pools.get(poolKey);
}

async function closeAllPools() {
  for (const [key, pool] of pools.entries()) {
    try {
      await pool.close();
      pools.delete(key);
      if (poolTimeouts.has(key)) {
        clearTimeout(poolTimeouts.get(poolKey));
        poolTimeouts.delete(poolKey);
      }
      logger.info(`Closed database pool: ${key}`);
    } catch (err) {
      logger.error(`Error closing pool ${key}:`, err);
    }
  }
}

module.exports = {
  getMainPool,
  getCustomerPool,
  closeAllPools
};