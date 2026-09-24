import { ApplicationError } from './application.error.js';

export class DuplicateSubscriptionError extends ApplicationError {
  readonly code = 'DUPLICATE_SUBSCRIPTION';
}
