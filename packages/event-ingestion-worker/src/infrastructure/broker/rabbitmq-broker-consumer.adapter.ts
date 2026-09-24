import { Logger } from '@nestjs/common';
import amqp, { type AmqpConnectionManager, type Channel, type ChannelWrapper } from 'amqp-connection-manager';
import type { ConsumeMessage } from 'amqplib';
import type { BrokerConsumer, BrokerMessage } from '@domain/ports/broker-consumer.port.js';

/**
 * RabbitMQ implementation of the `BrokerConsumer` port — one of possibly several adapters (Azure
 * Service Bus, AWS SQS) implementing the same interface, per this package's README, "Broker
 * choice is swappable by design". Uses `amqp-connection-manager` for reconnect handling rather
 * than bare `amqplib`, since a dropped connection must not silently stop ingestion.
 */
export class RabbitMqBrokerConsumerAdapter implements BrokerConsumer {
  private readonly logger = new Logger(RabbitMqBrokerConsumerAdapter.name);
  private readonly connection: AmqpConnectionManager;
  private readonly channel: ChannelWrapper;

  constructor(
    url: string,
    private readonly queue: string
  ) {
    this.connection = amqp.connect([url]);
    this.connection.on('connectFailed', ({ err }) => {
      this.logger.error(`Failed to connect to the Message Broker: ${err.message}`);
    });
    this.channel = this.connection.createChannel({
      setup: async (channel: Channel) => {
        // Durable queue: survives a broker restart — see the README's "Broker-side durability/HA
        // is a prerequisite" note. Dead-lettering (poison-message handling) is queue topology
        // provisioned separately (a DLX binding), not asserted here.
        await channel.assertQueue(this.queue, { durable: true });
      },
    });
  }

  async consume(handler: (message: BrokerMessage) => Promise<void>): Promise<void> {
    await this.channel.consume(this.queue, (msg) => {
      void this.handleMessage(msg, handler);
    });
  }

  async disconnect(): Promise<void> {
    await this.channel.close();
    await this.connection.close();
  }

  /**
   * Never lets an error escape this function — `amqp-connection-manager` does not await
   * `onMessage`, so a thrown/rejected error here would become an unhandled rejection rather than
   * reach any caller. Ack/nack are therefore driven from inside this try/catch, not by the
   * `consume()` caller.
   */
  private async handleMessage(
    msg: ConsumeMessage | null,
    handler: (message: BrokerMessage) => Promise<void>
  ): Promise<void> {
    // amqplib passes `null` when the consumer is cancelled server-side (e.g. queue deleted) —
    // nothing to ack/nack.
    if (msg === null) {
      return;
    }

    try {
      const body: unknown = JSON.parse(msg.content.toString('utf8'));
      await handler({ body, brokerMessageId: msg.properties.messageId ?? null });
      this.channel.ack(msg);
    } catch (err) {
      this.logger.error(
        `Failed to process message, nacking without requeue (expects a broker-level DLX for poison messages): ${(err as Error).message}`
      );
      this.channel.nack(msg, false, false);
    }
  }
}
