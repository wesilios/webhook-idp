import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { BROKER_CONSUMER, CLOCK, INBOX_REPOSITORY } from '@domain/ports/index.js';
import type { BrokerConfig, DatabaseConfig } from '../app.configuration.js';
import { RabbitMqBrokerConsumerAdapter } from './broker/rabbitmq-broker-consumer.adapter.js';
import { InboxMongoRepository } from './inbox/inbox-mongo.repository.js';
import { Inbox, InboxSchema } from './inbox/schemas/inbox-record.schema.js';
import { SystemClock } from './system-clock.js';

@Module({
  imports: [
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const database = configService.get<DatabaseConfig>('database');
        return { uri: database?.uri };
      },
    }),
    MongooseModule.forFeature([{ name: Inbox.name, schema: InboxSchema }]),
  ],
  providers: [
    { provide: INBOX_REPOSITORY, useClass: InboxMongoRepository },
    { provide: CLOCK, useClass: SystemClock },
    {
      provide: BROKER_CONSUMER,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const broker = configService.getOrThrow<BrokerConfig>('broker');
        return new RabbitMqBrokerConsumerAdapter(broker.url, broker.queue);
      },
    },
  ],
  exports: [INBOX_REPOSITORY, CLOCK, BROKER_CONSUMER],
})
export class InfrastructureModule {}
