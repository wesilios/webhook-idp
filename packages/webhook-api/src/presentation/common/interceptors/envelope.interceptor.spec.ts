import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { firstValueFrom, of } from 'rxjs';
import { EnvelopeInterceptor } from './envelope.interceptor.js';

function buildContext(statusCode: number): ExecutionContext {
  return {
    switchToHttp: () => ({
      getResponse: () => ({ statusCode }),
      getRequest: () => ({}),
    }),
  } as unknown as ExecutionContext;
}

function buildHandler(data: unknown): CallHandler {
  return { handle: () => of(data) };
}

describe('EnvelopeInterceptor', () => {
  const interceptor = new EnvelopeInterceptor();

  it('wraps the returned data under Data and mirrors the actual response status (200)', async () => {
    const payload = { Id: 'sub-1', Status: 'ACTIVE' };

    const result = await firstValueFrom(interceptor.intercept(buildContext(200), buildHandler(payload)));

    expect(result).toEqual({
      Data: payload,
      StatusCode: 200,
      Code: 'OK',
      Message: 'OK',
      Errors: [],
    });
  });

  it('reflects a 201 status with a Created message', async () => {
    const payload = { Id: 'sub-2' };

    const result = await firstValueFrom(interceptor.intercept(buildContext(201), buildHandler(payload)));

    expect(result.StatusCode).toBe(201);
    expect(result.Message).toBe('Created');
    expect(result.Code).toBe('OK');
    expect(result.Errors).toEqual([]);
  });

  it('defaults Data to null when the handler returns nothing', async () => {
    const result = await firstValueFrom(interceptor.intercept(buildContext(200), buildHandler(undefined)));

    expect(result.Data).toBeNull();
  });

  it('reflects a 204 status with a "No Content" message', async () => {
    const result = await firstValueFrom(interceptor.intercept(buildContext(204), buildHandler(undefined)));

    expect(result.StatusCode).toBe(204);
    expect(result.Message).toBe('No Content');
  });
});
