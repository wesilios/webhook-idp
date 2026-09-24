import { Module } from '@nestjs/common';
import { InfrastructureModule } from '@infrastructure/infrastructure.module.js';
import { IngestEventUseCase } from './use-cases/index.js';

@Module({
  imports: [InfrastructureModule],
  providers: [IngestEventUseCase],
  exports: [IngestEventUseCase],
})
export class ApplicationModule {}
