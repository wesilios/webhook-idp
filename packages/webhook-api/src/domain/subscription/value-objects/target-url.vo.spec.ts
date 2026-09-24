import { InvalidTargetUrlError } from '../subscription.errors.js';
import { TargetUrl } from './target-url.vo.js';

function codeOf(fn: () => void): string {
  try {
    fn();
  } catch (error) {
    if (error instanceof InvalidTargetUrlError) return error.code;
    throw error;
  }
  throw new Error('expected fromString to throw');
}

describe('TargetUrl', () => {
  it('accepts a valid https URL', () => {
    const url = TargetUrl.fromString('https://client.example.com/webhooks/inbound');
    expect(url.toString()).toBe('https://client.example.com/webhooks/inbound');
  });

  it('accepts a public IPv4 literal host', () => {
    const url = TargetUrl.fromString('https://8.8.8.8/hook');
    expect(url.toString()).toBe('https://8.8.8.8/hook');
  });

  it('accepts a public IPv6 literal host', () => {
    const url = TargetUrl.fromString('https://[2001:4860:4860::8888]/hook');
    expect(url.toString()).toContain('2001:4860:4860::8888');
  });

  it('rejects a URL longer than 2048 characters', () => {
    const long = `https://example.com/${'a'.repeat(2048)}`;
    expect(codeOf(() => TargetUrl.fromString(long))).toBe('URL_TOO_LONG');
  });

  it('rejects a malformed URL', () => {
    expect(codeOf(() => TargetUrl.fromString('not a url'))).toBe('INVALID_URL_FORMAT');
  });

  it('rejects an out-of-range IPv4 octet as INVALID_URL_FORMAT (Node\'s URL parser rejects it first)', () => {
    // Confirmed by tracing: `new URL('https://999.1.1.1/hook')` throws before our code ever sees
    // a `.hostname` — WHATWG URL's own IPv4 parser validates the 0-255 octet range. So
    // `isPrivateIPv4`'s own "malformed octet -> reject closed" branch is defensive/unreachable
    // via `fromString`, not dead code we'd hit here.
    expect(codeOf(() => TargetUrl.fromString('https://999.1.1.1/hook'))).toBe('INVALID_URL_FORMAT');
  });

  it('rejects a non-https scheme', () => {
    expect(codeOf(() => TargetUrl.fromString('http://example.com/hook'))).toBe('HTTPS_REQUIRED');
  });

  it('rejects userinfo in the URL', () => {
    expect(codeOf(() => TargetUrl.fromString('https://user:pass@example.com/hook'))).toBe('CREDENTIALS_NOT_ALLOWED');
  });

  it.each([
    ['localhost', 'https://localhost/hook'],
    ['loopback IPv4', 'https://127.0.0.1/hook'],
    ['private 10.x', 'https://10.1.2.3/hook'],
    ['private 172.16-31.x', 'https://172.20.0.5/hook'],
    ['private 192.168.x', 'https://192.168.1.1/hook'],
    ['link-local incl. cloud metadata', 'https://169.254.169.254/latest/meta-data'],
    ['unspecified 0.0.0.0', 'https://0.0.0.0/hook'],
    ['IPv6 loopback', 'https://[::1]/hook'],
    ['IPv6 unspecified', 'https://[::]/hook'],
    ['IPv6 link-local', 'https://[fe80::1]/hook'],
    ['IPv6 unique-local', 'https://[fd12:3456::1]/hook'],
    ['IPv4-mapped IPv6 private', 'https://[::ffff:10.0.0.1]/hook'],
  ])('rejects %s as PRIVATE_HOST_NOT_ALLOWED', (_label, url) => {
    expect(codeOf(() => TargetUrl.fromString(url))).toBe('PRIVATE_HOST_NOT_ALLOWED');
  });

  it('compares by value', () => {
    const a = TargetUrl.fromString('https://example.com/hook');
    const b = TargetUrl.fromString('https://example.com/hook');
    const c = TargetUrl.fromString('https://example.com/other');
    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
  });
});
