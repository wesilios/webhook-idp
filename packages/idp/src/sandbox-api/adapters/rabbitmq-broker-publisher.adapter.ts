import { randomUUID } from 'node:crypto';
import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import amqp, { type AmqpConnectionManager, type Channel, type ChannelWrapper } from 'amqp-connection-manager';
import type { BrokerPublisher, EventEnvelope } from '../ports/broker-publisher.port.js';

/**
 * RabbitMQ implementation of the `BrokerPublisher` port. Publishes the envelope as JSON onto the
 * same durable queue event-ingestion-worker's `RabbitMqBrokerConsumerAdapter` consumes from — the
 * two adapters never import each other, they only agree on the queue name and the envelope shape
 * (documented in each package's README).
 */
@Injectable()
export class RabbitMqBrokerPublisherAdapter implements BrokerPublisher, OnModuleDestroy {
  private readonly logger = new Logger(RabbitMqBrokerPublisherAdapter.name);
  private readonly connection: AmqpConnectionManager;
  private readonly channel: ChannelWrapper;

  constructor(
    url: string,
    private readonly queue: string,
    private readonly applicationName: string
  ) {
    this.connection = amqp.connect([url]);
    this.connection.on('connectFailed', ({ err }) => {
      this.logger.error(`Failed to connect to the Message Broker: ${err.message}`);
    });
    this.channel = this.connection.createChannel({
      setup: async (channel: Channel) => {
        // Durable queue, matching event-ingestion-worker's own assertQueue call — either side
        // asserting it first is fine, RabbitMQ just needs the arguments to agree.
        await channel.assertQueue(this.queue, { durable: true });
      },
    });
  }

  async publish(envelope: EventEnvelope): Promise<void> {
    // `eventId` is never client-supplied — `CreateEventDto` excludes it from the request body, so
    // this adapter is the one place it's generated, scoped by this publisher's own
    // `applicationName` (APPLICATION_NAME env var) so ids are traceable back to whichever
    // simulated Internal Service produced them, mirroring how a real publisher would mint its own.
    const eventId = envelope.eventId ?? `${this.applicationName}-${randomUUID()}`;
    const body = Buffer.from(JSON.stringify({ ...envelope, eventId }));
    // correlationId set as a broker-native property too — defense-in-depth for broker
    // tooling/tracing, never the authoritative source (the envelope body is). See
    // event-ingestion-worker's README, "Application-level envelope over broker-native metadata".
    await this.channel.sendToQueue(this.queue, body, {
      contentType: 'application/json',
      correlationId: envelope.correlationId,
    });
    this.logger.log(`Published to queue "${this.queue}" (eventType=${envelope.eventType}, eventId=${eventId})`);
  }

  async onModuleDestroy(): Promise<void> {
    await this.channel.close();
    await this.connection.close();
  }
}
