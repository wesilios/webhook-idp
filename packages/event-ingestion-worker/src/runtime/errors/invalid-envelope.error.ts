import { RuntimeError } from './runtime.error.js';

/** The broker message body isn't a JSON object, or fails `EventEnvelopeDto`'s shape validation
 * (missing/malformed `tenantId`, `eventType`, or `payload`) — see the package README's "Event
 * envelope contract". */
export class InvalidEnvelopeError extends RuntimeError {
  readonly code = 'INVALID_ENVELOPE';
}
