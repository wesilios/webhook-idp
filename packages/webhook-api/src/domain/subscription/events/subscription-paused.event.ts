import { DomainEvent } from './domain.event.js';

export class SubscriptionPaused extends DomainEvent {
  constructor(aggregateId: string, occurredAt: Date) {
    super(aggregateId, occurredAt);
  }
}
