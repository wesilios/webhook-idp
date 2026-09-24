import type { Clock, InboxRepository, UpsertInboxRecordResult } from '@domain/ports/index.js';
import type { InboxRecord } from '@domain/inbox/aggregates/inbox-record.aggregate.js';

/** Deterministic, adjustable `Clock` fake for use-case tests. */
export class FakeClock implements Clock {
  constructor(private current: Date = new Date('2026-01-01T00:00:00.000Z')) {}

  now(): Date {
    return this.current;
  }

  advance(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }
}

/** In-memory `InboxRepository` fake, keyed by dedupKey — mirrors the real Mongo unique-index
 * upsert semantics closely enough for use-case tests: a second upsert with the same dedupKey is
 * a no-op that reports `inserted: false`, and never overwrites the first record's fields. */
export class InMemoryInboxRepository implements InboxRepository {
  private readonly store = new Map<string, InboxRecord>();

  async upsertByDedupKey(record: InboxRecord): Promise<UpsertInboxRecordResult> {
    const key = record.dedupKey.toString();
    if (this.store.has(key)) {
      return { inserted: false };
    }
    this.store.set(key, record);
    return { inserted: true };
  }

  get(dedupKey: string): InboxRecord | undefined {
    return this.store.get(dedupKey);
  }

  get size(): number {
    return this.store.size;
  }
}
