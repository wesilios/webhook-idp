import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import appConfiguration from './app.configuration.js';
import { ApplicationModule } from '@application/application.module.js';
import { InfrastructureModule } from '@infrastructure/infrastructure.module.js';
import { RuntimeModule } from '@runtime/runtime.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [appConfiguration],
      isGlobal: true,
    }),
    EventEmitterModule.forRoot(),
    InfrastructureModule,
    ApplicationModule,
    RuntimeModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
