import { WebhookSubscription } from '@domain/subscription/aggregates/subscription.aggregate.js';
import { ClientId, EventType, TargetUrl, TenantId } from '@domain/subscription/value-objects/index.js';
import { SubscriptionNotFoundError } from '../errors/subscription-not-found.error.js';
import { FakeClock, FakeDomainEventPublisher, InMemorySubscriptionRepository } from './support/fakes.js';
import { DeleteSubscriptionUseCase } from './delete-subscription.usecase.js';

async function setup() {
  const repository = new InMemorySubscriptionRepository();
  const clock = new FakeClock();
  const eventPublisher = new FakeDomainEventPublisher();
  const useCase = new DeleteSubscriptionUseCase(repository, clock, eventPublisher);

  const subscription = WebhookSubscription.create(
    {
      tenantId: TenantId.fromString('tenant-1'),
      createdByClientId: ClientId.fromString('client-1'),
      createdByUserId: null,
      targetUrl: TargetUrl.fromString('https://client.example.com/webhooks/inbound'),
      subscribedEventTypes: [EventType.fromString('order.created')],
    },
    clock
  );
  subscription.pullDomainEvents();
  await repository.save(subscription);

  return { repository, clock, eventPublisher, useCase, subscription };
}

describe('DeleteSubscriptionUseCase', () => {
  it('soft-deletes the subscription and publishes SubscriptionDeleted', async () => {
    const { useCase, subscription, eventPublisher } = await setup();

    const result = await useCase.execute({ id: subscription.id.toString(), tenantId: 'tenant-1' });

    expect(result.status).toBe('DELETED');
    expect(eventPublisher.published).toHaveLength(1);
    expect(eventPublisher.published[0]?.constructor.name).toBe('SubscriptionDeleted');
  });

  it('is idempotent: deleting an already-deleted subscription publishes no further events', async () => {
    const { useCase, subscription, eventPublisher } = await setup();

    await useCase.execute({ id: subscription.id.toString(), tenantId: 'tenant-1' });
    eventPublisher.published.length = 0;
    const result = await useCase.execute({ id: subscription.id.toString(), tenantId: 'tenant-1' });

    expect(result.status).toBe('DELETED');
    expect(eventPublisher.published).toHaveLength(0);
  });

  it('throws SubscriptionNotFoundError when the subscription does not exist', async () => {
    const { useCase } = await setup();

    await expect(
      useCase.execute({ id: '0193f2b4-8f2a-7c31-9a0e-2c8f0a4d9b10', tenantId: 'tenant-1' })
    ).rejects.toThrow(SubscriptionNotFoundError);
  });

  it('throws SubscriptionNotFoundError when the subscription belongs to a different tenant', async () => {
    const { useCase, subscription } = await setup();

    await expect(useCase.execute({ id: subscription.id.toString(), tenantId: 'tenant-2' })).rejects.toThrow(
      SubscriptionNotFoundError
    );
  });
});
