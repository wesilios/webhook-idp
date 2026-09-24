import { Module } from '@nestjs/common';
import { InfrastructureModule } from '@infrastructure/infrastructure.module.js';
import {
  CreateSubscriptionUseCase,
  DeleteSubscriptionUseCase,
  GetSubscriptionUseCase,
  ListSubscriptionsUseCase,
  UpdateSubscriptionUseCase,
} from './use-cases/index.js';

@Module({
  imports: [InfrastructureModule],
  providers: [
    CreateSubscriptionUseCase,
    GetSubscriptionUseCase,
    ListSubscriptionsUseCase,
    UpdateSubscriptionUseCase,
    DeleteSubscriptionUseCase,
  ],
  exports: [
    CreateSubscriptionUseCase,
    GetSubscriptionUseCase,
    ListSubscriptionsUseCase,
    UpdateSubscriptionUseCase,
    DeleteSubscriptionUseCase,
  ],
})
export class ApplicationModule {}
