import { WebhookSubscription } from '@domain/subscription/aggregates/subscription.aggregate.js';
import { ClientId, EventType, TargetUrl, TenantId } from '@domain/subscription/value-objects/index.js';
import { FakeClock, InMemorySubscriptionRepository } from './support/fakes.js';
import { ListSubscriptionsUseCase } from './list-subscriptions.usecase.js';

function createSubscription(clock: FakeClock, tenantId: string, targetUrl: string) {
  return WebhookSubscription.create(
    {
      tenantId: TenantId.fromString(tenantId),
      createdByClientId: ClientId.fromString('client-1'),
      createdByUserId: null,
      targetUrl: TargetUrl.fromString(targetUrl),
      subscribedEventTypes: [EventType.fromString('order.created')],
    },
    clock
  );
}

describe('ListSubscriptionsUseCase', () => {
  function setup() {
    const repository = new InMemorySubscriptionRepository();
    const clock = new FakeClock();
    const useCase = new ListSubscriptionsUseCase(repository);
    return { repository, clock, useCase };
  }

  it('scopes results to the caller tenant and paginates via the repository', async () => {
    const { repository, clock, useCase } = setup();
    await repository.save(createSubscription(clock, 'tenant-1', 'https://a.example.com/hook'));
    await repository.save(createSubscription(clock, 'tenant-1', 'https://b.example.com/hook'));
    await repository.save(createSubscription(clock, 'tenant-2', 'https://c.example.com/hook'));

    const result = await useCase.execute({
      tenantId: 'tenant-1',
      filters: {},
      pagination: { page: 1, pageSize: 20 },
    });

    expect(result.total).toBe(2);
    expect(result.items).toHaveLength(2);
    expect(result.items.every((item) => item.tenantId.toString() === 'tenant-1')).toBe(true);
  });

  it('filters by status when provided', async () => {
    const { repository, clock, useCase } = setup();
    const active = createSubscription(clock, 'tenant-1', 'https://a.example.com/hook');
    const paused = createSubscription(clock, 'tenant-1', 'https://b.example.com/hook');
    paused.pause(clock);
    await repository.save(active);
    await repository.save(paused);

    const result = await useCase.execute({
      tenantId: 'tenant-1',
      filters: { status: 'PAUSED' },
      pagination: { page: 1, pageSize: 20 },
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.status).toBe('PAUSED');
  });

  it('filters by eventType when provided', async () => {
    const { repository, clock, useCase } = setup();
    const matching = createSubscription(clock, 'tenant-1', 'https://a.example.com/hook');
    const other = WebhookSubscription.create(
      {
        tenantId: TenantId.fromString('tenant-1'),
        createdByClientId: ClientId.fromString('client-1'),
        createdByUserId: null,
        targetUrl: TargetUrl.fromString('https://b.example.com/hook'),
        subscribedEventTypes: [EventType.fromString('order.shipped')],
      },
      clock
    );
    await repository.save(matching);
    await repository.save(other);

    const result = await useCase.execute({
      tenantId: 'tenant-1',
      filters: { eventType: EventType.fromString('order.created') },
      pagination: { page: 1, pageSize: 20 },
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.targetUrl.toString()).toBe('https://a.example.com/hook');
  });

  it('applies page/pageSize to slice the results', async () => {
    const { repository, clock, useCase } = setup();
    for (let i = 0; i < 3; i++) {
      await repository.save(createSubscription(clock, 'tenant-1', `https://host-${i}.example.com/hook`));
    }

    const result = await useCase.execute({
      tenantId: 'tenant-1',
      filters: {},
      pagination: { page: 2, pageSize: 2 },
    });

    expect(result.total).toBe(3);
    expect(result.items).toHaveLength(1);
    expect(result.page).toBe(2);
    expect(result.pageSize).toBe(2);
  });
});
