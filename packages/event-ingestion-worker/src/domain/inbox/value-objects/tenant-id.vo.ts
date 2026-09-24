import { InvalidIdentifierError } from '../inbox.errors.js';

export class TenantId {
  private constructor(private readonly value: string) {}

  static fromString(value: string): TenantId {
    if (!value || value.trim().length === 0) {
      throw new InvalidIdentifierError('TenantId must not be empty');
    }
    return new TenantId(value);
  }

  toString = (): string => {
    return this.value;
  };

  equals = (other: TenantId): boolean => {
    return this.value === other.value;
  };
}
