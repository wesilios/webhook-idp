import { IsIn, IsOptional, IsString } from 'class-validator';
import type { SubscriptionStatus } from '@domain/subscription/value-objects/index.js';

/**
 * Filters only — `page`/`pageSize` are resolved by `PaginationInterceptor` (`@Pagination()`),
 * not validated here.
 */
export class ListSubscriptionsQueryDto {
  @IsOptional()
  @IsIn(['ACTIVE', 'PAUSED', 'DELETED'])
  status?: SubscriptionStatus;

  @IsOptional()
  @IsString()
  eventType?: string;
}
