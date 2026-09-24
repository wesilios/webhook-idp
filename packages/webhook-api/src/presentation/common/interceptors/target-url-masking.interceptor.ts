import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { map } from 'rxjs';
import type { Observable } from 'rxjs';
import type {
  PaginatedSubscriptionsResponseDto,
  SubscriptionResponseDto,
} from '../../subscriptions/dto/subscription-response.dto.js';

/**
 * Masks `TargetUrl`'s hostname in outgoing subscription responses — display-only redaction, not
 * data redaction: the domain aggregate, `SubscriptionMongoRepository`, and the duplicate-check
 * query all keep working against the real, unmasked URL. Only the JSON that leaves this process
 * is obscured.
 *
 * Applied per-route via `@UseInterceptors()`, never registered globally — NestJS guarantees a
 * route-level interceptor runs innermost (global -> controller -> route, route closest to the
 * handler), so this transforms the raw `SubscriptionResponseDto`/`PaginatedSubscriptionsResponseDto`
 * *before* the global `EnvelopeInterceptor` wraps it, not the already-enveloped response.
 */
@Injectable()
export class TargetUrlMaskingInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(map((data: unknown) => maskResponse(data)));
  }
}

function maskResponse(data: unknown): unknown {
  if (isPaginatedResponse(data)) {
    return Object.assign({}, data, { Items: data.Items.map(maskSubscription) });
  }
  if (isSubscriptionResponse(data)) {
    return maskSubscription(data);
  }
  return data;
}

function isSubscriptionResponse(value: unknown): value is SubscriptionResponseDto {
  return typeof value === 'object' && value !== null && typeof (value as SubscriptionResponseDto).TargetUrl === 'string';
}

function isPaginatedResponse(value: unknown): value is PaginatedSubscriptionsResponseDto {
  return (
    typeof value === 'object' && value !== null && Array.isArray((value as PaginatedSubscriptionsResponseDto).Items)
  );
}

function maskSubscription(subscription: SubscriptionResponseDto): SubscriptionResponseDto {
  return Object.assign({}, subscription, { TargetUrl: maskTargetUrl(subscription.TargetUrl) });
}

// Masks a URL's hostname, keeping scheme/port/path/query/hash visible. Subdomain labels are
// fully replaced with asterisks; the domain label keeps a short (3 char max) prefix, remainder
// replaced with asterisks; the TLD is always replaced with exactly two asterisks. Asterisk
// counts are randomized per call so a consistent mask length never itself hints at the real
// hostname's length.
export function maskTargetUrl(targetUrl: string): string {
  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
  } catch {
    return targetUrl; // shouldn't happen — the domain layer already validated this is a URL
  }
  const maskedHost = maskHostname(parsed.hostname);
  const port = parsed.port.length > 0 ? ':' + parsed.port : '';
  return parsed.protocol + '//' + maskedHost + port + parsed.pathname + parsed.search + parsed.hash;
}

const IPV4_PATTERN = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;

function maskHostname(hostname: string): string {
  const labels = hostname.split('.');
  // IPv4 literals and anything with no dots at all (incl. a bracketed IPv6 literal, which has no
  // '.' — see target-url.vo.ts) don't have a meaningful "domain label" to partially reveal;
  // partially revealing an IPv4 octet would often just show the whole 1-3 digit octet in the
  // clear, so mask these fully instead.
  if (labels.length === 1 || IPV4_PATTERN.test(hostname)) {
    return randomAsterisks(6, 14);
  }

  // labels[labels.length - 1] is the TLD — always replaced with the fixed '**' marker below,
  // its real value is never used.
  const domain = labels[labels.length - 2] as string;
  const subdomains = labels.slice(0, labels.length - 2);

  const maskedSubdomains = subdomains.map(() => randomAsterisks(4, 12));
  const maskedDomain = maskDomainLabel(domain);

  return [...maskedSubdomains, maskedDomain, '**'].join('.');
}

function maskDomainLabel(label: string): string {
  const prefix = label.slice(0, Math.min(3, label.length));
  return prefix + randomAsterisks(3, 8);
}

function randomAsterisks(min: number, max: number): string {
  const count = min + Math.floor(Math.random() * (max - min + 1));
  return '*'.repeat(count);
}
