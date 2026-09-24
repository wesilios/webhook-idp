import type { Clock } from '@domain/ports/index.js';
import { WebhookSubscription } from '@domain/subscription/aggregates/subscription.aggregate.js';
import {
  ClientId,
  EventType,
  SubscriptionId,
  TargetUrl,
  TenantId,
  UserId,
} from '@domain/subscription/value-objects/index.js';
import {
  SubscriptionMongoRepository,
  toAggregate,
  toDocument,
  type SubscriptionRecord,
} from './subscription-mongo.repository.js';

class FixedClock implements Clock {
  constructor(private readonly current: Date) {}

  now(): Date {
    return this.current;
  }
}

function createSubscription(createdByUserId: UserId | null = null) {
  const clock = new FixedClock(new Date('2026-01-01T00:00:00.000Z'));
  return WebhookSubscription.create(
    {
      tenantId: TenantId.fromString('tenant-1'),
      createdByClientId: ClientId.fromString('client-1'),
      createdByUserId,
      targetUrl: TargetUrl.fromString('https://client.example.com/webhooks/inbound'),
      subscribedEventTypes: [EventType.fromString('order.created'), EventType.fromString('order.shipped')],
    },
    clock
  );
}

describe('subscription-mongo.repository mapping', () => {
  describe('toDocument', () => {
    it('maps aggregate fields to primitive document fields', () => {
      const subscription = createSubscription(UserId.fromString('user-1'));

      const record = toDocument(subscription);

      expect(record).toEqual({
        _id: subscription.id.toString(),
        tenantId: 'tenant-1',
        createdByClientId: 'client-1',
        createdByUserId: 'user-1',
        targetUrl: 'https://client.example.com/webhooks/inbound',
        subscribedEventTypes: ['order.created', 'order.shipped'],
        status: 'ACTIVE',
        createdAt: subscription.createdAt,
        updatedAt: subscription.updatedAt,
      });
    });

    it('maps a null createdByUserId to null (not undefined)', () => {
      const subscription = createSubscription(null);

      const record = toDocument(subscription);

      expect(record.createdByUserId).toBeNull();
    });
  });

  describe('toAggregate', () => {
    it('rehydrates an aggregate equivalent to the one that produced the document', () => {
      const original = createSubscription(UserId.fromString('user-1'));
      const record = toDocument(original);

      const restored = toAggregate(record);

      expect(restored.id.equals(original.id)).toBe(true);
      expect(restored.tenantId.equals(original.tenantId)).toBe(true);
      expect(restored.createdByClientId.equals(original.createdByClientId)).toBe(true);
      expect(restored.createdByUserId?.equals(original.createdByUserId!)).toBe(true);
      expect(restored.targetUrl.equals(original.targetUrl)).toBe(true);
      expect(restored.subscribedEventTypes.map((e) => e.toString())).toEqual(
        original.subscribedEventTypes.map((e) => e.toString())
      );
      expect(restored.status).toBe(original.status);
      expect(restored.createdAt).toEqual(original.createdAt);
      expect(restored.updatedAt).toEqual(original.updatedAt);
      // restore() must not re-emit domain events
      expect(restored.pullDomainEvents()).toHaveLength(0);
    });

    it('rehydrates a null createdByUserId as null', () => {
      const record: SubscriptionRecord = {
        _id: '018f5b3e-9c1a-7c3e-8f3a-6b6b6b6b6b6b',
        tenantId: 'tenant-1',
        createdByClientId: 'client-1',
        createdByUserId: null,
        targetUrl: 'https://client.example.com/webhooks/inbound',
        subscribedEventTypes: ['order.created'],
        status: 'PAUSED',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-02T00:00:00.000Z'),
      };

      const restored = toAggregate(record);

      expect(restored.createdByUserId).toBeNull();
      expect(restored.status).toBe('PAUSED');
    });
  });
});

/** Chainable Mongoose query stub — `.skip()/.limit()/.lean()` are no-ops, `.exec()` resolves `result`. */
class QueryStub<T> {
  constructor(private readonly result: T) {}
  skip(): this {
    return this;
  }
  limit(): this {
    return this;
  }
  lean(): this {
    return this;
  }
  exec(): Promise<T> {
    return Promise.resolve(this.result);
  }
}

