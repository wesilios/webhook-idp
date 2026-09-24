import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import type { InboxRepository, UpsertInboxRecordResult } from '@domain/ports/index.js';
import { InboxRecord } from '@domain/inbox/aggregates/inbox-record.aggregate.js';
import {
  CorrelationId,
  DedupKey,
  EventType,
  InboxRecordId,
  type InboxRecordStatus,
  TenantId,
} from '@domain/inbox/value-objects/index.js';
import { Inbox, type InboxDocument } from './schemas/inbox-record.schema.js';

/** Plain, persistence-shaped view of an `Inbox` document — the shape `toDocument`/`toAggregate` map to/from. */
export interface InboxRecordDoc {
  _id: string;
  dedupKey: string;
  tenantId: string;
  correlationId: string;
  eventType: string;
  payload: Record<string, unknown>;
  receivedAt: Date;
  status: InboxRecordStatus;
}

/**
 * Maps an aggregate to its persisted document shape. Exported (alongside `toAggregate`) so the
 * document<->aggregate mapping can be unit-tested without a real MongoDB connection — same
 * pattern as webhook-api's `SubscriptionMongoRepository`.
 */
export function toDocument(record: InboxRecord): InboxRecordDoc {
  return {
    _id: record.id.toString(),
    dedupKey: record.dedupKey.toString(),
    tenantId: record.tenantId.toString(),
    correlationId: record.correlationId.toString(),
    eventType: record.eventType.toString(),
    payload: record.payload,
    receivedAt: record.receivedAt,
    status: record.status,
  };
}

/** Rehydrates an aggregate from its persisted document shape via `InboxRecord.restore()`. */
export function toAggregate(doc: InboxRecordDoc): InboxRecord {
  return InboxRecord.restore({
    id: InboxRecordId.fromString(doc._id),
    dedupKey: DedupKey.fromString(doc.dedupKey),
    tenantId: TenantId.fromString(doc.tenantId),
    correlationId: CorrelationId.fromString(doc.correlationId),
    eventType: EventType.fromString(doc.eventType),
    payload: doc.payload,
    receivedAt: doc.receivedAt,
    status: doc.status,
  });
}

@Injectable()
export class InboxMongoRepository implements InboxRepository {
  constructor(@InjectModel(Inbox.name) private readonly model: Model<InboxDocument>) {}

  async upsertByDedupKey(record: InboxRecord): Promise<UpsertInboxRecordResult> {
    const doc = toDocument(record);

    // `$setOnInsert`, not a plain replacement update: on a redelivery (matching dedupKey already
    // exists), this must be a true no-op that leaves the original record's `_id`/`receivedAt`
    // untouched — not overwrite them with the redelivered message's values. A plain
    // findOneAndUpdate(filter, doc) would do a full replace on match, which is exactly the
    // "guessing risks double-processing" failure mode this worker exists to prevent.
    const result = await this.model
      .findOneAndUpdate(
        { dedupKey: doc.dedupKey },
        { $setOnInsert: doc },
        { upsert: true, includeResultMetadata: true, setDefaultsOnInsert: true }
      )
      .exec();

    return { inserted: !result.lastErrorObject?.updatedExisting };
  }
}
