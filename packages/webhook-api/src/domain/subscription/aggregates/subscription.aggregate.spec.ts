import type { Clock } from '../../ports/clock.port.js';
import { InvalidEventTypeError, InvalidStatusTransitionError } from '../subscription.errors.js';
import { SubscriptionCreated, SubscriptionDeleted, SubscriptionPaused, SubscriptionResumed } from '../events/index.js';
import { ClientId, EventType, TargetUrl, TenantId } from '../value-objects/index.js';
import { WebhookSubscription } from './subscription.aggregate.js';

class FakeClock implements Clock {
  constructor(private current: Date) {}

  now(): Date {
    return this.current;
  }

  advance(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }
}

function createSubscription(clock: Clock) {
  return WebhookSubscription.create(
    {
      tenantId: TenantId.fromString('tenant-1'),
      createdByClientId: ClientId.fromString('client-1'),
      createdByUserId: null,
      targetUrl: TargetUrl.fromString('https://client.example.com/webhooks/inbound'),
      subscribedEventTypes: [EventType.fromString('order.created')],
    },
    clock
  );
}

describe('WebhookSubscription', () => {
  it('creates an ACTIVE subscription and records SubscriptionCreated', () => {
    const clock = new FakeClock(new Date('2026-01-01T00:00:00.000Z'));
    const subscription = createSubscription(clock);

    expect(subscription.status).toBe('ACTIVE');
    expect(subscription.createdAt).toEqual(new Date('2026-01-01T00:00:00.000Z'));
    expect(subscription.updatedAt).toEqual(subscription.createdAt);

    const events = subscription.pullDomainEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(SubscriptionCreated);
    expect(subscription.pullDomainEvents()).toHaveLength(0);
  });

  it('rejects creation with no event types', () => {
    const clock = new FakeClock(new Date());
    expect(() =>
      WebhookSubscription.create(
        {
          tenantId: TenantId.fromString('tenant-1'),
          createdByClientId: ClientId.fromString('client-1'),
          createdByUserId: null,
          targetUrl: TargetUrl.fromString('https://client.example.com/hook'),
          subscribedEventTypes: [],
        },
        clock
      )
    ).toThrow(InvalidEventTypeError);
  });

  it('pauses an ACTIVE subscription and records SubscriptionPaused', () => {
    const clock = new FakeClock(new Date('2026-01-01T00:00:00.000Z'));
    const subscription = createSubscription(clock);
    subscription.pullDomainEvents();

    clock.advance(1000);
    subscription.pause(clock);

    expect(subscription.status).toBe('PAUSED');
    expect(subscription.updatedAt).toEqual(new Date('2026-01-01T00:00:01.000Z'));
    expect(subscription.pullDomainEvents()[0]).toBeInstanceOf(SubscriptionPaused);
  });

  it('rejects pausing a non-ACTIVE subscription', () => {
    const clock = new FakeClock(new Date());
    const subscription = createSubscription(clock);
    subscription.pause(clock);
    expect(() => subscription.pause(clock)).toThrow(InvalidStatusTransitionError);
  });

  it('resumes a PAUSED subscription and records SubscriptionResumed', () => {
    const clock = new FakeClock(new Date());
    const subscription = createSubscription(clock);
    subscription.pause(clock);
    subscription.pullDomainEvents();

    subscription.resume(clock);

    expect(subscription.status).toBe('ACTIVE');
    expect(subscription.pullDomainEvents()[0]).toBeInstanceOf(SubscriptionResumed);
  });

  it('rejects resuming a non-PAUSED subscription', () => {
    const clock = new FakeClock(new Date());
    const subscription = createSubscription(clock);
    expect(() => subscription.resume(clock)).toThrow(InvalidStatusTransitionError);
  });

  it('deletes a subscription and records SubscriptionDeleted', () => {
    const clock = new FakeClock(new Date());
    const subscription = createSubscription(clock);
    subscription.pullDomainEvents();

    subscription.delete(clock);

    expect(subscription.status).toBe('DELETED');
    expect(subscription.pullDomainEvents()[0]).toBeInstanceOf(SubscriptionDeleted);
  });

  it('is idempotent when deleting an already-DELETED subscription', () => {
    const clock = new FakeClock(new Date());
    const subscription = createSubscription(clock);
    subscription.delete(clock);
    subscription.pullDomainEvents();

    expect(() => subscription.delete(clock)).not.toThrow();
    expect(subscription.status).toBe('DELETED');
    expect(subscription.pullDomainEvents()).toHaveLength(0);
  });

  it('rejects updating targetUrl/eventTypes on a DELETED subscription', () => {
    const clock = new FakeClock(new Date());
    const subscription = createSubscription(clock);
    subscription.delete(clock);

    expect(() => subscription.updateTargetUrl(TargetUrl.fromString('https://example.com/new'), clock)).toThrow(
      InvalidStatusTransitionError
    );
    expect(() => subscription.updateSubscribedEventTypes([EventType.fromString('order.shipped')], clock)).toThrow(
      InvalidStatusTransitionError
    );
  });

  it('allows updating targetUrl and eventTypes while ACTIVE or PAUSED', () => {
    const clock = new FakeClock(new Date());
    const subscription = createSubscription(clock);

    subscription.updateTargetUrl(TargetUrl.fromString('https://example.com/new'), clock);
    expect(subscription.targetUrl.toString()).toBe('https://example.com/new');

    subscription.updateSubscribedEventTypes([EventType.fromString('order.shipped')], clock);
    expect(subscription.subscribedEventTypes.map((e) => e.toString())).toEqual(['order.shipped']);
  });

  it('restores a subscription from persisted state without emitting events', () => {
    const clock = new FakeClock(new Date('2026-01-01T00:00:00.000Z'));
    const original = createSubscription(clock);
    original.pullDomainEvents();

    const restored = WebhookSubscription.restore({
      id: original.id,
      tenantId: original.tenantId,
      createdByClientId: original.createdByClientId,
      createdByUserId: original.createdByUserId,
      targetUrl: original.targetUrl,
      subscribedEventTypes: [...original.subscribedEventTypes],
      status: original.status,
      createdAt: original.createdAt,
      updatedAt: original.updatedAt,
    });

    expect(restored.id.equals(original.id)).toBe(true);
    expect(restored.status).toBe(original.status);
    expect(restored.pullDomainEvents()).toHaveLength(0);
  });
});
