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
import { ClientId, EventType, TargetUrl, TenantId, UserId } from '@domain/subscription/value-objects/index.js';
import { DuplicateSubscriptionError } from '../errors/duplicate-subscription.error.js';

export interface CreateSubscriptionInput {
  tenantId: string;
  createdByClientId: string;
  createdByUserId: string | null;
  targetUrl: string;
  eventTypes: string[];
}

@Injectable()
export class CreateSubscriptionUseCase {
  constructor(
    @Inject(SUBSCRIPTION_REPOSITORY) private readonly repository: SubscriptionRepository,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly eventPublisher: DomainEventPublisher
  ) {}

  async execute(input: CreateSubscriptionInput): Promise<WebhookSubscription> {
    const tenantId = TenantId.fromString(input.tenantId);
    const targetUrl = TargetUrl.fromString(input.targetUrl);

    const existing = await this.repository.findByTenantAndTargetUrl(tenantId, targetUrl);
    if (existing) {
      throw new DuplicateSubscriptionError(
        `A subscription for tenant "${input.tenantId}" and targetUrl "${input.targetUrl}" already exists`
      );
    }

    const subscription = WebhookSubscription.create(
      {
        tenantId,
        createdByClientId: ClientId.fromString(input.createdByClientId),
        createdByUserId: input.createdByUserId === null ? null : UserId.fromString(input.createdByUserId),
        targetUrl,
        subscribedEventTypes: input.eventTypes.map((eventType) => EventType.fromString(eventType)),
      },
      this.clock
    );

    await this.repository.save(subscription);
    await this.eventPublisher.publishAll(subscription.pullDomainEvents());

    return subscription;
  }
}
