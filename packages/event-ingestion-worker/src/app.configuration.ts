export interface DatabaseConfig {
  uri: string;
}

export interface BrokerConfig {
  url: string;
  queue: string;
}

export default () => ({
  database: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/webhook',
  },
  broker: {
    url: process.env.RABBIT_MQ_CONN || 'amqp://localhost:5672',
    queue: process.env.RABBIT_MQ_QUEUE || 'webhook.events',
  },
});
