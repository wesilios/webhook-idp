import { randomUUID } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Clock, InboxRepository } from '@domain/ports/index.js';
import { CLOCK, INBOX_REPOSITORY } from '@domain/ports/index.js';
import { InboxRecord } from '@domain/inbox/aggregates/inbox-record.aggregate.js';
import { CorrelationId, DedupKey, EventType, TenantId } from '@domain/inbox/value-objects/index.js';
import { UnresolvableDedupKeyError } from '../errors/unresolvable-dedup-key.error.js';

/**
 * Plain, boundary-validated input — deliberately not the `EventEnvelopeDto` class. Same relation
 * as webhook-api's `CreateSubscriptionInput`: shape validation (decorators) is a runtime/
 * concern, this use-case only depends on primitives, never a `runtime/`-layer type.
 */
export interface IngestEventInput {
  eventId: string | null;
  correlationId: string | null;
  tenantId: string;
  eventType: string;
  payload: Record<string, unknown>;
  brokerMessageId: string | null;
}

export interface IngestEventResult {
  dedupKey: string;
  /** True if this call durably persisted a new Inbox record; false if it was a redelivery of an
   * already-ingested event (idempotent no-op) — see the README's "Idempotent ingestion" note. */
  inserted: boolean;
}

@Injectable()
export class IngestEventUseCase {
  private readonly logger = new Logger(IngestEventUseCase.name);

  constructor(
    @Inject(INBOX_REPOSITORY) private readonly inboxRepository: InboxRepository,
    @Inject(CLOCK) private readonly clock: Clock
  ) {}

  async execute(input: IngestEventInput): Promise<IngestEventResult> {
    const dedupKey = resolveDedupKey(input.eventId, input.brokerMessageId);
    const correlationId = resolveCorrelationId(input.correlationId, this.logger);

    const record = InboxRecord.ingest(
      {
        dedupKey,
        correlationId,
        tenantId: TenantId.fromString(input.tenantId),
        eventType: EventType.fromString(input.eventType),
        payload: input.payload,
      },
      this.clock
    );

    const { inserted } = await this.inboxRepository.upsertByDedupKey(record);

    return { dedupKey: dedupKey.toString(), inserted };
  }
}

/** Prefers the envelope's own `eventId` (publisher-assigned, unique per occurrence) over the
 * broker-native message id, and rejects outright if neither is present — see the README's
 * "Dedup key choice matters": synthesizing a key here would risk silent duplicate processing.
 * Exported for direct unit testing. */
export function resolveDedupKey(eventId: string | null, brokerMessageId: string | null): DedupKey {
  if (eventId) {
    return DedupKey.fromString(eventId);
  }
  if (brokerMessageId) {
    return DedupKey.fromString(brokerMessageId);
  }
  throw new UnresolvableDedupKeyError(
    'Envelope is missing "eventId" and the broker supplied no native message id — cannot derive a safe dedup key'
  );
}

/** Prefers the envelope's own `correlationId`. Unlike `resolveDedupKey`, a missing correlation id
 * is safe to paper over with a generated fallback — it only degrades traceability, never
 * correctness (see the README's "Inbox record shape" note on `correlationId`). Exported for
 * direct unit testing. */
export function resolveCorrelationId(correlationId: string | null, logger: Logger): CorrelationId {
  if (correlationId) {
    return CorrelationId.fromString(correlationId);
  }
  const generated = randomUUID();
  logger.warn(`Envelope is missing "correlationId" — generated a fallback (${generated}). Publisher gap, not expected.`);
  return CorrelationId.fromString(generated);
}
