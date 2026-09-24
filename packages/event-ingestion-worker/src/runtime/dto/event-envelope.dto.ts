import { IsObject, IsOptional, IsString, IsUUID } from 'class-validator';

/**
 * Boundary shape validation for the broker message body — see the package README's "Event
 * envelope contract". Same relationship as webhook-api's HTTP DTOs (defense-in-depth): the
 * domain value objects (TenantId, EventType, CorrelationId, DedupKey) are still the source of
 * truth for field-level invariants once extracted from this validated shape.
 *
 * `eventId`/`correlationId` are optional here even though the contract lists them as required —
 * IngestEventUseCase has documented fallback behavior for a publisher that omits either one (see
 * `resolveDedupKey`/`resolveCorrelationId`), so this DTO shouldn't hard-reject on their absence.
 */
export class EventEnvelopeDto {
  @IsOptional()
  @IsString()
  eventId?: string;

  @IsOptional()
  @IsUUID()
  correlationId?: string;

  @IsString()
  tenantId!: string;

  @IsString()
  eventType!: string;

  @IsObject()
  payload!: Record<string, unknown>;
}
