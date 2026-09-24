import type {
  Clock,
  DomainEventPublisher,
  PaginatedResult,
  Pagination,
  SubscriptionListFilters,
  SubscriptionRepository,
} from '@domain/ports/index.js';
import type { WebhookSubscription } from '@domain/subscription/aggregates/subscription.aggregate.js';
import type { DomainEvent } from '@domain/subscription/events/index.js';
import type { SubscriptionId, TargetUrl, TenantId } from '@domain/subscription/value-objects/index.js';

/** Deterministic, adjustable `Clock` fake for use-case tests. */
export class FakeClock implements Clock {
  constructor(private current: Date = new Date('2026-01-01T00:00:00.000Z')) {}

  now(): Date {
    return this.current;
  }

  advance(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }
}

/** Records every batch of events handed to it — lets tests assert what a use-case published. */
export class FakeDomainEventPublisher implements DomainEventPublisher {
  readonly published: DomainEvent[] = [];

  publishAll(events: DomainEvent[]): void {
    this.published.push(...events);
  }
}

/** In-memory `SubscriptionRepository` fake, keyed by subscription id. */
export class InMemorySubscriptionRepository implements SubscriptionRepository {
  private readonly store = new Map<string, WebhookSubscription>();

  async save(subscription: WebhookSubscription): Promise<void> {
    this.store.set(subscription.id.toString(), subscription);
  }

  async findByIdAndTenant(id: SubscriptionId, tenantId: TenantId): Promise<WebhookSubscription | null> {
    const found = this.store.get(id.toString());
    if (!found || !found.tenantId.equals(tenantId)) {
      return null;
    }
    return found;
  }

  async findByTenantAndTargetUrl(tenantId: TenantId, targetUrl: TargetUrl): Promise<WebhookSubscription | null> {
    for (const subscription of this.store.values()) {
      if (subscription.tenantId.equals(tenantId) && subscription.targetUrl.equals(targetUrl)) {
        return subscription;
      }
    }
    return null;
  }

  async list(
    tenantId: TenantId,
    filters: SubscriptionListFilters,
    pagination: Pagination
  ): Promise<PaginatedResult<WebhookSubscription>> {
    const all = [...this.store.values()].filter((subscription) => {
      if (!subscription.tenantId.equals(tenantId)) return false;
      if (filters.status && subscription.status !== filters.status) return false;
      if (filters.eventType && !subscription.subscribedEventTypes.some((et) => et.equals(filters.eventType!))) {
        return false;
      }
      return true;
    });

    const start = (pagination.page - 1) * pagination.pageSize;
    const items = all.slice(start, start + pagination.pageSize);

    return {
      items,
      page: pagination.page,
      pageSize: pagination.pageSize,
      total: all.length,
    };
  }
}
