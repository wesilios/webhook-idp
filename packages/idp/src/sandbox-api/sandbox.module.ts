import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig, BrokerConfig } from '../app.configuration.js';
import { RabbitMqBrokerPublisherAdapter } from './adapters/rabbitmq-broker-publisher.adapter.js';
import { CorrelationIdInterceptor } from './interceptors/correlation-id.interceptor.js';
import { BROKER_PUBLISHER } from './ports/broker-publisher.port.js';
import { SandboxController } from './sandbox.controller.js';
import { SandboxService } from './sandbox.service.js';

@Module({
  controllers: [SandboxController],
  providers: [
    SandboxService,
    CorrelationIdInterceptor,
    {
      provide: BROKER_PUBLISHER,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const broker = configService.getOrThrow<BrokerConfig>('broker');
        const application = configService.getOrThrow<AppConfig>('application');
        return new RabbitMqBrokerPublisherAdapter(broker.url, broker.queue, application.applicationName);
      },
    },
  ],
})
export class SandboxModule {}
