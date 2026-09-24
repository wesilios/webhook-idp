import { WebhookSubscription } from '@domain/subscription/aggregates/subscription.aggregate.js';
import { ClientId, EventType, TargetUrl, TenantId } from '@domain/subscription/value-objects/index.js';
import { SubscriptionNotFoundError } from '../errors/subscription-not-found.error.js';
import { FakeClock, InMemorySubscriptionRepository } from './support/fakes.js';
import { GetSubscriptionUseCase } from './get-subscription.usecase.js';

describe('GetSubscriptionUseCase', () => {
  function setup() {
    const repository = new InMemorySubscriptionRepository();
    const clock = new FakeClock();
    const useCase = new GetSubscriptionUseCase(repository);
    return { repository, clock, useCase };
  }

  it('returns the subscription when found within the caller tenant', async () => {
    const { repository, clock, useCase } = setup();
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
    await repository.save(subscription);

    const result = await useCase.execute({ id: subscription.id.toString(), tenantId: 'tenant-1' });

    expect(result).toBe(subscription);
  });

  it('throws SubscriptionNotFoundError when the id does not exist', async () => {
    const { useCase } = setup();

    await expect(
      useCase.execute({ id: '0193f2b4-8f2a-7c31-9a0e-2c8f0a4d9b10', tenantId: 'tenant-1' })
    ).rejects.toThrow(SubscriptionNotFoundError);
  });

  it('throws SubscriptionNotFoundError when the subscription belongs to a different tenant', async () => {
    const { repository, clock, useCase } = setup();
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
    await repository.save(subscription);

    await expect(useCase.execute({ id: subscription.id.toString(), tenantId: 'tenant-2' })).rejects.toThrow(
      SubscriptionNotFoundError
    );
  });
});
