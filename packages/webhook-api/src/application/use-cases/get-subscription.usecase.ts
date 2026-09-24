import { Inject, Injectable } from '@nestjs/common';
import { SUBSCRIPTION_REPOSITORY, type SubscriptionRepository } from '@domain/ports/index.js';
import { WebhookSubscription } from '@domain/subscription/aggregates/subscription.aggregate.js';
import { SubscriptionId, TenantId } from '@domain/subscription/value-objects/index.js';
import { SubscriptionNotFoundError } from '../errors/subscription-not-found.error.js';

export interface GetSubscriptionInput {
  id: string;
  tenantId: string;
}

@Injectable()
export class GetSubscriptionUseCase {
  constructor(@Inject(SUBSCRIPTION_REPOSITORY) private readonly repository: SubscriptionRepository) {}

  async execute(input: GetSubscriptionInput): Promise<WebhookSubscription> {
    const subscription = await this.repository.findByIdAndTenant(
      SubscriptionId.fromString(input.id),
      TenantId.fromString(input.tenantId)
    );

    if (!subscription) {
      throw new SubscriptionNotFoundError(`Subscription "${input.id}" was not found`);
    }

    return subscription;
  }
}
