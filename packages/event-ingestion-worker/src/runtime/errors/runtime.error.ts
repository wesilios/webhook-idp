/**
 * Base for runtime/boundary errors — mirrors `domain/inbox/inbox.errors.ts`'s `DomainError` and
 * `application/errors/application.error.ts`'s `ApplicationError`. These represent failures in
 * the trigger/deserialization boundary itself (the broker message doesn't even parse into a
 * valid envelope shape), analogous to what a NestJS `ValidationPipe` would reject with a 400 on
 * the HTTP side — this worker has no HTTP status to map to, so it's a typed error instead,
 * caught by `RabbitMqBrokerConsumerAdapter` and turned into a nack.
 */
export abstract class RuntimeError extends Error {
  abstract readonly code: string;

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}
