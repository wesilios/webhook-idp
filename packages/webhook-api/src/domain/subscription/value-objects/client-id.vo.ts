import { InvalidIdentifierError } from '../subscription.errors.js';

export class ClientId {
  private constructor(private readonly value: string) {}

  static fromString(value: string): ClientId {
    if (!value || value.trim().length === 0) {
      throw new InvalidIdentifierError('ClientId must not be empty');
    }
    return new ClientId(value);
  }

  toString(): string {
    return this.value;
  }

  equals(other: ClientId): boolean {
    return this.value === other.value;
  }
}
