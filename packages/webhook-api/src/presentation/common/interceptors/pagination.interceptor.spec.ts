import { BadRequestException } from '@nestjs/common';
import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { firstValueFrom, of } from 'rxjs';
import { PaginationInterceptor, type ResolvedPagination } from './pagination.interceptor.js';

interface RequestWithPagination {
  query: Record<string, string>;
  pagination?: ResolvedPagination;
}

function buildContext(query: Record<string, string>): { context: ExecutionContext; request: RequestWithPagination } {
  const request: RequestWithPagination = { query };
  const context = {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
  return { context, request };
}

const handler: CallHandler = { handle: () => of('next-called') };

describe('PaginationInterceptor', () => {
  const interceptor = new PaginationInterceptor();

  it('attaches default page/pageSize to the request when both are missing', async () => {
    const { context, request } = buildContext({});

    await firstValueFrom(interceptor.intercept(context, handler));

    expect(request.pagination).toEqual({ page: 1, pageSize: 20 });
  });

  it('attaches an explicitly provided page/pageSize', async () => {
    const { context, request } = buildContext({ page: '3', pageSize: '50' });

    await firstValueFrom(interceptor.intercept(context, handler));

    expect(request.pagination).toEqual({ page: 3, pageSize: 50 });
  });

  it('only defaults the missing one when just one of the two is provided', async () => {
    const { context, request } = buildContext({ page: '5' });

    await firstValueFrom(interceptor.intercept(context, handler));

    expect(request.pagination).toEqual({ page: 5, pageSize: 20 });
  });

  it('rejects a non-numeric page with a 400', () => {
    const { context } = buildContext({ page: 'abc' });

    // `intercept()` validates synchronously before returning an Observable — it throws
    // directly, not via the Observable's async error channel.
    expect(() => interceptor.intercept(context, handler)).toThrow(BadRequestException);
  });

  it('rejects a zero/negative pageSize with a 400', () => {
    const { context } = buildContext({ pageSize: '0' });

    expect(() => interceptor.intercept(context, handler)).toThrow(BadRequestException);
  });

  it('calls next.handle() and passes its result through', async () => {
    const { context } = buildContext({});

    const result = await firstValueFrom(interceptor.intercept(context, handler));

    expect(result).toBe('next-called');
  });
});
