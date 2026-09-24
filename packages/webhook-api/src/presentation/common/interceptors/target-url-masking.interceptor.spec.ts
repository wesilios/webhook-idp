import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { firstValueFrom, of } from 'rxjs';
import type { SubscriptionResponseDto } from '../../subscriptions/dto/subscription-response.dto.js';
import { maskTargetUrl, TargetUrlMaskingInterceptor } from './target-url-masking.interceptor.js';

const context = {} as ExecutionContext;

function handlerReturning(data: unknown): CallHandler {
  return { handle: () => of(data) };
}

function buildSubscription(overrides: Partial<SubscriptionResponseDto> = {}): SubscriptionResponseDto {
  return {
    Id: 'sub-1',
    TargetUrl: 'https://api.hooks.destination.com/endpoint',
    EventTypes: ['order.created'],
    Status: 'ACTIVE',
    CreatedAt: '2026-01-01T00:00:00.000Z',
    UpdatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('maskTargetUrl', () => {
  it('keeps the scheme and path visible', () => {
    const masked = maskTargetUrl('https://api.hooks.destination.com/endpoint');

    expect(masked.startsWith('https://')).toBe(true);
    expect(masked.endsWith('/endpoint')).toBe(true);
  });

  it('never leaks the real hostname as a substring', () => {
    const masked = maskTargetUrl('https://api.hooks.destination.com/endpoint');

    expect(masked).not.toContain('api.hooks.destination.com');
    expect(masked).not.toContain('destination');
  });

  it('keeps a short recognizable prefix of the domain label, TLD always exactly "**"', () => {
    const masked = maskTargetUrl('https://api.hooks.destination.com/endpoint');
    const host = new URL(masked.replace(/\*/g, 'x')).hostname; // asterisks aren't valid host chars for re-parsing
    const labels = host.split('.');

    expect(labels[labels.length - 1]).toBe('xx'); // '**' with * -> x
    expect(labels[labels.length - 2]?.startsWith('des')).toBe(true);
  });

  it('fully masks every subdomain label (none of their real content survives)', () => {
    const masked = maskTargetUrl('https://api.hooks.destination.com/endpoint');
    const hostPortion = masked.replace('https://', '').split('/')[0] as string;
    const labels = hostPortion.split('.');

    // api, hooks, des***, ** -> 4 labels; the first two must be pure asterisks
    expect(labels).toHaveLength(4);
    expect(labels[0]).toMatch(/^\*+$/);
    expect(labels[1]).toMatch(/^\*+$/);
  });

  it('produces a different mask length across calls (randomized, not a fixed-length placeholder)', () => {
    const lengths = new Set(
      Array.from({ length: 20 }, () => maskTargetUrl('https://api.hooks.destination.com/endpoint').length)
    );

    expect(lengths.size).toBeGreaterThan(1);
  });

  it('handles a bare two-label domain (no subdomains)', () => {
    const masked = maskTargetUrl('https://example.com/hook');

    expect(masked.startsWith('https://')).toBe(true);
    expect(masked.endsWith('/hook')).toBe(true);
    expect(masked).not.toContain('example');
  });

  it('fully masks an IPv4 literal host rather than partially revealing an octet', () => {
    const masked = maskTargetUrl('https://8.8.8.8/hook');

    expect(masked).not.toContain('8.8.8.8');
    expect(masked.replace('https://', '').split('/')[0]).toMatch(/^\*+$/);
  });

  it('fully masks a bracketed IPv6 literal host', () => {
    const masked = maskTargetUrl('https://[2001:4860:4860::8888]/hook');

    expect(masked).not.toContain('2001:4860:4860');
    expect(masked.replace('https://', '').split('/')[0]).toMatch(/^\*+$/);
  });

  it('preserves a non-default port', () => {
    const masked = maskTargetUrl('https://api.hooks.destination.com:8443/endpoint');

    expect(masked).toContain(':8443/endpoint');
  });

  it('returns the input unchanged if it somehow is not a parseable URL', () => {
    expect(maskTargetUrl('not-a-url')).toBe('not-a-url');
  });
});

describe('TargetUrlMaskingInterceptor', () => {
  const interceptor = new TargetUrlMaskingInterceptor();

  it('masks TargetUrl on a single subscription response', async () => {
    const subscription = buildSubscription();

    const result = (await firstValueFrom(
      interceptor.intercept(context, handlerReturning(subscription))
    )) as SubscriptionResponseDto;

    expect(result.TargetUrl).not.toBe(subscription.TargetUrl);
    expect(result.TargetUrl).not.toContain('destination');
    expect(result.Id).toBe(subscription.Id); // other fields untouched
  });

  it('masks TargetUrl on every item in a paginated response', async () => {
    const paginated = {
      Items: [buildSubscription({ Id: 'a' }), buildSubscription({ Id: 'b' })],
      Page: 1,
      PageSize: 20,
      Total: 2,
    };

    const result = (await firstValueFrom(interceptor.intercept(context, handlerReturning(paginated)))) as {
      Items: SubscriptionResponseDto[];
    };

    expect(result.Items).toHaveLength(2);
    for (const item of result.Items) {
      expect(item.TargetUrl).not.toContain('destination');
    }
  });

  it('passes non-subscription data through unchanged', async () => {
    const result = await firstValueFrom(interceptor.intercept(context, handlerReturning('hello world')));

    expect(result).toBe('hello world');
  });
});
