export interface DatabaseConfig {
  uri: string;
}

export default () => ({
  // Deployed build version, surfaced by `GET /versionz` — set per environment by the platform (see .env.example).
  version: process.env.VERSION || 'unknown',
  port: parseInt(process.env.PORT || '3000', 10) || 3000,
  database: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/webhook',
  },
});
