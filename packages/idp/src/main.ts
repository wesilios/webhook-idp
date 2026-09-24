import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';

function isDevelopmentEnv(): boolean {
  return !(process.env.NODE_ENV === 'production');
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  if (isDevelopmentEnv()) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('IDP Sandbox API')
      .setDescription(
        'Sandbox API for simulating an Internal Service publisher — lets a developer manually trigger an event ' +
          'through the same envelope contract event-ingestion-worker expects, without needing a real internal ' +
          'service or a real Message Broker. See the package README for current scope and the platform root ' +
          'README for full system context.'
      )
      .setVersion(process.env.VERSION || '1.0')
      .build();
    const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, swaggerDocument);
  }

  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
