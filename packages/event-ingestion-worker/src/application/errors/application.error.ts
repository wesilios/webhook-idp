/**
 * Base for application-layer errors — mirrors `domain/inbox/inbox.errors.ts`'s `DomainError`,
 * but these are NOT domain errors: they represent business-rule failures that need more than a
 * single value object's own invariant to detect (e.g. `UnresolvableDedupKeyError` needs both the
 * envelope and the broker message together), not a self-contained aggregate invariant. Envelope
 * *shape* validation lives in `runtime/errors/` instead — see that layer's `RuntimeError`.
 */
export abstract class ApplicationError extends Error {
  abstract readonly code: string;

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}
