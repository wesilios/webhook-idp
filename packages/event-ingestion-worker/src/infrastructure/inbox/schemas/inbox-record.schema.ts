import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes } from 'mongoose';
import type { InboxRecordStatus } from '@domain/inbox/value-objects/inbox-record-status.js';

// `timestamps: false` — `receivedAt` is set by the domain aggregate (`InboxRecord.ingest`), not
// Mongoose's auto-timestamps.
@Schema({ timestamps: false })
export class Inbox {
  // The `InboxRecordId` (UUIDv7) value, stored as the document's own `_id` rather than a
  // Mongo-generated ObjectId — same pattern as webhook-api's `Subscription` schema.
  @Prop({ type: String, required: true })
  _id: string;

  @Prop({ type: String, required: true })
  dedupKey: string;

  @Prop({ type: String, required: true })
  tenantId: string;

  @Prop({ type: String, required: true })
  correlationId: string;

  @Prop({ type: String, required: true })
  eventType: string;

  @Prop({ type: SchemaTypes.Mixed, required: true })
  payload: Record<string, unknown>;

  @Prop({ type: Date, required: true })
  receivedAt: Date;

  @Prop({ type: String, required: true, enum: ['INGESTED'] })
  status: InboxRecordStatus;
}

export type InboxDocument = HydratedDocument<Inbox>;

export const InboxSchema = SchemaFactory.createForClass(Inbox);

// Drives the idempotent upsert (see InboxMongoRepository.upsertByDedupKey) — the one index the
// write path itself depends on.
InboxSchema.index({ dedupKey: 1 }, { unique: true });
// Read-path indexes: not needed by this worker's own write path, but by the Webhook Delivery
// Worker's per-tenant lookups and the future Developer Portal's debugging queries — see the
// README's "Inbox record shape" and Scalability strategy notes.
InboxSchema.index({ tenantId: 1, receivedAt: 1 });
InboxSchema.index({ correlationId: 1 });
