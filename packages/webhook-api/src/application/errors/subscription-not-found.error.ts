import { ApplicationError } from './application.error.js';

export class SubscriptionNotFoundError extends ApplicationError {
  readonly code = 'SUBSCRIPTION_NOT_FOUND';
}
