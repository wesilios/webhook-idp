import type { InboxRecord } from '../inbox/aggregates/inbox-record.aggregate.js';

export interface UpsertInboxRecordResult {
  /**
   * True if this call created a new Inbox record; false if a record with the same `dedupKey`
   * already existed (an idempotent no-op — see the package README's "Idempotent ingestion, not
   * idempotent delivery"). The application layer uses this to decide whether to emit the
   * "notify new event" hint described in the README's dataflow diagram.
   */
  inserted: boolean;
}

export interface InboxRepository {
  upsertByDedupKey(record: InboxRecord): Promise<UpsertInboxRecordResult>;
}

export const INBOX_REPOSITORY = Symbol('InboxRepository');
