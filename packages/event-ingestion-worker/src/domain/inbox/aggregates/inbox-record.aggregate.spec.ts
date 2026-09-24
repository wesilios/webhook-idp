import type { Clock } from '../../ports/clock.port.js';
import { InvalidPayloadError } from '../inbox.errors.js';
import { CorrelationId, DedupKey, EventType, InboxRecordId, TenantId } from '../value-objects/index.js';
import { InboxRecord } from './inbox-record.aggregate.js';

class FixedClock implements Clock {
  constructor(private readonly current: Date) {}

  now(): Date {
    return this.current;
  }
}

function ingestParams(overrides: Partial<Parameters<typeof InboxRecord.ingest>[0]> = {}) {
  return {
    dedupKey: DedupKey.fromString('dedup-1'),
    tenantId: TenantId.fromString('tenant-1'),
    correlationId: CorrelationId.fromString('corr-1'),
    eventType: EventType.fromString('order.created'),
    payload: { orderId: 'order-1' },
    ...overrides,
  };
}

describe('InboxRecord', () => {
  describe('ingest', () => {
    it('builds a new INGESTED record stamped with the clock time', () => {
      const clock = new FixedClock(new Date('2026-01-01T00:00:00.000Z'));

      const record = InboxRecord.ingest(ingestParams(), clock);

      expect(record.status).toBe('INGESTED');
      expect(record.receivedAt).toEqual(new Date('2026-01-01T00:00:00.000Z'));
      expect(record.dedupKey.toString()).toBe('dedup-1');
      expect(record.tenantId.toString()).toBe('tenant-1');
      expect(record.correlationId.toString()).toBe('corr-1');
      expect(record.eventType.toString()).toBe('order.created');
      expect(record.payload).toEqual({ orderId: 'order-1' });
      expect(record.id).toBeInstanceOf(InboxRecordId);
    });

    it('generates a fresh id on every call', () => {
      const clock = new FixedClock(new Date());
      const a = InboxRecord.ingest(ingestParams(), clock);
      const b = InboxRecord.ingest(ingestParams(), clock);
      expect(a.id.equals(b.id)).toBe(false);
    });

    it('rejects a null payload', () => {
      const clock = new FixedClock(new Date());
      expect(() => InboxRecord.ingest(ingestParams({ payload: null as never }), clock)).toThrow(InvalidPayloadError);
    });

    it('rejects an array payload', () => {
      const clock = new FixedClock(new Date());
      expect(() => InboxRecord.ingest(ingestParams({ payload: [] as never }), clock)).toThrow(InvalidPayloadError);
    });

    it('accepts an empty object payload', () => {
      const clock = new FixedClock(new Date());
      expect(() => InboxRecord.ingest(ingestParams({ payload: {} }), clock)).not.toThrow();
    });
  });

  describe('restore', () => {
    it('rehydrates a record from persisted state as-is', () => {
      const original = InboxRecord.ingest(ingestParams(), new FixedClock(new Date('2026-01-01T00:00:00.000Z')));

      const restored = InboxRecord.restore({
        id: original.id,
        dedupKey: original.dedupKey,
        tenantId: original.tenantId,
        correlationId: original.correlationId,
        eventType: original.eventType,
        payload: original.payload,
        receivedAt: original.receivedAt,
        status: original.status,
      });

      expect(restored.id.equals(original.id)).toBe(true);
      expect(restored.dedupKey.equals(original.dedupKey)).toBe(true);
      expect(restored.status).toBe('INGESTED');
      expect(restored.receivedAt).toEqual(original.receivedAt);
    });
  });
});
