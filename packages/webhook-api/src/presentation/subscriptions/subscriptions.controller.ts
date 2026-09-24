import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  CreateSubscriptionUseCase,
  DeleteSubscriptionUseCase,
  GetSubscriptionUseCase,
  ListSubscriptionsUseCase,
  UpdateSubscriptionUseCase,
} from '@application/use-cases/index.js';
import { EventType } from '@domain/subscription/value-objects/index.js';
import { CurrentIdentity } from '../common/decorators/current-identity.decorator.js';
import { Pagination } from '../common/decorators/pagination.decorator.js';
import { IdentityGuard } from '../common/guards/identity.guard.js';
import type { ResolvedIdentity } from '../common/guards/identity.guard.js';
import { PaginationInterceptor, type ResolvedPagination } from '../common/interceptors/pagination.interceptor.js';
import { TargetUrlMaskingInterceptor } from '../common/interceptors/target-url-masking.interceptor.js';
import { ApiEnvelopedResponse } from '../common/swagger/api-enveloped-response.decorator.js';
import {
  CreateSubscriptionDto,
  ListSubscriptionsQueryDto,
  PaginatedSubscriptionsResponseDto,
  SubscriptionResponseDto,
  toPaginatedSubscriptionsResponseDto,
  toSubscriptionResponseDto,
  UpdateSubscriptionDto,
} from './dto/index.js';

/**
 * `api/v1` prefix is applied globally in `main.ts` (`app.setGlobalPrefix`) — not repeated here.
 * Handlers return plain data; the global `EnvelopeInterceptor` wraps it into `ApiEnvelope`, and
 * the global `DomainExceptionFilter` maps thrown `DomainError`/`ApplicationError`s to the error
 * envelope — no try/catch or hand-rolled response shaping here.
 *
 * Auth headers documented here at the controller level (`@ApiHeader`) since `IdentityGuard`
 * applies to every route below — see `identity.md` for the header-to-claim mapping and why these
 * are headers rather than a verified Bearer JWT (documented stand-in, see package README).
 *
 * `TargetUrlMaskingInterceptor` is applied here at the controller level (every route below
 * returns a subscription, directly or via the paginated list) — display-only redaction of the
 * hostname, the real URL is untouched in the database and in every internal use-case/repository
 * call; only the JSON returned to the caller is masked.
 */
@ApiTags('subscriptions')
@ApiHeader({ name: 'x-tenant-id', required: true, description: 'Caller tenant id' })
@ApiHeader({ name: 'x-client-id', required: true, description: 'Caller OAuth client id (audit metadata only)' })
@ApiHeader({ name: 'x-user-id', required: false, description: 'Caller user id — absent on machine-to-machine calls' })
@ApiResponse({ status: 401, description: 'Missing "x-tenant-id" or "x-client-id" header' })
@Controller('subscriptions')
@UseGuards(IdentityGuard)
@UseInterceptors(TargetUrlMaskingInterceptor)
export class SubscriptionsController {
  constructor(
    private readonly createSubscription: CreateSubscriptionUseCase,
    private readonly listSubscriptions: ListSubscriptionsUseCase,
    private readonly getSubscription: GetSubscriptionUseCase,
    private readonly updateSubscription: UpdateSubscriptionUseCase,
    private readonly deleteSubscription: DeleteSubscriptionUseCase
  ) {}

  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Create a subscription' })
  @ApiEnvelopedResponse(SubscriptionResponseDto, 201)
  @ApiResponse({ status: 400, description: 'Invalid targetUrl/eventTypes' })
  @ApiResponse({ status: 409, description: 'A subscription for this tenant + targetUrl already exists' })
  async create(
    @CurrentIdentity() identity: ResolvedIdentity,
    @Body() body: CreateSubscriptionDto
  ): Promise<SubscriptionResponseDto> {
    const subscription = await this.createSubscription.execute({
      tenantId: identity.tenantId,
      createdByClientId: identity.clientId,
      createdByUserId: identity.userId,
      targetUrl: body.targetUrl,
      eventTypes: body.eventTypes,
    });

    return toSubscriptionResponseDto(subscription);
  }

  @Get()
  @UseInterceptors(PaginationInterceptor)
  @ApiOperation({ summary: "List the caller's tenant's subscriptions" })
  @ApiQuery({ name: 'status', required: false, enum: ['ACTIVE', 'PAUSED', 'DELETED'] })
  @ApiQuery({ name: 'eventType', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Default 1' })
  @ApiQuery({ name: 'pageSize', required: false, type: Number, description: 'Default 20' })
  @ApiEnvelopedResponse(PaginatedSubscriptionsResponseDto, 200)
  @ApiResponse({ status: 400, description: '"page"/"pageSize" must be a positive integer' })
  async list(
    @CurrentIdentity() identity: ResolvedIdentity,
    @Query() query: ListSubscriptionsQueryDto,
    @Pagination() pagination: ResolvedPagination
  ): Promise<PaginatedSubscriptionsResponseDto> {
    const result = await this.listSubscriptions.execute({
      tenantId: identity.tenantId,
      filters: {
        status: query.status,
        eventType: query.eventType === undefined ? undefined : EventType.fromString(query.eventType),
      },
      pagination,
    });

    return toPaginatedSubscriptionsResponseDto(result);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one subscription' })
  @ApiParam({ name: 'id', description: 'Subscription id (UUIDv7)' })
  @ApiEnvelopedResponse(SubscriptionResponseDto, 200)
  @ApiResponse({ status: 404, description: 'Not found, or belongs to a different tenant' })
  async getById(
    @CurrentIdentity() identity: ResolvedIdentity,
    @Param('id') id: string
  ): Promise<SubscriptionResponseDto> {
    const subscription = await this.getSubscription.execute({ id, tenantId: identity.tenantId });
    return toSubscriptionResponseDto(subscription);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update eventTypes, targetUrl, and/or status' })
  @ApiParam({ name: 'id', description: 'Subscription id (UUIDv7)' })
  @ApiEnvelopedResponse(SubscriptionResponseDto, 200)
  @ApiResponse({ status: 400, description: 'Invalid targetUrl/eventTypes' })
  @ApiResponse({ status: 404, description: 'Not found, or belongs to a different tenant' })
  @ApiResponse({ status: 409, description: 'Invalid status transition' })
  async update(
    @CurrentIdentity() identity: ResolvedIdentity,
    @Param('id') id: string,
    @Body() body: UpdateSubscriptionDto
  ): Promise<SubscriptionResponseDto> {
    const subscription = await this.updateSubscription.execute({
      id,
      tenantId: identity.tenantId,
      targetUrl: body.targetUrl,
      eventTypes: body.eventTypes,
      status: body.status,
    });

    return toSubscriptionResponseDto(subscription);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft-delete a subscription (idempotent)' })
  @ApiParam({ name: 'id', description: 'Subscription id (UUIDv7)' })
  @ApiEnvelopedResponse(SubscriptionResponseDto, 200)
  @ApiResponse({ status: 404, description: 'Not found, or belongs to a different tenant' })
  async delete(
    @CurrentIdentity() identity: ResolvedIdentity,
    @Param('id') id: string
  ): Promise<SubscriptionResponseDto> {
    // Idempotent: `DeleteSubscriptionUseCase`/`WebhookSubscription.delete()` no-op when already DELETED.
    const subscription = await this.deleteSubscription.execute({ id, tenantId: identity.tenantId });
    return toSubscriptionResponseDto(subscription);
  }
}
