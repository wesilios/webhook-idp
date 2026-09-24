import { Inject, Injectable } from '@nestjs/common';
import {
  SUBSCRIPTION_REPOSITORY,
  type PaginatedResult,
  type Pagination,
  type SubscriptionListFilters,
  type SubscriptionRepository,
} from '@domain/ports/index.js';
import { WebhookSubscription } from '@domain/subscription/aggregates/subscription.aggregate.js';
import { TenantId } from '@domain/subscription/value-objects/index.js';

export interface ListSubscriptionsInput {
  tenantId: string;
  filters: SubscriptionListFilters;
  pagination: Pagination;
}

@Injectable()
export class ListSubscriptionsUseCase {
  constructor(@Inject(SUBSCRIPTION_REPOSITORY) private readonly repository: SubscriptionRepository) {}

  async execute(input: ListSubscriptionsInput): Promise<PaginatedResult<WebhookSubscription>> {
    return this.repository.list(TenantId.fromString(input.tenantId), input.filters, input.pagination);
  }
}
