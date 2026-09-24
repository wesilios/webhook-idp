export interface BrokerMessage {
  body: unknown;
  brokerMessageId: string | null;
}

/**
 * Broker-agnostic port for pulling events off whichever Message Broker this worker is wired to.
 * Concrete adapters (RabbitMQ locally, Azure Service Bus / AWS SQS in cloud — see
 * `.agent/rules/terminology.md`) live in `infrastructure/broker/`, each implementing this same
 * interface so the broker is swappable without touching `domain/`/`application/`
 */
export interface BrokerConsumer {
  consume(handler: (message: BrokerMessage) => Promise<void>): Promise<void>;

  disconnect(): Promise<void>;
}

export const BROKER_CONSUMER = Symbol('BrokerConsumer');
