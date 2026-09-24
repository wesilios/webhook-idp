import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { IngestionRuntimeService } from '@runtime/ingestion-runtime.service.js';

const logger = new Logger('bootstrap');

async function bootstrap() {
  // No HTTP listener — this worker only consumes from the Message Broker. See the package
  // README's "Framework choice": a plain NestJS DI container (no `@nestjs/microservices`), so
  // the broker adapter stays a swappable `BrokerConsumer` port implementation rather than
  // coupling bootstrap to a broker-specific transporter.
  const app = await NestFactory.createApplicationContext(AppModule);
  app.enableShutdownHooks();

  const runtime = app.get(IngestionRuntimeService);
  await runtime.start();

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    logger.log(`Received ${signal}, draining in-flight work before exit...`);
    await runtime.stop();
    await app.close();
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}
await bootstrap();
