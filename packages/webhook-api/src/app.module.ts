import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import appConfiguration from './app.configuration.js';
import { ApplicationModule } from '@application/application.module.js';
import { InfrastructureModule } from '@infrastructure/infrastructure.module.js';
import { PresentationModule } from '@presentation/presentation.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [appConfiguration],
      isGlobal: true,
    }),
    EventEmitterModule.forRoot(),
    InfrastructureModule,
    ApplicationModule,
    PresentationModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
