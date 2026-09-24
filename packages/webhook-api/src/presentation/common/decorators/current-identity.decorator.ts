import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { ResolvedIdentity } from '../guards/identity.guard.js';

/**
 * Reads the identity resolved by `IdentityGuard` (attached to `request.identity`). Controllers
 * must be guarded by `IdentityGuard` for this to be populated.
 */
export const CurrentIdentity = createParamDecorator((_data: unknown, ctx: ExecutionContext): ResolvedIdentity => {
  const request = ctx.switchToHttp().getRequest<Request & { identity?: ResolvedIdentity }>();

  if (!request.identity) {
    throw new Error('CurrentIdentity() used on a route not protected by IdentityGuard');
  }

  return request.identity;
});
