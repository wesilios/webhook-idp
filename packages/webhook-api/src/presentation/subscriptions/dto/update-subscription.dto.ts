import { ArrayNotEmpty, IsArray, IsIn, IsOptional, IsString } from 'class-validator';
import type { SubscriptionStatus } from '@domain/subscription/value-objects/index.js';

/**
 * PATCH semantics — every field is optional, only the fields present in the body are applied.
 * Shape validation only (defense-in-depth); domain VOs/aggregate methods re-validate and are
 * the source of truth for the real invariants, including which status transitions are legal.
 */
export class UpdateSubscriptionDto {
  @IsOptional()
  @IsString()
  targetUrl?: string;

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  eventTypes?: string[];

  @IsOptional()
  @IsIn(['ACTIVE', 'PAUSED', 'DELETED'])
  status?: SubscriptionStatus;
}
