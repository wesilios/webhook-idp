import { InvalidIdentifierError } from '../subscription.errors.js';

export class UserId {
  private constructor(private readonly value: string) {}

  static fromString(value: string): UserId {
    if (!value || value.trim().length === 0) {
      throw new InvalidIdentifierError('UserId must not be empty');
    }
    return new UserId(value);
  }

  toString(): string {
    return this.value;
  }

  equals(other: UserId): boolean {
    return this.value === other.value;
  }
}
