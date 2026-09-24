import type { ExecutionContext } from '@nestjs/common';
import { UnauthorizedException } from '@nestjs/common';
import { IdentityGuard } from './identity.guard.js';
import type { ResolvedIdentity } from './identity.guard.js';

function buildContext(headers: Record<string, string | string[] | undefined>) {
  const request: { headers: typeof headers; identity?: ResolvedIdentity } = { headers };
  const context = {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
  return { context, request };
}

describe('IdentityGuard', () => {
  const guard = new IdentityGuard();

  it('allows the request through and attaches the resolved identity when all headers are present', () => {
    const { context, request } = buildContext({
      'x-tenant-id': 'tenant-1',
      'x-client-id': 'client-1',
      'x-user-id': 'user-1',
    });

    expect(guard.canActivate(context)).toBe(true);
    expect(request.identity).toEqual({ tenantId: 'tenant-1', clientId: 'client-1', userId: 'user-1' });
  });

  it('resolves userId to null when x-user-id is absent (machine-to-machine call)', () => {
    const { context, request } = buildContext({ 'x-tenant-id': 'tenant-1', 'x-client-id': 'client-1' });

    expect(guard.canActivate(context)).toBe(true);
    expect(request.identity).toEqual({ tenantId: 'tenant-1', clientId: 'client-1', userId: null });
  });

  it('throws UnauthorizedException when x-tenant-id is missing', () => {
    const { context } = buildContext({ 'x-client-id': 'client-1' });

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException when x-client-id is missing', () => {
    const { context } = buildContext({ 'x-tenant-id': 'tenant-1' });

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('treats a blank header value as missing', () => {
    const { context } = buildContext({ 'x-tenant-id': '   ', 'x-client-id': 'client-1' });

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('takes the first value when a header is repeated (array form)', () => {
    const { context, request } = buildContext({
      'x-tenant-id': ['tenant-1', 'tenant-2'],
      'x-client-id': 'client-1',
    });

    expect(guard.canActivate(context)).toBe(true);
    expect(request.identity?.tenantId).toBe('tenant-1');
  });
});