function buildRecord(overrides: Partial<SubscriptionRecord> = {}): SubscriptionRecord {
  return {
    _id: '018f5b3e-9c1a-7c3e-8f3a-6b6b6b6b6b6b',
    tenantId: 'tenant-1',
    createdByClientId: 'client-1',
    createdByUserId: null,
    targetUrl: 'https://client.example.com/webhooks/inbound',
    subscribedEventTypes: ['order.created'],
    status: 'ACTIVE',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

/** Mongoose `Model`-shaped mock — only the methods `SubscriptionMongoRepository` actually calls. */
function createModelMock() {
  return {
    findOneAndUpdate: vi.fn().mockReturnValue(new QueryStub(undefined)),
    findOne: vi.fn().mockReturnValue(new QueryStub(null)),
    find: vi.fn().mockReturnValue(new QueryStub([])),
    countDocuments: vi.fn().mockReturnValue(new QueryStub(0)),
  };
}

describe('SubscriptionMongoRepository', () => {
  describe('save', () => {
    it('upserts by _id with the mapped document', async () => {
      const model = createModelMock();
      const repository = new SubscriptionMongoRepository(model as never);
      const subscription = createSubscription(UserId.fromString('user-1'));

      await repository.save(subscription);

      expect(model.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: subscription.id.toString() },
        toDocument(subscription),
        { upsert: true }
      );
    });
  });

  describe('findByIdAndTenant', () => {
    it('queries by _id and tenantId, and rehydrates the found record', async () => {
      const model = createModelMock();
      const record = buildRecord();
      model.findOne.mockReturnValue(new QueryStub(record));
      const repository = new SubscriptionMongoRepository(model as never);

      const found = await repository.findByIdAndTenant(
        SubscriptionId.fromString(record._id),
        TenantId.fromString(record.tenantId)
      );

      expect(model.findOne).toHaveBeenCalledWith({ _id: record._id, tenantId: record.tenantId });
      expect(found?.id.toString()).toBe(record._id);
    });

    it('returns null when no document matches', async () => {
      const model = createModelMock();
      const repository = new SubscriptionMongoRepository(model as never);

      const found = await repository.findByIdAndTenant(
        SubscriptionId.fromString('018f5b3e-9c1a-7c3e-8f3a-6b6b6b6b6b6b'),
        TenantId.fromString('tenant-1')
      );

      expect(found).toBeNull();
    });
  });

  describe('findByTenantAndTargetUrl', () => {
    it('queries by tenantId and targetUrl, and rehydrates the found record', async () => {
      const model = createModelMock();
      const record = buildRecord();
      model.findOne.mockReturnValue(new QueryStub(record));
      const repository = new SubscriptionMongoRepository(model as never);

      const found = await repository.findByTenantAndTargetUrl(
        TenantId.fromString(record.tenantId),
        TargetUrl.fromString(record.targetUrl)
      );

      expect(model.findOne).toHaveBeenCalledWith({ tenantId: record.tenantId, targetUrl: record.targetUrl });
      expect(found?.targetUrl.toString()).toBe(record.targetUrl);
    });

    it('returns null when no document matches', async () => {
      const model = createModelMock();
      const repository = new SubscriptionMongoRepository(model as never);

      const found = await repository.findByTenantAndTargetUrl(
        TenantId.fromString('tenant-1'),
        TargetUrl.fromString('https://nowhere.example.com/hook')
      );

      expect(found).toBeNull();
    });
  });

  describe('list', () => {
    it('scopes the query to tenantId only when no filters are given', async () => {
      const model = createModelMock();
      const repository = new SubscriptionMongoRepository(model as never);

      await repository.list(TenantId.fromString('tenant-1'), {}, { page: 1, pageSize: 20 });

      expect(model.find).toHaveBeenCalledWith({ tenantId: 'tenant-1' });
    });

    it('adds a status filter to the query when provided', async () => {
      const model = createModelMock();
      const repository = new SubscriptionMongoRepository(model as never);

      await repository.list(TenantId.fromString('tenant-1'), { status: 'PAUSED' }, { page: 1, pageSize: 20 });

      expect(model.find).toHaveBeenCalledWith({ tenantId: 'tenant-1', status: 'PAUSED' });
    });

    it('adds an eventType filter (by its string value) to the query when provided', async () => {
      const model = createModelMock();
      const repository = new SubscriptionMongoRepository(model as never);

      await repository.list(
        TenantId.fromString('tenant-1'),
        { eventType: EventType.fromString('order.shipped') },
        { page: 1, pageSize: 20 }
      );

      expect(model.find).toHaveBeenCalledWith({ tenantId: 'tenant-1', subscribedEventTypes: 'order.shipped' });
    });

    it('computes skip from (page - 1) * pageSize and passes pageSize as limit', async () => {
      const model = createModelMock();
      const skip = vi.fn().mockReturnThis();
      const limit = vi.fn().mockReturnThis();
      model.find.mockReturnValue({ skip, limit, lean: () => ({ exec: () => Promise.resolve([]) }) } as never);
      const repository = new SubscriptionMongoRepository(model as never);

      await repository.list(TenantId.fromString('tenant-1'), {}, { page: 3, pageSize: 10 });

      expect(skip).toHaveBeenCalledWith(20);
      expect(limit).toHaveBeenCalledWith(10);
    });

    it('assembles the paginated result from the found records and the total count', async () => {
      const model = createModelMock();
      const idA = SubscriptionId.generate().toString();
      const idB = SubscriptionId.generate().toString();
      const records = [buildRecord({ _id: idA }), buildRecord({ _id: idB })];
      model.find.mockReturnValue(new QueryStub(records));
      model.countDocuments.mockReturnValue(new QueryStub(5));
      const repository = new SubscriptionMongoRepository(model as never);

      const result = await repository.list(TenantId.fromString('tenant-1'), {}, { page: 2, pageSize: 2 });

      expect(result.items.map((item) => item.id.toString())).toEqual([idA, idB]);
      expect(result.page).toBe(2);
      expect(result.pageSize).toBe(2);
      expect(result.total).toBe(5);
    });
  });
});
