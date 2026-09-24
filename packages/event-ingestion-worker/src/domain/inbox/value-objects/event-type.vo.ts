import { InvalidEventTypeError } from '../inbox.errors.js';

// Catalog validation against a known set of event types is intentionally deferred — no
// catalog exists in this project yet. This only enforces the shape of the string. Mirrors
// webhook-api's EventType value object (see .agent/rules/architecture.md's shared-kernel note).
export class EventType {
  private constructor(private readonly value: string) {}

  static fromString(value: string): EventType {
    if (!value || value.trim().length === 0) {
      throw new InvalidEventTypeError('EventType must not be empty');
    }
    return new EventType(value);
  }

  toString(): string {
    return this.value;
  }

  equals(other: EventType): boolean {
    return this.value === other.value;
  }
}
