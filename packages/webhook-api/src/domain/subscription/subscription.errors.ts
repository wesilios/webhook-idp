export abstract class DomainError extends Error {
  abstract readonly code: string;

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export type TargetUrlErrorCode =
  | 'URL_TOO_LONG'
  | 'INVALID_URL_FORMAT'
  | 'HTTPS_REQUIRED'
  | 'CREDENTIALS_NOT_ALLOWED'
  | 'PRIVATE_HOST_NOT_ALLOWED';

export class InvalidTargetUrlError extends DomainError {
  constructor(
    readonly code: TargetUrlErrorCode,
    message: string
  ) {
    super(message);
  }
}

export class InvalidEventTypeError extends DomainError {
  readonly code = 'INVALID_EVENT_TYPE';
}

export class InvalidStatusTransitionError extends DomainError {
  readonly code = 'INVALID_STATUS_TRANSITION';
}

export class InvalidIdentifierError extends DomainError {
  readonly code = 'INVALID_IDENTIFIER';
}
