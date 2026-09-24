export interface DatabaseConfig {
  uri: string;
}

export default () => ({
  port: parseInt(process.env.PORT || '3000', 10) || 3000,
  database: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/webhook',
  },
});
