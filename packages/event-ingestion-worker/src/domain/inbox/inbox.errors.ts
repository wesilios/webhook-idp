export abstract class DomainError extends Error {
  abstract readonly code: string;

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class InvalidIdentifierError extends DomainError {
  readonly code = 'INVALID_IDENTIFIER';
}

export class InvalidEventTypeError extends DomainError {
  readonly code = 'INVALID_EVENT_TYPE';
}

export class InvalidPayloadError extends DomainError {
  readonly code = 'INVALID_PAYLOAD';
}
