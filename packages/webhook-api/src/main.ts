import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { createApp } from './app.setup.js';

function isDevelopmentEnv(): boolean {
  return !(process.env.NODE_ENV === 'production');
}

async function bootstrap() {
  const app = await createApp(AppModule);

  if (isDevelopmentEnv()) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Webhook Management API')
      .setDescription(
        'Subscription management for the Webhook Platform — see the package README for the full system context'
      )
      .setVersion(process.env.VERSION || '1.0')
      .build();
    const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, swaggerDocument);
  }
  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
