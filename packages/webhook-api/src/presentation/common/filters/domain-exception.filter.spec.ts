import type { ArgumentsHost } from '@nestjs/common';
import { BadRequestException, HttpException, UnauthorizedException } from '@nestjs/common';
import { ApplicationError } from '@application/errors/application.error.js';
import { DuplicateSubscriptionError } from '@application/errors/duplicate-subscription.error.js';
import { SubscriptionNotFoundError } from '@application/errors/subscription-not-found.error.js';
import {
  InvalidEventTypeError,
  InvalidIdentifierError,
  InvalidStatusTransitionError,
  InvalidTargetUrlError,
} from '@domain/subscription/subscription.errors.js';
import { DomainExceptionFilter } from './domain-exception.filter.js';

function buildHost() {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({}),
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
}

describe('DomainExceptionFilter', () => {
  const filter = new DomainExceptionFilter();

  it('maps InvalidTargetUrlError to 400', () => {
    const { host, status, json } = buildHost();

    filter.catch(new InvalidTargetUrlError('HTTPS_REQUIRED', 'targetUrl must use the https scheme'), host);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      Data: null,
      StatusCode: 400,
      Code: 'HTTPS_REQUIRED',
      Message: 'targetUrl must use the https scheme',
      Errors: [{ ErrorCode: 'HTTPS_REQUIRED', ErrorMessage: 'targetUrl must use the https scheme' }],
    });
  });

  it('maps InvalidEventTypeError to 400', () => {
    const { host, status, json } = buildHost();

    filter.catch(new InvalidEventTypeError('subscribedEventTypes must not be empty'), host);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ StatusCode: 400, Code: 'INVALID_EVENT_TYPE' }));
  });

  it('maps InvalidIdentifierError to 400', () => {
    const { host, status, json } = buildHost();

    filter.catch(new InvalidIdentifierError('TenantId must not be empty'), host);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ StatusCode: 400, Code: 'INVALID_IDENTIFIER' }));
  });

  it('maps InvalidStatusTransitionError to 409', () => {
    const { host, status, json } = buildHost();

    filter.catch(new InvalidStatusTransitionError('Cannot pause a subscription in status PAUSED'), host);

    expect(status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ StatusCode: 409, Code: 'INVALID_STATUS_TRANSITION' })
    );
  });

  it('maps SubscriptionNotFoundError to 404', () => {
    const { host, status, json } = buildHost();

    filter.catch(new SubscriptionNotFoundError('Subscription "abc" was not found'), host);

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ StatusCode: 404, Code: 'SUBSCRIPTION_NOT_FOUND' }));
  });

  it('maps DuplicateSubscriptionError to 409', () => {
    const { host, status, json } = buildHost();

    filter.catch(new DuplicateSubscriptionError('A subscription already exists'), host);

    expect(status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ StatusCode: 409, Code: 'DUPLICATE_SUBSCRIPTION' }));
  });

  it('preserves the status and message of a Nest HttpException (e.g. guard 401)', () => {
    const { host, status, json } = buildHost();

    filter.catch(new UnauthorizedException('Missing required "x-tenant-id" header'), host);

    expect(status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ StatusCode: 401, Message: 'Missing required "x-tenant-id" header' })
    );
  });

  it('turns a ValidationPipe BadRequestException into one Errors item per message', () => {
    const { host, status, json } = buildHost();

    filter.catch(new BadRequestException(['targetUrl must be a string', 'eventTypes must be an array']), host);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        StatusCode: 400,
        Errors: [
          { ErrorCode: 'VALIDATION_ERROR', ErrorMessage: 'targetUrl must be a string' },
          { ErrorCode: 'VALIDATION_ERROR', ErrorMessage: 'eventTypes must be an array' },
        ],
      })
    );
  });

  it('falls back to exception.message when the HttpException body has no "error" field', () => {
    const { host, status, json } = buildHost();

    filter.catch(new HttpException({ message: 'custom message', statusCode: 422 }, 422), host);

    expect(status).toHaveBeenCalledWith(422);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ StatusCode: 422, Message: 'custom message' }));
  });

  it('falls back to the error summary when the HttpException body has no "message" field', () => {
    const { host, status, json } = buildHost();

    filter.catch(new HttpException({ error: 'Some Error' }, 500), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ StatusCode: 500, Message: 'Some Error' }));
  });

  it('maps a plain-string-body HttpException using the body as the message', () => {
    const { host, status, json } = buildHost();

    filter.catch(new HttpException('plain string error body', 418), host);

    expect(status).toHaveBeenCalledWith(418);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ StatusCode: 418, Message: 'plain string error body' })
    );
  });

  it('maps an ApplicationError subclass with no dedicated rule to a defensive 500', () => {
    const { host, status, json } = buildHost();

    class UnmappedApplicationError extends ApplicationError {
      readonly code = 'UNMAPPED';
    }

    filter.catch(new UnmappedApplicationError('something application-layer went wrong'), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ StatusCode: 500, Code: 'UNMAPPED', Message: 'something application-layer went wrong' })
    );
  });

  it('maps an unexpected error to a generic 500 without leaking internals', () => {
    const { host, status, json } = buildHost();

    filter.catch(new Error('some internal secret detail'), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      Data: null,
      StatusCode: 500,
      Code: 'INTERNAL_ERROR',
      Message: 'An unexpected error occurred',
      Errors: [{ ErrorCode: 'INTERNAL_ERROR', ErrorMessage: 'An unexpected error occurred' }],
    });
  });
});
