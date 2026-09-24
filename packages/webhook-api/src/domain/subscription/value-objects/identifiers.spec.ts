import { InvalidIdentifierError } from '../subscription.errors.js';
import { ClientId } from './client-id.vo.js';
import { SubscriptionId } from './subscription-id.vo.js';
import { TenantId } from './tenant-id.vo.js';
import { UserId } from './user-id.vo.js';

describe('TenantId', () => {
  it('accepts a non-empty string', () => {
    expect(TenantId.fromString('tenant-123').toString()).toBe('tenant-123');
  });

  it('rejects an empty or whitespace-only string', () => {
    expect(() => TenantId.fromString('')).toThrow(InvalidIdentifierError);
    expect(() => TenantId.fromString('   ')).toThrow(InvalidIdentifierError);
  });

  it('compares by value', () => {
    expect(TenantId.fromString('same').equals(TenantId.fromString('same'))).toBe(true);
    expect(TenantId.fromString('same').equals(TenantId.fromString('different'))).toBe(false);
  });
});

describe('ClientId', () => {
  it('accepts a non-empty string', () => {
    expect(ClientId.fromString('client-123').toString()).toBe('client-123');
  });

  it('rejects an empty or whitespace-only string', () => {
    expect(() => ClientId.fromString('')).toThrow(InvalidIdentifierError);
    expect(() => ClientId.fromString('   ')).toThrow(InvalidIdentifierError);
  });

  it('compares by value', () => {
    expect(ClientId.fromString('same').equals(ClientId.fromString('same'))).toBe(true);
    expect(ClientId.fromString('same').equals(ClientId.fromString('different'))).toBe(false);
  });
});

describe('UserId', () => {
  it('accepts a non-empty string', () => {
    expect(UserId.fromString('user-123').toString()).toBe('user-123');
  });

  it('rejects an empty or whitespace-only string', () => {
    expect(() => UserId.fromString('')).toThrow(InvalidIdentifierError);
    expect(() => UserId.fromString('   ')).toThrow(InvalidIdentifierError);
  });

  it('compares by value', () => {
    expect(UserId.fromString('same').equals(UserId.fromString('same'))).toBe(true);
    expect(UserId.fromString('same').equals(UserId.fromString('different'))).toBe(false);
  });
});

describe('SubscriptionId', () => {
  it('generates a valid UUIDv7', () => {
    const value = SubscriptionId.generate().toString();
    expect(value).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it('round-trips through fromString', () => {
    const id = SubscriptionId.generate();
    expect(SubscriptionId.fromString(id.toString()).equals(id)).toBe(true);
  });

  it('rejects a non-UUID string', () => {
    expect(() => SubscriptionId.fromString('not-a-uuid')).toThrow(InvalidIdentifierError);
  });
});
