import { InvalidTargetUrlError } from '../subscription.errors.js';

const MAX_LENGTH = 2048;

export class TargetUrl {
  private constructor(private readonly value: string) {}

  static fromString(value: string): TargetUrl {
    if (value.length > MAX_LENGTH) {
      throw new InvalidTargetUrlError('URL_TOO_LONG', `targetUrl must be at most ${MAX_LENGTH} characters`);
    }

    let parsed: URL;
    try {
      parsed = new URL(value);
    } catch {
      throw new InvalidTargetUrlError('INVALID_URL_FORMAT', 'targetUrl must be an absolute URL');
    }

    if (parsed.protocol !== 'https:') {
      throw new InvalidTargetUrlError('HTTPS_REQUIRED', 'targetUrl must use the https scheme');
    }

    if (parsed.username || parsed.password) {
      throw new InvalidTargetUrlError('CREDENTIALS_NOT_ALLOWED', 'targetUrl must not contain userinfo');
    }

    if (isPrivateOrReservedHost(parsed.hostname)) {
      throw new InvalidTargetUrlError(
        'PRIVATE_HOST_NOT_ALLOWED',
        `targetUrl hostname "${parsed.hostname}" is not allowed`
      );
    }

    return new TargetUrl(parsed.toString());
  }

  toString(): string {
    return this.value;
  }

  equals(other: TargetUrl): boolean {
    return this.value === other.value;
  }
}

// Static check on the literal hostname/IP only — no DNS lookup. A domain that resolves to
// a public IP now but is later repointed internally (DNS rebinding) will pass this check;
// the delivery worker must re-resolve-and-check immediately before connecting at send time.
function isPrivateOrReservedHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === 'localhost') return true;
  if (host.startsWith('[') && host.endsWith(']')) {
    return isPrivateIPv6(host.slice(1, -1));
  }
  if (isIPv4(host)) return isPrivateIPv4(host);
  // Defensive only: `new URL(...).hostname` always brackets an IPv6 literal, so `.hostname`
  // should never contain a bare (unbracketed) `:` in practice — not reachable via `fromString`,
  // kept in case some URL implementation ever normalizes differently.
  if (host.includes(':')) return isPrivateIPv6(host);
  return false;
}

function isIPv4(host: string): boolean {
  return /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host);
}

function isPrivateIPv4(host: string): boolean {
  const octets = host.split('.').map(Number);
  // Defensive only: confirmed by tracing that `new URL(...)` itself rejects an out-of-range
  // octet (e.g. "999.1.1.1") before `fromString` ever produces a `.hostname` to check — not
  // reachable in practice, kept in case some URL implementation validates more loosely.
  if (octets.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true; // malformed -> reject closed
  const [a, b] = octets;
  if (a === 0) return true; // unspecified / "this network"
  if (a === 10) return true; // private
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local, incl. 169.254.169.254 cloud metadata
  if (a === 172 && b !== undefined && b >= 16 && b <= 31) return true; // private
  if (a === 192 && b === 168) return true; // private
  return false;
}

function isPrivateIPv6(host: string): boolean {
  const normalized = host.toLowerCase();
  if (normalized === '::1' || normalized === '::') return true; // loopback / unspecified
  if (normalized.startsWith('fe80:')) return true; // link-local
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true; // unique-local fc00::/7

  // IPv4-mapped (::ffff:a.b.c.d) — kept for other/future URL-parser normalizations; Node's
  // `URL` (confirmed by tracing a real request) always normalizes this to the hex form below,
  // so this dotted branch isn't reachable via `fromString` today.
  const dotted = /^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.exec(normalized);
  if (dotted) return isPrivateIPv4(dotted[1] as string);

  const hex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(normalized);
  if (hex) {
    const hi = parseInt(hex[1] as string, 16);
    const lo = parseInt(hex[2] as string, 16);
    const ipv4 = [(hi >> 8) & 0xff, hi & 0xff, (lo >> 8) & 0xff, lo & 0xff].join('.');
    return isPrivateIPv4(ipv4);
  }

  return false;
}
