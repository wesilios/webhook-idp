import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import type { Response } from 'express';
import { ApplicationError, DuplicateSubscriptionError, SubscriptionNotFoundError } from '@application/errors/index.js';
import { DomainError, InvalidStatusTransitionError } from '@domain/subscription/subscription.errors.js';
import type { ApiEnvelope, ApiErrorItem } from '../interceptors/envelope.dto.js';

interface Resolved {
  status: number;
  code: string;
  message: string;
  errors: ApiErrorItem[];
}

/**
 * Global exception filter (registered via `APP_FILTER`) mapping `DomainError`
 * (`domain/subscription/subscription.errors.ts`) and `ApplicationError`
 * (`application/errors/*.ts`) subclasses to the `ApiEnvelope` error shape, per the status table
 * below. `DomainError` and `ApplicationError` don't share a common base class, so this uses a
 * broad `@Catch()` with `instanceof` checks rather than `@Catch(DomainError, ApplicationError)`
 * — which also lets it courteously re-envelope Nest's own `HttpException`s (e.g. `IdentityGuard`'s
 * `UnauthorizedException`, `ValidationPipe`'s `BadRequestException`) instead of letting them
 * fall through to Nest's default (unenveloped) error response. Anything else is treated as
 * unexpected and mapped to a generic 500 — no internals leaked.
 *
 * Status mapping:
 * - `InvalidTargetUrlError` / `InvalidEventTypeError` / `InvalidIdentifierError` -> 400
 * - `InvalidStatusTransitionError` -> 409
 * - `SubscriptionNotFoundError` -> 404
 * - `DuplicateSubscriptionError` -> 409
 * - any other `HttpException` -> its own status
 * - anything else -> 500
 */
@Catch()
export class DomainExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const resolved = this.resolve(exception);

    const body: ApiEnvelope<null> = {
      Data: null,
      StatusCode: resolved.status,
      Code: resolved.code,
      Message: resolved.message,
      Errors: resolved.errors,
    };

    response.status(resolved.status).json(body);
  }

  private resolve(exception: unknown): Resolved {
    if (exception instanceof InvalidStatusTransitionError) {
      return single(409, exception.code, exception.message);
    }
    if (exception instanceof SubscriptionNotFoundError) {
      return single(404, exception.code, exception.message);
    }
    if (exception instanceof DuplicateSubscriptionError) {
      return single(409, exception.code, exception.message);
    }
    if (exception instanceof DomainError) {
      // The remaining DomainError subclasses: InvalidTargetUrlError, InvalidEventTypeError,
      // InvalidIdentifierError.
      return single(400, exception.code, exception.message);
    }
    if (exception instanceof ApplicationError) {
      // No other ApplicationError subclass is defined today; kept as a defensive default.
      return single(500, exception.code, exception.message);
    }
    if (exception instanceof HttpException) {
      return this.resolveHttpException(exception);
    }
    return single(500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }

  private resolveHttpException(exception: HttpException): Resolved {
    const status = exception.getStatus();
    const body = exception.getResponse();

    if (typeof body === 'string') {
      return single(status, exception.name, body);
    }

    const responseObject = body as { message?: string | string[]; error?: string };
    const summary = responseObject.error ?? exception.message;
    const details = responseObject.message;

    if (Array.isArray(details) && details.length > 0) {
      return {
        status,
        code: exception.name,
        message: summary,
        errors: details.map((detail) => ({ ErrorCode: 'VALIDATION_ERROR', ErrorMessage: detail })),
      };
    }

    return single(status, exception.name, typeof details === 'string' ? details : summary);
  }
}

function single(status: number, code: string, message: string): Resolved {
  return { status, code, message, errors: [{ ErrorCode: code, ErrorMessage: message }] };
}
