import type { WebhookSubscription } from '../subscription/aggregates/subscription.aggregate.js';
import type { EventType, SubscriptionId, SubscriptionStatus, TargetUrl, TenantId } from '../subscription/value-objects/index.js';

export interface SubscriptionListFilters {
  status?: SubscriptionStatus;
  eventType?: EventType;
}

export interface Pagination {
  page: number;
  pageSize: number;
}

export interface PaginatedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export interface SubscriptionRepository {
  save(subscription: WebhookSubscription): Promise<void>;
  findByIdAndTenant(id: SubscriptionId, tenantId: TenantId): Promise<WebhookSubscription | null>;
  findByTenantAndTargetUrl(tenantId: TenantId, targetUrl: TargetUrl): Promise<WebhookSubscription | null>;
  list(
    tenantId: TenantId,
    filters: SubscriptionListFilters,
    pagination: Pagination
  ): Promise<PaginatedResult<WebhookSubscription>>;
}

export const SUBSCRIPTION_REPOSITORY = Symbol('SubscriptionRepository');
