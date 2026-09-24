import { randomUUID } from 'node:crypto';
import type { BrokerConsumer, BrokerMessage } from '@domain/ports/index.js';
import type { IngestEventResult, IngestEventUseCase } from '@application/use-cases/index.js';
import { InvalidEnvelopeError } from './errors/invalid-envelope.error.js';
import { IngestionRuntimeService } from './ingestion-runtime.service.js';

class FakeBrokerConsumer implements BrokerConsumer {
  private handler: ((message: BrokerMessage) => Promise<void>) | undefined;
  readonly disconnect = vi.fn().mockResolvedValue(undefined);

  async consume(handler: (message: BrokerMessage) => Promise<void>): Promise<void> {
    this.handler = handler;
  }

  /** Simulates the broker delivering one message to whatever handler `consume()` registered. */
  async deliver(message: BrokerMessage): Promise<void> {
    if (!this.handler) {
      throw new Error('consume() was not called before deliver()');
    }
    await this.handler(message);
  }
}

function fakeUseCase(result: IngestEventResult) {
  const execute = vi.fn().mockResolvedValue(result);
  return { instance: { execute } as unknown as IngestEventUseCase, execute };
}

describe('IngestionRuntimeService', () => {
  it('start() registers a handler with the broker consumer', async () => {
    const broker = new FakeBrokerConsumer();
    const consumeSpy = vi.spyOn(broker, 'consume');
    const { instance } = fakeUseCase({ dedupKey: 'k', inserted: true });
    const service = new IngestionRuntimeService(broker, instance);

    await service.start();

    expect(consumeSpy).toHaveBeenCalledWith(expect.any(Function));
  });

  it('parses the envelope and calls the use case with the resolved input', async () => {
    const broker = new FakeBrokerConsumer();
    const { instance, execute } = fakeUseCase({ dedupKey: 'k', inserted: true });
    const service = new IngestionRuntimeService(broker, instance);
    await service.start();
    const eventId = randomUUID();
    const correlationId = randomUUID();

    await broker.deliver({
      body: { eventId, correlationId, tenantId: 't1', eventType: 'order.created', payload: { a: 1 } },
      brokerMessageId: 'broker-1',
    });

    expect(execute).toHaveBeenCalledWith({
      eventId,
      correlationId,
      tenantId: 't1',
      eventType: 'order.created',
      payload: { a: 1 },
      brokerMessageId: 'broker-1',
    });
  });

  it('maps an omitted eventId/correlationId in the envelope to null, not undefined', async () => {
    const broker = new FakeBrokerConsumer();
    const { instance, execute } = fakeUseCase({ dedupKey: 'k', inserted: true });
    const service = new IngestionRuntimeService(broker, instance);
    await service.start();

    await broker.deliver({
      body: { tenantId: 't1', eventType: 'order.created', payload: {} },
      brokerMessageId: null,
    });

    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({ eventId: null, correlationId: null, brokerMessageId: null })
    );
  });

  it('propagates a parse failure without calling the use case', async () => {
    const broker = new FakeBrokerConsumer();
    const { instance, execute } = fakeUseCase({ dedupKey: 'k', inserted: true });
    const service = new IngestionRuntimeService(broker, instance);
    await service.start();

    await expect(broker.deliver({ body: 'not-an-object', brokerMessageId: null })).rejects.toThrow(
      InvalidEnvelopeError
    );
    expect(execute).not.toHaveBeenCalled();
  });

  it('stop() disconnects the broker consumer', async () => {
    const broker = new FakeBrokerConsumer();
    const { instance } = fakeUseCase({ dedupKey: 'k', inserted: true });
    const service = new IngestionRuntimeService(broker, instance);

    await service.stop();

    expect(broker.disconnect).toHaveBeenCalled();
  });
});
