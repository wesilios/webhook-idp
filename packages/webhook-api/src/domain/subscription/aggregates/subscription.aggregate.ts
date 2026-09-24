import type { Clock } from '../../ports/clock.port.js';
import { InvalidEventTypeError, InvalidStatusTransitionError } from '../subscription.errors.js';
import {
  DomainEvent,
  SubscriptionCreated,
  SubscriptionDeleted,
  SubscriptionPaused,
  SubscriptionResumed,
} from '../events/index.js';
import {
  ClientId,
  EventType,
  SubscriptionId,
  type SubscriptionStatus,
  TargetUrl,
  TenantId,
  UserId,
} from '../value-objects/index.js';

export interface CreateWebhookSubscriptionParams {
  tenantId: TenantId;
  createdByClientId: ClientId;
  createdByUserId: UserId | null;
  targetUrl: TargetUrl;
  subscribedEventTypes: EventType[];
}

export interface RestoreWebhookSubscriptionProps {
  id: SubscriptionId;
  tenantId: TenantId;
  createdByClientId: ClientId;
  createdByUserId: UserId | null;
  targetUrl: TargetUrl;
  subscribedEventTypes: EventType[];
  status: SubscriptionStatus;
  createdAt: Date;
  updatedAt: Date;
}

export class WebhookSubscription {
  private domainEvents: DomainEvent[] = [];

  private constructor(
    readonly id: SubscriptionId,
    readonly tenantId: TenantId,
    readonly createdByClientId: ClientId,
    readonly createdByUserId: UserId | null,
    private targetUrlValue: TargetUrl,
    private eventTypes: EventType[],
    private statusValue: SubscriptionStatus,
    readonly createdAt: Date,
    private updatedAtValue: Date
  ) {}

  /** Creates a brand-new subscription and records a `SubscriptionCreated` domain event. */
  static create(params: CreateWebhookSubscriptionParams, clock: Clock): WebhookSubscription {
    assertNonEmptyEventTypes(params.subscribedEventTypes);
    const now = clock.now();
    const subscription = new WebhookSubscription(
      SubscriptionId.generate(),
      params.tenantId,
      params.createdByClientId,
      params.createdByUserId,
      params.targetUrl,
      [...params.subscribedEventTypes],
      'ACTIVE',
      now,
      now
    );
    subscription.record(new SubscriptionCreated(subscription.id.toString(), now));
    return subscription;
  }

  /** Rehydrates an existing subscription from persistence — emits no domain events. */
  static restore(props: RestoreWebhookSubscriptionProps): WebhookSubscription {
    return new WebhookSubscription(
      props.id,
      props.tenantId,
      props.createdByClientId,
      props.createdByUserId,
      props.targetUrl,
      [...props.subscribedEventTypes],
      props.status,
      props.createdAt,
      props.updatedAt
    );
  }

  get targetUrl(): TargetUrl {
    return this.targetUrlValue;
  }

  get subscribedEventTypes(): readonly EventType[] {
    return this.eventTypes;
  }

  get status(): SubscriptionStatus {
    return this.statusValue;
  }

  get updatedAt(): Date {
    return this.updatedAtValue;
  }

  pause(clock: Clock): void {
    if (this.statusValue !== 'ACTIVE') {
      throw new InvalidStatusTransitionError(`Cannot pause a subscription in status ${this.statusValue}`);
    }
    this.statusValue = 'PAUSED';
    this.updatedAtValue = clock.now();
    this.record(new SubscriptionPaused(this.id.toString(), this.updatedAtValue));
  }

  resume(clock: Clock): void {
    if (this.statusValue !== 'PAUSED') {
      throw new InvalidStatusTransitionError(`Cannot resume a subscription in status ${this.statusValue}`);
    }
    this.statusValue = 'ACTIVE';
    this.updatedAtValue = clock.now();
    this.record(new SubscriptionResumed(this.id.toString(), this.updatedAtValue));
  }

  /** Soft-delete. A no-op (idempotent, no new event) if already `DELETED`. */
  delete(clock: Clock): void {
    if (this.statusValue === 'DELETED') {
      return;
    }
    this.statusValue = 'DELETED';
    this.updatedAtValue = clock.now();
    this.record(new SubscriptionDeleted(this.id.toString(), this.updatedAtValue));
  }

  updateTargetUrl(targetUrl: TargetUrl, clock: Clock): void {
    this.assertMutable();
    this.targetUrlValue = targetUrl;
    this.updatedAtValue = clock.now();
  }

  updateSubscribedEventTypes(eventTypes: EventType[], clock: Clock): void {
    this.assertMutable();
    assertNonEmptyEventTypes(eventTypes);
    this.eventTypes = [...eventTypes];
    this.updatedAtValue = clock.now();
  }

  /** Drains and returns the domain events recorded since the last pull. */
  pullDomainEvents(): DomainEvent[] {
    const events = this.domainEvents;
    this.domainEvents = [];
    return events;
  }

  private assertMutable(): void {
    if (this.statusValue === 'DELETED') {
      throw new InvalidStatusTransitionError('Cannot update a deleted subscription');
    }
  }

  private record(event: DomainEvent): void {
    this.domainEvents.push(event);
  }
}

function assertNonEmptyEventTypes(eventTypes: EventType[]): void {
  if (eventTypes.length === 0) {
    throw new InvalidEventTypeError('subscribedEventTypes must not be empty');
  }
}
