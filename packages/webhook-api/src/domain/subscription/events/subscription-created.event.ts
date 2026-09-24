import { DomainEvent } from './domain.event.js';

export class SubscriptionCreated extends DomainEvent {
  constructor(aggregateId: string, occurredAt: Date) {
    super(aggregateId, occurredAt);
  }
}
