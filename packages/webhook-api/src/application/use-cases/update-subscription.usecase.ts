import { Inject, Injectable } from '@nestjs/common';
import {
  CLOCK,
  DOMAIN_EVENT_PUBLISHER,
  SUBSCRIPTION_REPOSITORY,
  type Clock,
  type DomainEventPublisher,
  type SubscriptionRepository,
} from '@domain/ports/index.js';
import { WebhookSubscription } from '@domain/subscription/aggregates/subscription.aggregate.js';
import { InvalidStatusTransitionError } from '@domain/subscription/subscription.errors.js';
import {
  EventType,
  SubscriptionId,
  type SubscriptionStatus,
  TargetUrl,
  TenantId,
} from '@domain/subscription/value-objects/index.js';
import { SubscriptionNotFoundError } from '../errors/subscription-not-found.error.js';

export interface UpdateSubscriptionInput {
  id: string;
  tenantId: string;
  targetUrl?: string;
  eventTypes?: string[];
  /** Only `ACTIVE`/`PAUSED` are legal here — routed through `resume()`/`pause()`. Use DeleteSubscription for `DELETED`. */
  status?: SubscriptionStatus;
}

@Injectable()
export class UpdateSubscriptionUseCase {
  constructor(
    @Inject(SUBSCRIPTION_REPOSITORY) private readonly repository: SubscriptionRepository,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly eventPublisher: DomainEventPublisher
  ) {}

  async execute(input: UpdateSubscriptionInput): Promise<WebhookSubscription> {
    const subscription = await this.repository.findByIdAndTenant(
      SubscriptionId.fromString(input.id),
      TenantId.fromString(input.tenantId)
    );

    if (!subscription) {
      throw new SubscriptionNotFoundError(`Subscription "${input.id}" was not found`);
    }

    if (input.targetUrl !== undefined) {
      subscription.updateTargetUrl(TargetUrl.fromString(input.targetUrl), this.clock);
    }

    if (input.eventTypes !== undefined) {
      subscription.updateSubscribedEventTypes(
        input.eventTypes.map((eventType) => EventType.fromString(eventType)),
        this.clock
      );
    }

    if (input.status !== undefined) {
      this.applyStatus(subscription, input.status);
    }

    await this.repository.save(subscription);
    await this.eventPublisher.publishAll(subscription.pullDomainEvents());

    return subscription;
  }

  private applyStatus(subscription: WebhookSubscription, status: SubscriptionStatus): void {
    switch (status) {
      case 'ACTIVE':
        subscription.resume(this.clock);
        return;
      case 'PAUSED':
        subscription.pause(this.clock);
        return;
      default:
        throw new InvalidStatusTransitionError(
          `Cannot transition to status ${status} via update; use DeleteSubscription instead`
        );
    }
  }
}
