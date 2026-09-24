import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';

export interface ResolvedIdentity {
  tenantId: string;
  clientId: string;
  userId: string | null;
}

/**
 * Resolves caller identity from plain `x-tenant-id`/`x-client-id`/`x-user-id` headers — the
 * documented stand-in for real Bearer JWT verification (see README "Authentication" /
 * `.agent/rules/identity.md`). `x-tenant-id` and `x-client-id` are required (401 if missing);
 * `x-user-id` is optional/nullable, matching the "absent on machine-to-machine tokens" rule.
 *
 * Attaches the resolved identity to `request.identity` for `@CurrentIdentity()` to read.
 */
@Injectable()
export class IdentityGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request & { identity?: ResolvedIdentity }>();

    const tenantId = firstHeaderValue(request.headers['x-tenant-id']);
    const clientId = firstHeaderValue(request.headers['x-client-id']);
    const userId = firstHeaderValue(request.headers['x-user-id']);

    if (!tenantId) {
      throw new UnauthorizedException('Missing required "x-tenant-id" header');
    }

    if (!clientId) {
      throw new UnauthorizedException('Missing required "x-client-id" header');
    }

    request.identity = {
      tenantId,
      clientId,
      userId: userId ?? null,
    };

    return true;
  }
}

function firstHeaderValue(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw !== undefined && raw.trim().length > 0 ? raw : undefined;
}
