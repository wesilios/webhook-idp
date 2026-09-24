import type { Clock } from '../../ports/clock.port.js';
import { InvalidPayloadError } from '../inbox.errors.js';
import type { CorrelationId, DedupKey, EventType, InboxRecordStatus, TenantId } from '../value-objects/index.js';
import { InboxRecordId } from '../value-objects/index.js';

export interface IngestInboxRecordParams {
  dedupKey: DedupKey;
  tenantId: TenantId;
  correlationId: CorrelationId;
  eventType: EventType;
  payload: Record<string, unknown>;
}

export interface RestoreInboxRecordProps {
  id: InboxRecordId;
  dedupKey: DedupKey;
  tenantId: TenantId;
  correlationId: CorrelationId;
  eventType: EventType;
  payload: Record<string, unknown>;
  receivedAt: Date;
  status: InboxRecordStatus;
}

export class InboxRecord {
  private constructor(
    readonly id: InboxRecordId,
    readonly dedupKey: DedupKey,
    readonly tenantId: TenantId,
    readonly correlationId: CorrelationId,
    readonly eventType: EventType,
    readonly payload: Record<string, unknown>,
    readonly receivedAt: Date,
    private statusValue: InboxRecordStatus
  ) {}

  /**
   * Builds a new Inbox record for a just-received event. Whether this is genuinely new or a
   * broker redelivery of an already-ingested event is decided by the repository's upsert-by-
   * dedupKey call, not here — this factory has no way to know either way in advance.
   */
  static ingest(params: IngestInboxRecordParams, clock: Clock): InboxRecord {
    assertValidPayload(params.payload);
    return new InboxRecord(
      InboxRecordId.generate(),
      params.dedupKey,
      params.tenantId,
      params.correlationId,
      params.eventType,
      params.payload,
      clock.now(),
      'INGESTED'
    );
  }

  /** Rehydrates an existing Inbox record from persistence. */
  static restore(props: RestoreInboxRecordProps): InboxRecord {
    return new InboxRecord(
      props.id,
      props.dedupKey,
      props.tenantId,
      props.correlationId,
      props.eventType,
      props.payload,
      props.receivedAt,
      props.status
    );
  }

  get status(): InboxRecordStatus {
    return this.statusValue;
  }
}

function assertValidPayload(payload: Record<string, unknown>): void {
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new InvalidPayloadError('payload must be a non-null, non-array object');
  }
}
