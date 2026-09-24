import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { ApplicationModule } from '@application/application.module.js';
import { IdentityGuard } from './common/guards/identity.guard.js';
import { DomainExceptionFilter } from './common/filters/domain-exception.filter.js';
import {
  EnvelopeInterceptor,
  PaginationInterceptor,
  TargetUrlMaskingInterceptor,
} from './common/interceptors/index.js';
import { SubscriptionsController } from './subscriptions/subscriptions.controller.js';

@Module({
  imports: [ApplicationModule],
  controllers: [SubscriptionsController],
  providers: [
    IdentityGuard,
    PaginationInterceptor,
    TargetUrlMaskingInterceptor,
    { provide: APP_FILTER, useClass: DomainExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: EnvelopeInterceptor },
  ],
})
export class PresentationModule {}
