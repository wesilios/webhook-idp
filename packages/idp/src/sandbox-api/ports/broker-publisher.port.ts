export interface EventEnvelope {
  /** Publisher-assigned, unique per occurrence — becomes event-ingestion-worker's dedup key.
   * Left unset on purpose exercises that worker's broker-message-id fallback (or its
   * UnresolvableDedupKeyError, if the broker assigns no native id either) — see this package's
   * README. */
  eventId?: string;
  correlationId?: string;
  tenantId: string;
  eventType: string;
  payload: Record<string, unknown>;
}

/**
 * Broker-agnostic port for publishing a simulated domain event — the producer-side mirror of
 * event-ingestion-worker's `BrokerConsumer` port. Concrete adapters (RabbitMQ for now) live in
 * `sandbox-api/adapters/`, so the broker stays swappable without touching `SandboxService`.
 */
export interface BrokerPublisher {
  publish(envelope: EventEnvelope): Promise<void>;
}

export const BROKER_PUBLISHER = Symbol('BrokerPublisher');
