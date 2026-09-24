import { BadRequestException, CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { Request } from 'express';
import type { Observable } from 'rxjs';

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;

export interface ResolvedPagination {
  page: number;
  pageSize: number;
}

/**
 * Resolves `page`/`pageSize` from the raw query string (defaulting when absent, rejecting when
 * malformed) and attaches the result to `request.pagination` for `@Pagination()` to read —
 * mirrors `IdentityGuard`'s `request.identity` pattern. Deliberately does NOT mutate
 * `request.query`: under Express 5, `req.query` is a read-only getter recomputed from the URL on
 * every access, so assigning into it silently no-ops (confirmed by tracing a real request — the
 * mutation never survived past this method).
 */
@Injectable()
export class PaginationInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request & { pagination?: ResolvedPagination }>();

    request.pagination = {
      page: parsePositiveInt(request.query['page'], 'page') ?? DEFAULT_PAGE,
      pageSize: parsePositiveInt(request.query['pageSize'], 'pageSize') ?? DEFAULT_PAGE_SIZE,
    };

    return next.handle();
  }
}

function parsePositiveInt(value: unknown, fieldName: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'string' || !/^\d+$/.test(value) || Number.parseInt(value, 10) < 1) {
    throw new BadRequestException(`"${fieldName}" must be a positive integer`);
  }
  return Number.parseInt(value, 10);
}
