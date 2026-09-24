import type { Clock } from '@domain/ports/index.js';
import { InboxRecord } from '@domain/inbox/aggregates/inbox-record.aggregate.js';
import { CorrelationId, DedupKey, EventType, TenantId } from '@domain/inbox/value-objects/index.js';
import { InboxMongoRepository, toAggregate, toDocument } from './inbox-mongo.repository.js';

class FixedClock implements Clock {
  constructor(private readonly current: Date) {}

  now(): Date {
    return this.current;
  }
}

function createRecord() {
  return InboxRecord.ingest(
    {
      dedupKey: DedupKey.fromString('dedup-1'),
      tenantId: TenantId.fromString('tenant-1'),
      correlationId: CorrelationId.fromString('corr-1'),
      eventType: EventType.fromString('order.created'),
      payload: { orderId: 'order-1' },
    },
    new FixedClock(new Date('2026-01-01T00:00:00.000Z'))
  );
}

describe('inbox-mongo.repository mapping', () => {
  describe('toDocument', () => {
    it('maps aggregate fields to primitive document fields', () => {
      const record = createRecord();

      const doc = toDocument(record);

      expect(doc).toEqual({
        _id: record.id.toString(),
        dedupKey: 'dedup-1',
        tenantId: 'tenant-1',
        correlationId: 'corr-1',
        eventType: 'order.created',
        payload: { orderId: 'order-1' },
        receivedAt: record.receivedAt,
        status: 'INGESTED',
      });
    });
  });

  describe('toAggregate', () => {
    it('rehydrates a record equivalent to the one that produced the document', () => {
      const original = createRecord();
      const doc = toDocument(original);

      const restored = toAggregate(doc);

      expect(restored.id.equals(original.id)).toBe(true);
      expect(restored.dedupKey.equals(original.dedupKey)).toBe(true);
      expect(restored.tenantId.equals(original.tenantId)).toBe(true);
      expect(restored.correlationId.equals(original.correlationId)).toBe(true);
      expect(restored.eventType.equals(original.eventType)).toBe(true);
      expect(restored.payload).toEqual(original.payload);
      expect(restored.receivedAt).toEqual(original.receivedAt);
      expect(restored.status).toBe(original.status);
    });
  });
});

/** Chainable Mongoose query stub — `.exec()` resolves `result`, matching `SubscriptionMongoRepository`'s test pattern. */
class QueryStub<T> {
  constructor(private readonly result: T) {}
  exec(): Promise<T> {
    return Promise.resolve(this.result);
  }
}

/** Mongoose `Model`-shaped mock — only the method `InboxMongoRepository` actually calls. */
function createModelMock(result: unknown) {
  return {
    findOneAndUpdate: vi.fn().mockReturnValue(new QueryStub(result)),
  };
}

describe('InboxMongoRepository', () => {
  describe('upsertByDedupKey', () => {
    it('upserts via $setOnInsert (never a plain replace) and reports inserted: true for a brand-new record', async () => {
      const record = createRecord();
      const model = createModelMock({ value: null, lastErrorObject: { updatedExisting: false }, ok: 1 });
      const repository = new InboxMongoRepository(model as never);

      const result = await repository.upsertByDedupKey(record);

      expect(result.inserted).toBe(true);
      expect(model.findOneAndUpdate).toHaveBeenCalledWith(
        { dedupKey: 'dedup-1' },
        { $setOnInsert: toDocument(record) },
        { upsert: true, includeResultMetadata: true, setDefaultsOnInsert: true }
      );
    });

    it('reports inserted: false when a record with the same dedupKey already existed (idempotent no-op)', async () => {
      const record = createRecord();
      const model = createModelMock({ value: {}, lastErrorObject: { updatedExisting: true }, ok: 1 });
      const repository = new InboxMongoRepository(model as never);

      const result = await repository.upsertByDedupKey(record);

      expect(result.inserted).toBe(false);
    });

    it('treats a missing lastErrorObject as inserted (defensive default)', async () => {
      const record = createRecord();
      const model = createModelMock({ value: null, ok: 1 });
      const repository = new InboxMongoRepository(model as never);

      const result = await repository.upsertByDedupKey(record);

      expect(result.inserted).toBe(true);
    });
  });
});
