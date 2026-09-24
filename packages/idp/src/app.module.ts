import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import appConfiguration from './app.configuration.js';
import { SandboxModule } from './sandbox-api/sandbox.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [appConfiguration],
      isGlobal: true,
    }),
    SandboxModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
