import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { FilterQuery, Model } from 'mongoose';
import type {
  PaginatedResult,
  Pagination,
  SubscriptionListFilters,
  SubscriptionRepository,
} from '@domain/ports/index.js';
import { WebhookSubscription } from '@domain/subscription/aggregates/subscription.aggregate.js';
import {
  ClientId,
  EventType,
  SubscriptionId,
  type SubscriptionStatus,
  TargetUrl,
  TenantId,
  UserId,
} from '@domain/subscription/value-objects/index.js';
import { Subscription, type SubscriptionDocument } from './schemas/subscription.schema.js';

/** Plain, persistence-shaped view of a `Subscription` document — the shape `toDocument`/`toAggregate` map to/from. */
export interface SubscriptionRecord {
  _id: string;
  tenantId: string;
  createdByClientId: string;
  createdByUserId: string | null;
  targetUrl: string;
  subscribedEventTypes: string[];
  status: SubscriptionStatus;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Maps an aggregate to its persisted document shape. Exported (alongside `toAggregate`) so the
 * document<->aggregate mapping can be unit-tested without a real MongoDB connection; this mapping
 * still only lives here — no other file constructs or consumes these shapes.
 */
export function toDocument(subscription: WebhookSubscription): SubscriptionRecord {
  return {
    _id: subscription.id.toString(),
    tenantId: subscription.tenantId.toString(),
    createdByClientId: subscription.createdByClientId.toString(),
    createdByUserId: subscription.createdByUserId ? subscription.createdByUserId.toString() : null,
    targetUrl: subscription.targetUrl.toString(),
    subscribedEventTypes: subscription.subscribedEventTypes.map((eventType) => eventType.toString()),
    status: subscription.status,
    createdAt: subscription.createdAt,
    updatedAt: subscription.updatedAt,
  };
}

/** Rehydrates an aggregate from its persisted document shape via `WebhookSubscription.restore()`. */
export function toAggregate(record: SubscriptionRecord): WebhookSubscription {
  return WebhookSubscription.restore({
    id: SubscriptionId.fromString(record._id),
    tenantId: TenantId.fromString(record.tenantId),
    createdByClientId: ClientId.fromString(record.createdByClientId),
    createdByUserId: record.createdByUserId === null ? null : UserId.fromString(record.createdByUserId),
    targetUrl: TargetUrl.fromString(record.targetUrl),
    subscribedEventTypes: record.subscribedEventTypes.map((eventType) => EventType.fromString(eventType)),
    status: record.status,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  });
}

@Injectable()
export class SubscriptionMongoRepository implements SubscriptionRepository {
  constructor(@InjectModel(Subscription.name) private readonly model: Model<SubscriptionDocument>) {}

  async save(subscription: WebhookSubscription): Promise<void> {
    const record = toDocument(subscription);
    await this.model.findOneAndUpdate({ _id: record._id }, record, { upsert: true }).exec();
  }

  async findByIdAndTenant(id: SubscriptionId, tenantId: TenantId): Promise<WebhookSubscription | null> {
    const record = await this.model
      .findOne({ _id: id.toString(), tenantId: tenantId.toString() })
      .lean<SubscriptionRecord>()
      .exec();
    return record ? toAggregate(record) : null;
  }

  async findByTenantAndTargetUrl(tenantId: TenantId, targetUrl: TargetUrl): Promise<WebhookSubscription | null> {
    const record = await this.model
      .findOne({ tenantId: tenantId.toString(), targetUrl: targetUrl.toString() })
      .lean<SubscriptionRecord>()
      .exec();
    return record ? toAggregate(record) : null;
  }

  async list(
    tenantId: TenantId,
    filters: SubscriptionListFilters,
    pagination: Pagination
  ): Promise<PaginatedResult<WebhookSubscription>> {
    const query: FilterQuery<SubscriptionDocument> = { tenantId: tenantId.toString() };
    if (filters.status) {
      query.status = filters.status;
    }
    if (filters.eventType) {
      query.subscribedEventTypes = filters.eventType.toString();
    }

    const skip = (pagination.page - 1) * pagination.pageSize;
    const [records, total] = await Promise.all([
      this.model.find(query).skip(skip).limit(pagination.pageSize).lean<SubscriptionRecord[]>().exec(),
      this.model.countDocuments(query).exec(),
    ]);

    return {
      items: records.map((record) => toAggregate(record)),
      page: pagination.page,
      pageSize: pagination.pageSize,
      total,
    };
  }
}
