import { InvalidIdentifierError } from '../inbox.errors.js';
import { CorrelationId } from './correlation-id.vo.js';
import { DedupKey } from './dedup-key.vo.js';
import { InboxRecordId } from './inbox-record-id.vo.js';
import { TenantId } from './tenant-id.vo.js';

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

describe('CorrelationId', () => {
  it('accepts a non-empty string', () => {
    expect(CorrelationId.fromString('corr-123').toString()).toBe('corr-123');
  });

  it('rejects an empty or whitespace-only string', () => {
    expect(() => CorrelationId.fromString('')).toThrow(InvalidIdentifierError);
    expect(() => CorrelationId.fromString('   ')).toThrow(InvalidIdentifierError);
  });

  it('compares by value', () => {
    expect(CorrelationId.fromString('same').equals(CorrelationId.fromString('same'))).toBe(true);
    expect(CorrelationId.fromString('same').equals(CorrelationId.fromString('different'))).toBe(false);
  });
});

describe('DedupKey', () => {
  it('accepts a non-empty string, UUID or not (broker message ids are not always UUIDs)', () => {
    expect(DedupKey.fromString('018f5b3e-9c1a-7c3e-8f3a-6b6b6b6b6b6b').toString()).toBe(
      '018f5b3e-9c1a-7c3e-8f3a-6b6b6b6b6b6b'
    );
    expect(DedupKey.fromString('rabbitmq-message-id-42').toString()).toBe('rabbitmq-message-id-42');
  });

  it('rejects an empty or whitespace-only string', () => {
    expect(() => DedupKey.fromString('')).toThrow(InvalidIdentifierError);
    expect(() => DedupKey.fromString('   ')).toThrow(InvalidIdentifierError);
  });

  it('compares by value', () => {
    expect(DedupKey.fromString('same').equals(DedupKey.fromString('same'))).toBe(true);
    expect(DedupKey.fromString('same').equals(DedupKey.fromString('different'))).toBe(false);
  });
});

describe('InboxRecordId', () => {
  it('generates a valid UUIDv7', () => {
    const value = InboxRecordId.generate().toString();
    expect(value).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it('round-trips through fromString', () => {
    const id = InboxRecordId.generate();
    expect(InboxRecordId.fromString(id.toString()).equals(id)).toBe(true);
  });

  it('rejects a non-UUID string', () => {
    expect(() => InboxRecordId.fromString('not-a-uuid')).toThrow(InvalidIdentifierError);
  });
});
