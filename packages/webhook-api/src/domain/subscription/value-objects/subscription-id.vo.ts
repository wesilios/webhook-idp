import { validate as isValidUuid, v7 as uuidv7 } from 'uuid';
import { InvalidIdentifierError } from '../subscription.errors.js';

export class SubscriptionId {
  private constructor(private readonly value: string) {}

  static generate(): SubscriptionId {
    return new SubscriptionId(uuidv7());
  }

  static fromString(value: string): SubscriptionId {
    if (!isValidUuid(value)) {
      throw new InvalidIdentifierError(`SubscriptionId must be a valid UUID, got "${value}"`);
    }
    return new SubscriptionId(value);
  }

  toString(): string {
    return this.value;
  }

  equals(other: SubscriptionId): boolean {
    return this.value === other.value;
  }
}
