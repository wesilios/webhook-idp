import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { CLOCK, DOMAIN_EVENT_PUBLISHER, SUBSCRIPTION_REPOSITORY } from '@domain/ports/index.js';
import { EventEmitterDomainEventPublisher } from './subscription/event-emitter-domain-event-publisher.js';
import { Subscription, SubscriptionSchema } from './subscription/schemas/subscription.schema.js';
import { SubscriptionMongoRepository } from './subscription/subscription-mongo.repository.js';
import { SystemClock } from './system-clock.js';
import { DatabaseConfig } from '../app.configuration.js';

@Module({
  imports: [
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const database = configService.get<DatabaseConfig>('database');
        return { uri: database?.uri };
      },
    }),
    MongooseModule.forFeature([{ name: Subscription.name, schema: SubscriptionSchema }]),
  ],
  providers: [
    { provide: SUBSCRIPTION_REPOSITORY, useClass: SubscriptionMongoRepository },
    { provide: CLOCK, useClass: SystemClock },
    { provide: DOMAIN_EVENT_PUBLISHER, useClass: EventEmitterDomainEventPublisher },
  ],
  exports: [SUBSCRIPTION_REPOSITORY, CLOCK, DOMAIN_EVENT_PUBLISHER],
})
export class InfrastructureModule {}
