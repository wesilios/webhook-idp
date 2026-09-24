import { DuplicateSubscriptionError } from '../errors/duplicate-subscription.error.js';
import { FakeClock, FakeDomainEventPublisher, InMemorySubscriptionRepository } from './support/fakes.js';
import { CreateSubscriptionUseCase } from './create-subscription.usecase.js';

function buildInput(overrides: Partial<Parameters<CreateSubscriptionUseCase['execute']>[0]> = {}) {
  return {
    tenantId: 'tenant-1',
    createdByClientId: 'client-1',
    createdByUserId: null,
    targetUrl: 'https://client.example.com/webhooks/inbound',
    eventTypes: ['order.created'],
    ...overrides,
  };
}

describe('CreateSubscriptionUseCase', () => {
  function setup() {
    const repository = new InMemorySubscriptionRepository();
    const clock = new FakeClock();
    const eventPublisher = new FakeDomainEventPublisher();
    const useCase = new CreateSubscriptionUseCase(repository, clock, eventPublisher);
    return { repository, clock, eventPublisher, useCase };
  }

  it('creates and persists an ACTIVE subscription', async () => {
    const { useCase, repository } = setup();

    const subscription = await useCase.execute(buildInput());

    expect(subscription.status).toBe('ACTIVE');
    expect(subscription.targetUrl.toString()).toBe('https://client.example.com/webhooks/inbound');
    expect(await repository.findByIdAndTenant(subscription.id, subscription.tenantId)).toBe(subscription);
  });

  it('publishes the domain events pulled from the aggregate after saving', async () => {
    const { useCase, eventPublisher } = setup();

    const subscription = await useCase.execute(buildInput());

    expect(eventPublisher.published).toHaveLength(1);
    expect(eventPublisher.published[0]?.aggregateId).toBe(subscription.id.toString());
    // The use-case must have already drained the aggregate's own queue.
    expect(subscription.pullDomainEvents()).toHaveLength(0);
  });

  it('rejects a duplicate (tenantId, targetUrl) pair', async () => {
    const { useCase } = setup();

    await useCase.execute(buildInput());

    await expect(useCase.execute(buildInput())).rejects.toThrow(DuplicateSubscriptionError);
  });

  it('allows the same targetUrl across different tenants', async () => {
    const { useCase } = setup();

    await useCase.execute(buildInput({ tenantId: 'tenant-1' }));

    await expect(useCase.execute(buildInput({ tenantId: 'tenant-2' }))).resolves.toBeDefined();
  });

  it('records createdByUserId when the call was made on behalf of a human user', async () => {
    const { useCase } = setup();

    const subscription = await useCase.execute(buildInput({ createdByUserId: 'user-1' }));

    expect(subscription.createdByUserId?.toString()).toBe('user-1');
  });
});
