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
import { SubscriptionId, TenantId } from '@domain/subscription/value-objects/index.js';
import { SubscriptionNotFoundError } from '../errors/subscription-not-found.error.js';

export interface DeleteSubscriptionInput {
  id: string;
  tenantId: string;
}

@Injectable()
export class DeleteSubscriptionUseCase {
  constructor(
    @Inject(SUBSCRIPTION_REPOSITORY) private readonly repository: SubscriptionRepository,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly eventPublisher: DomainEventPublisher
  ) {}

  async execute(input: DeleteSubscriptionInput): Promise<WebhookSubscription> {
    const subscription = await this.repository.findByIdAndTenant(
      SubscriptionId.fromString(input.id),
      TenantId.fromString(input.tenantId)
    );

    if (!subscription) {
      throw new SubscriptionNotFoundError(`Subscription "${input.id}" was not found`);
    }

    subscription.delete(this.clock);

    await this.repository.save(subscription);
    await this.eventPublisher.publishAll(subscription.pullDomainEvents());

    return subscription;
  }
}
