export interface AppConfig {
  applicationId: string;
  applicationName: string;
}
export interface BrokerConfig {
  url: string;
  queue: string;
}

export default () => ({
  // Deployed build version, surfaced by `GET /versionz` — set per environment by the platform (see .env.example).
  version: process.env.VERSION || 'unknown',
  broker: {
    url: process.env.RABBIT_MQ_CONN || 'amqp://localhost:5672',
    queue: process.env.RABBIT_MQ_QUEUE || 'webhook.events',
  },
  application: {
    applicationId: process.env.APPLICATION_ID || '',
    applicationName: process.env.APPLICATION_NAME || '',
  },
});
