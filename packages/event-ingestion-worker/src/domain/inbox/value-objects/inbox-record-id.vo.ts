import { validate as isValidUuid, v7 as uuidv7 } from 'uuid';
import { InvalidIdentifierError } from '../inbox.errors.js';

export class InboxRecordId {
  private constructor(private readonly value: string) {}

  static generate(): InboxRecordId {
    return new InboxRecordId(uuidv7());
  }

  static fromString(value: string): InboxRecordId {
    if (!isValidUuid(value)) {
      throw new InvalidIdentifierError(`InboxRecordId must be a valid UUID, got "${value}"`);
    }
    return new InboxRecordId(value);
  }

  toString(): string {
    return this.value;
  }

  equals(other: InboxRecordId): boolean {
    return this.value === other.value;
  }
}
