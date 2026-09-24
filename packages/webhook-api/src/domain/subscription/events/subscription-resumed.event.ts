import { DomainEvent } from './domain.event.js';

export class SubscriptionResumed extends DomainEvent {
  constructor(aggregateId: string, occurredAt: Date) {
    super(aggregateId, occurredAt);
  }
}
