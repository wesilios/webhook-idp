import { Exclude } from 'class-transformer';
import { IsObject, IsOptional, IsString, IsUUID } from 'class-validator';

/**
 * Mirrors event-ingestion-worker's `EventEnvelopeDto` field-for-field. `eventId` is excluded from
 * the request body entirely — `RabbitMqBrokerPublisherAdapter` always generates it, scoped by
 * `APPLICATION_NAME`, so it's never client-supplied. `correlationId` stays optional and, when
 * omitted, is backfilled by `CorrelationIdInterceptor` before validation runs — see this
 * package's README, "Current state".
 */
export class CreateEventDto {
  @Exclude()
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
