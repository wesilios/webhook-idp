import { InvalidIdentifierError } from '../inbox.errors.js';

export class CorrelationId {
  private constructor(private readonly value: string) {}
  static fromString(value: string): CorrelationId {
    if (!value || value.trim().length === 0) {
      throw new InvalidIdentifierError('CorrelationId must not be empty');
    }

    return new CorrelationId(value);
  }

  toString = (): string => {
    return this.value;
  };

  equals = (other: CorrelationId): boolean => {
    return this.value === other.value;
  };
}
