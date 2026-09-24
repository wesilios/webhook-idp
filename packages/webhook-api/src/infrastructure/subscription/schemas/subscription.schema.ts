import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import type { SubscriptionStatus } from '@domain/subscription/value-objects/subscription-status.js';

// `timestamps: false` — `createdAt`/`updatedAt` are managed by the domain aggregate
// (`WebhookSubscription.create`/`.restore`), not Mongoose's auto-timestamps.
@Schema({ timestamps: false })
export class Subscription {
  // The `SubscriptionId` (UUIDv7) value, stored as the document's own `_id` rather than a
  // Mongo-generated ObjectId.
  @Prop({ type: String, required: true })
  _id: string;

  @Prop({ type: String, required: true })
  tenantId: string;

  @Prop({ type: String, required: true })
  createdByClientId: string;

  @Prop({ type: String, required: false, default: null })
  createdByUserId: string | null;

  @Prop({ type: String, required: true })
  targetUrl: string;

  @Prop({ type: [String], required: true })
  subscribedEventTypes: string[];

  @Prop({ type: String, required: true, enum: ['ACTIVE', 'PAUSED', 'DELETED'] })
  status: SubscriptionStatus;

  @Prop({ type: Date, required: true })
  createdAt: Date;

  @Prop({ type: Date, required: true })
  updatedAt: Date;
}

export type SubscriptionDocument = HydratedDocument<Subscription>;

export const SubscriptionSchema = SchemaFactory.createForClass(Subscription);

// Duplicate-check invariant the application layer queries by (see CreateSubscriptionUseCase).
SubscriptionSchema.index({ tenantId: 1, targetUrl: 1 }, { unique: true });
// List/filter use-case scopes by tenant and filters by status.
SubscriptionSchema.index({ tenantId: 1, status: 1 });
