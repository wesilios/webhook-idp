import { Module } from '@nestjs/common';
import { ApplicationModule } from '@application/application.module.js';
import { InfrastructureModule } from '@infrastructure/infrastructure.module.js';
import { IngestionRuntimeService } from './ingestion-runtime.service.js';

@Module({
  imports: [ApplicationModule, InfrastructureModule],
  providers: [IngestionRuntimeService],
  exports: [IngestionRuntimeService],
})
export class RuntimeModule {}
