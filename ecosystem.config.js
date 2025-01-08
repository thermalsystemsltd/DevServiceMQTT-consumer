module.exports = {
  apps: [{
    name: 'MQTTConsumer',
    script: './src/index.js',
    interpreter: 'node@18.20.4',
    env: {
      SERVER: '81.133.236.250,32795\\DEVSERVER',
      DATABASE: 'db1',
      PORT: '32795',
      USER: 'MONITOR',
      PASSWORD: 'Thermal13',
      MQTTBROKER: 'tcp://81.133.236.250:1883'
    },
    env_production: {
      SERVER: '81.133.236.250,32795\\DEVSERVER',
      DATABASE: 'db1',
      PORT: '32795',
      USER: 'MONITOR',
      PASSWORD: 'Thermal13',
      MQTTBROKER: 'tcp://81.133.236.250:1883'
    }
  }]
};