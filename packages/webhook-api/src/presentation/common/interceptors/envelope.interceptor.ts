import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { Response } from 'express';
import { Observable, map } from 'rxjs';
import type { ApiEnvelope } from './envelope.dto.js';

/**
 * Global success-response interceptor (registered via `APP_INTERCEPTOR`). Wraps whatever a
 * controller handler returns into the `ApiEnvelope` shape. `StatusCode` mirrors the actual HTTP
 * response status Nest has already resolved for this route (default-by-method, or an explicit
 * `@HttpCode()`) — Nest applies that status to the response object before interceptors run, so
 * reading it back off `response.statusCode` here reflects the real outgoing status rather than
 * guessing it. Error responses are handled separately by `DomainExceptionFilter`, never here.
 */
@Injectable()
export class EnvelopeInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler<unknown>): Observable<ApiEnvelope<unknown>> {
    const response = context.switchToHttp().getResponse<Response>();

    return next.handle().pipe(
      map((data): ApiEnvelope<unknown> => {
        const statusCode = response.statusCode;
        return {
          Data: data ?? null,
          StatusCode: statusCode,
          Code: 'OK',
          Message: defaultMessageFor(statusCode),
          Errors: [],
        };
      })
    );
  }
}

function defaultMessageFor(statusCode: number): string {
  switch (statusCode) {
    case 201:
      return 'Created';
    case 204:
      return 'No Content';
    default:
      return 'OK';
  }
}
