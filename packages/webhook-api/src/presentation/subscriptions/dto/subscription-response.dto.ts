import { ApiProperty } from '@nestjs/swagger';
import type { PaginatedResult } from '@domain/ports/subscription-repository.port.js';
import type { WebhookSubscription } from '@domain/subscription/aggregates/subscription.aggregate.js';

/**
 * Outbound shape for a single subscription — PascalCase, per the response-envelope contract
 * (README "Response envelope"). Use-cases return the `WebhookSubscription` aggregate directly;
 * mapping to this shape happens here, at the presentation boundary, never inside the aggregate.
 * A class (not an interface) so the `@nestjs/swagger` CLI plugin can generate its schema —
 * decorators/metadata reflection only work on classes. `toSubscriptionResponseDto` below still
 * just returns a plain object literal; structurally it satisfies this class's shape fine.
 */
export class SubscriptionResponseDto {
  @ApiProperty({ description: 'Subscription id (UUIDv7)' })
  Id!: string;

  @ApiProperty({
    description:
      'The subscription’s webhook destination, with its hostname masked for display (TargetUrlMaskingInterceptor) — the real URL is unchanged in storage and in every internal use-case/repository call, only this API response is redacted.',
  })
  TargetUrl!: string;

  @ApiProperty({ type: [String] })
  EventTypes!: string[];

  @ApiProperty({ enum: ['ACTIVE', 'PAUSED', 'DELETED'] })
  Status!: string;

  @ApiProperty({ format: 'date-time' })
  CreatedAt!: string;

  @ApiProperty({ format: 'date-time' })
  UpdatedAt!: string;
}

export function toSubscriptionResponseDto(subscription: WebhookSubscription): SubscriptionResponseDto {
  return {
    Id: subscription.id.toString(),
    TargetUrl: subscription.targetUrl.toString(),
    EventTypes: subscription.subscribedEventTypes.map((eventType) => eventType.toString()),
    Status: subscription.status,
    CreatedAt: subscription.createdAt.toISOString(),
    UpdatedAt: subscription.updatedAt.toISOString(),
  };
}

export class PaginatedSubscriptionsResponseDto {
  @ApiProperty({ type: [SubscriptionResponseDto] })
  Items!: SubscriptionResponseDto[];

  @ApiProperty()
  Page!: number;

  @ApiProperty()
  PageSize!: number;

  @ApiProperty()
  Total!: number;
}

export function toPaginatedSubscriptionsResponseDto(
  result: PaginatedResult<WebhookSubscription>
): PaginatedSubscriptionsResponseDto {
  return {
    Items: result.items.map(toSubscriptionResponseDto),
    Page: result.page,
    PageSize: result.pageSize,
    Total: result.total,
  };
}
