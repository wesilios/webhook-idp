import { InvalidIdentifierError } from '../inbox.errors.js';

// Not UUID-constrained on purpose: the preferred source is the event envelope's `eventId`, which
// the contract requires to be a non-empty string but not necessarily UUID-formatted — a publisher
// may scope it (e.g. "OrderService-<uuid>") for its own traceability, see the package README's
// "Event envelope contract". The fallback source is the broker's native message-id property,
// whose format varies by broker/client and also isn't guaranteed to be a UUID. This VO only
// enforces "non-empty" — which source won during resolution is an application-layer concern, not
// a domain one.
export class DedupKey {
  private constructor(private readonly value: string) {}

  static fromString(value: string): DedupKey {
    if (!value || value.trim().length === 0) {
      throw new InvalidIdentifierError('DedupKey must not be empty');
    }
    return new DedupKey(value);
  }

  toString(): string {
    return this.value;
  }

  equals(other: DedupKey): boolean {
    return this.value === other.value;
  }
}
