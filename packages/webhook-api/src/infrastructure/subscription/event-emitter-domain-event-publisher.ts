import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { DomainEventPublisher } from '@domain/ports/index.js';
import type { DomainEvent } from '@domain/subscription/events/index.js';

@Injectable()
export class EventEmitterDomainEventPublisher implements DomainEventPublisher {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  publishAll(events: DomainEvent[]): void {
    for (const event of events) {
      this.eventEmitter.emit(toEventName(event.constructor.name), event);
    }
  }
}

/** Derives a dot-separated event name from a domain event's class name, e.g. `SubscriptionCreated` -> `subscription.created`. */
function toEventName(className: string): string {
  return className.replace(/([a-z0-9])([A-Z])/g, '$1.$2').toLowerCase();
}
