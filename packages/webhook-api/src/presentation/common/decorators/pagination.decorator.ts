import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { ResolvedPagination } from '../interceptors/pagination.interceptor.js';

/**
 * Reads the pagination resolved by `PaginationInterceptor` (attached to `request.pagination`).
 * Routes must apply `@UseInterceptors(PaginationInterceptor)` for this to be populated.
 */
export const Pagination = createParamDecorator((_data: unknown, ctx: ExecutionContext): ResolvedPagination => {
  const request = ctx.switchToHttp().getRequest<Request & { pagination?: ResolvedPagination }>();

  if (!request.pagination) {
    throw new Error('Pagination() used on a route not wrapped by PaginationInterceptor');
  }

  return request.pagination;
});
