import { randomUUID } from 'node:crypto';
import { Injectable, type CallHandler, type ExecutionContext, type NestInterceptor } from '@nestjs/common';
import type { Request } from 'express';
import type { Observable } from 'rxjs';

/**
 * Populates `correlationId` on the incoming request body with a fresh UUID whenever the caller
 * omits it (or sends it empty/null) — before `ValidationPipe` ever builds a `CreateEventDto` from
 * the body. Interceptors run before pipes in Nest's request lifecycle, so mutating `request.body`
 * here is visible to the pipe/DTO that resolves the `@Body()` param right after.
 *
 * This is a deliberate design choice for this sandbox specifically: unlike `eventId` (which is
 * always adapter-generated, never client input — see `RabbitMqBrokerPublisherAdapter`),
 * `correlationId` is still accepted from the caller when supplied, only backfilled when absent.
 */
@Injectable()
export class CorrelationIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    if (request.body && typeof request.body === 'object' && !request.body.correlationId) {
      request.body.correlationId = randomUUID();
    }
    return next.handle();
  }
}
