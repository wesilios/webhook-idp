import type { DomainEvent } from '../subscription/events/domain.event.js';

export interface DomainEventPublisher {
  publishAll(events: DomainEvent[]): Promise<void> | void;
}

export const DOMAIN_EVENT_PUBLISHER = Symbol('DomainEventPublisher');
