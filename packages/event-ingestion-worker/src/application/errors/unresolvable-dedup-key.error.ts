import { ApplicationError } from './application.error.js';

/** Neither the envelope's `eventId` nor a broker-native message id was present, so no dedup key
 * can be safely derived. Per the README's "Dedup key choice matters": never synthesize one here
 * — that risks silent duplicate processing, the exact failure this worker exists to prevent. */
export class UnresolvableDedupKeyError extends ApplicationError {
  readonly code = 'UNRESOLVABLE_DEDUP_KEY';
}
