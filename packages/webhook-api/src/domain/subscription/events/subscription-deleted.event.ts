import { DomainEvent } from './domain.event.js';

export class SubscriptionDeleted extends DomainEvent {
  constructor(aggregateId: string, occurredAt: Date) {
    super(aggregateId, occurredAt);
  }
}
