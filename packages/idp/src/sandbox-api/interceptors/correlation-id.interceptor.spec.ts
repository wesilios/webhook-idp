import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { of } from 'rxjs';
import { CorrelationIdInterceptor } from './correlation-id.interceptor.js';

function createContext(body: unknown): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ body }),
    }),
  } as unknown as ExecutionContext;
}

function createHandler(): CallHandler {
  return { handle: () => of('handled') };
}

describe('CorrelationIdInterceptor', () => {
  it('populates correlationId with a fresh UUID when missing', () => {
    const interceptor = new CorrelationIdInterceptor();
    const body: Record<string, unknown> = { tenantId: 'tenant-1' };

    interceptor.intercept(createContext(body), createHandler());

    expect(body.correlationId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  it('leaves an existing correlationId untouched', () => {
    const interceptor = new CorrelationIdInterceptor();
    const body: Record<string, unknown> = { tenantId: 'tenant-1', correlationId: 'already-set' };

    interceptor.intercept(createContext(body), createHandler());

    expect(body.correlationId).toBe('already-set');
  });

  it('generates a different value on each request (not a shared/cached id)', () => {
    const interceptor = new CorrelationIdInterceptor();
    const bodyA: Record<string, unknown> = { tenantId: 'tenant-1' };
    const bodyB: Record<string, unknown> = { tenantId: 'tenant-1' };

    interceptor.intercept(createContext(bodyA), createHandler());
    interceptor.intercept(createContext(bodyB), createHandler());

    expect(bodyA.correlationId).not.toBe(bodyB.correlationId);
  });

  it('does nothing when the body is not an object', () => {
    const interceptor = new CorrelationIdInterceptor();

    expect(() => interceptor.intercept(createContext(undefined), createHandler())).not.toThrow();
  });

  it('calls next.handle() and forwards its result', () => {
    const interceptor = new CorrelationIdInterceptor();
    const handler = createHandler();
    const handleSpy = vi.spyOn(handler, 'handle');

    const result = interceptor.intercept(createContext({ tenantId: 'tenant-1' }), handler);

    expect(handleSpy).toHaveBeenCalledOnce();
    expect(result).toBeDefined();
  });
});
