/**
 * Base for application-layer errors — mirrors the shape of `domain/subscription/subscription.errors.ts`'s
 * `DomainError`, but these are NOT domain errors: the invariants they represent (duplicate-check,
 * existence-check) require a repository query and therefore belong to the application layer, not to the
 * aggregate's own self-contained invariants.
 */
export abstract class ApplicationError extends Error {
  abstract readonly code: string;

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}
