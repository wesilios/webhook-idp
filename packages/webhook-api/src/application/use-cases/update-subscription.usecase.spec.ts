import { InvalidStatusTransitionError } from '@domain/subscription/subscription.errors.js';
import { WebhookSubscription } from '@domain/subscription/aggregates/subscription.aggregate.js';
import { ClientId, EventType, TargetUrl, TenantId } from '@domain/subscription/value-objects/index.js';
import { SubscriptionNotFoundError } from '../errors/subscription-not-found.error.js';
import { FakeClock, FakeDomainEventPublisher, InMemorySubscriptionRepository } from './support/fakes.js';
import { UpdateSubscriptionUseCase } from './update-subscription.usecase.js';

async function setup() {
  const repository = new InMemorySubscriptionRepository();
  const clock = new FakeClock();
  const eventPublisher = new FakeDomainEventPublisher();
  const useCase = new UpdateSubscriptionUseCase(repository, clock, eventPublisher);

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

describe('UpdateSubscriptionUseCase', () => {
  it('updates targetUrl and eventTypes, then publishes the resulting domain events', async () => {
    const { useCase, subscription, eventPublisher } = await setup();

    const result = await useCase.execute({
      id: subscription.id.toString(),
      tenantId: 'tenant-1',
      targetUrl: 'https://new.example.com/hook',
      eventTypes: ['order.shipped'],
    });

    expect(result.targetUrl.toString()).toBe('https://new.example.com/hook');
    expect(result.subscribedEventTypes.map((e) => e.toString())).toEqual(['order.shipped']);
    // updateTargetUrl/updateSubscribedEventTypes don't themselves record domain events, so no
    // publish should happen for a plain field update.
    expect(eventPublisher.published).toHaveLength(0);
  });

  it('routes a PAUSED status change through pause() and publishes SubscriptionPaused', async () => {
    const { useCase, subscription, eventPublisher } = await setup();

    const result = await useCase.execute({
      id: subscription.id.toString(),
      tenantId: 'tenant-1',
      status: 'PAUSED',
    });

    expect(result.status).toBe('PAUSED');
    expect(eventPublisher.published).toHaveLength(1);
    expect(eventPublisher.published[0]?.constructor.name).toBe('SubscriptionPaused');
  });

  it('routes an ACTIVE status change through resume()', async () => {
    const { useCase, subscription, clock, eventPublisher, repository } = await setup();
    subscription.pause(clock);
    subscription.pullDomainEvents();
    await repository.save(subscription);

    const result = await useCase.execute({
      id: subscription.id.toString(),
      tenantId: 'tenant-1',
      status: 'ACTIVE',
    });

    expect(result.status).toBe('ACTIVE');
    expect(eventPublisher.published.some((e) => e.constructor.name === 'SubscriptionResumed')).toBe(true);
  });

  it('throws InvalidStatusTransitionError when asked to set status to DELETED', async () => {
    const { useCase, subscription } = await setup();

    await expect(
      useCase.execute({ id: subscription.id.toString(), tenantId: 'tenant-1', status: 'DELETED' })
    ).rejects.toThrow(InvalidStatusTransitionError);
  });

  it('surfaces InvalidStatusTransitionError from the aggregate for an illegal transition', async () => {
    const { useCase, subscription, clock } = await setup();
    subscription.delete(clock);

    await expect(
      useCase.execute({ id: subscription.id.toString(), tenantId: 'tenant-1', targetUrl: 'https://x.example.com/h' })
    ).rejects.toThrow(InvalidStatusTransitionError);
  });

  it('throws SubscriptionNotFoundError when the subscription does not exist', async () => {
    const { useCase } = await setup();

    await expect(
      useCase.execute({ id: '0193f2b4-8f2a-7c31-9a0e-2c8f0a4d9b10', tenantId: 'tenant-1', status: 'PAUSED' })
    ).rejects.toThrow(SubscriptionNotFoundError);
  });
});
