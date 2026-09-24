import amqp from 'amqp-connection-manager';
import { RabbitMqBrokerPublisherAdapter } from './rabbitmq-broker-publisher.adapter.js';

vi.mock('amqp-connection-manager', () => ({
  default: { connect: vi.fn() },
}));

function createFakeChannel() {
  return {
    sendToQueue: vi.fn().mockResolvedValue(true),
    close: vi.fn().mockResolvedValue(undefined),
  };
}

function createFakeConnection(channel: ReturnType<typeof createFakeChannel>) {
  let capturedSetup: ((channel: { assertQueue: ReturnType<typeof vi.fn> }) => Promise<void>) | undefined;
  return {
    on: vi.fn(),
    close: vi.fn().mockResolvedValue(undefined),
    createChannel: vi.fn((opts: { setup?: typeof capturedSetup }) => {
      capturedSetup = opts.setup;
      return channel;
    }),
    getCapturedSetup: () => capturedSetup,
  };
}

function setupAdapter(url = 'amqp://localhost:5672', queue = 'webhook.events', applicationName = 'OrderService') {
  const channel = createFakeChannel();
  const connection = createFakeConnection(channel);
  vi.mocked(amqp.connect).mockReturnValue(connection as never);

  const adapter = new RabbitMqBrokerPublisherAdapter(url, queue, applicationName);
  return { adapter, channel, connection };
}

function publishedBody(channel: ReturnType<typeof createFakeChannel>): Record<string, unknown> {
  const [, body] = channel.sendToQueue.mock.calls[0] as [string, Buffer, Record<string, unknown>];
  return JSON.parse(body.toString('utf8'));
}

describe('RabbitMqBrokerPublisherAdapter', () => {
  it('connects and asserts a durable queue on setup', async () => {
    const { connection } = setupAdapter('amqp://broker', 'my-queue');

    expect(amqp.connect).toHaveBeenCalledWith(['amqp://broker']);
    expect(connection.createChannel).toHaveBeenCalledWith(expect.objectContaining({ setup: expect.any(Function) }));

    const assertQueue = vi.fn().mockResolvedValue(undefined);
    await connection.getCapturedSetup()?.({ assertQueue });

    expect(assertQueue).toHaveBeenCalledWith('my-queue', { durable: true });
  });

  it('publishes the envelope as a JSON buffer onto the configured queue', async () => {
    const { adapter, channel } = setupAdapter('amqp://broker', 'my-queue');

    await adapter.publish({
      eventId: 'evt-1',
      correlationId: 'corr-1',
      tenantId: 'tenant-1',
      eventType: 'order.created',
      payload: { orderId: 'order-1' },
    });

    expect(channel.sendToQueue).toHaveBeenCalledTimes(1);
    const [queue, , options] = channel.sendToQueue.mock.calls[0] as [string, Buffer, Record<string, unknown>];
    expect(queue).toBe('my-queue');
    expect(publishedBody(channel)).toEqual({
      eventId: 'evt-1',
      correlationId: 'corr-1',
      tenantId: 'tenant-1',
      eventType: 'order.created',
      payload: { orderId: 'order-1' },
    });
    expect(options).toMatchObject({ contentType: 'application/json', correlationId: 'corr-1' });
  });

  it('preserves a caller-supplied eventId instead of generating one', async () => {
    const { adapter, channel } = setupAdapter();

    await adapter.publish({ eventId: 'evt-1', tenantId: 'tenant-1', eventType: 'order.created', payload: {} });

    expect(publishedBody(channel).eventId).toBe('evt-1');
  });

  it('generates an eventId scoped by applicationName when the caller omits it', async () => {
    const { adapter, channel } = setupAdapter('amqp://localhost:5672', 'webhook.events', 'OrderService');

    await adapter.publish({ tenantId: 'tenant-1', eventType: 'order.created', payload: {} });

    const { eventId } = publishedBody(channel);
    expect(eventId).toMatch(/^OrderService-[0-9a-f-]{36}$/i);
  });

  it('generates a different eventId on each call', async () => {
    const { adapter, channel } = setupAdapter();

    await adapter.publish({ tenantId: 'tenant-1', eventType: 'order.created', payload: {} });
    await adapter.publish({ tenantId: 'tenant-1', eventType: 'order.created', payload: {} });

    const first = channel.sendToQueue.mock.calls[0] as [string, Buffer, Record<string, unknown>];
    const second = channel.sendToQueue.mock.calls[1] as [string, Buffer, Record<string, unknown>];
    const firstId = JSON.parse(first[1].toString('utf8')).eventId;
    const secondId = JSON.parse(second[1].toString('utf8')).eventId;
    expect(firstId).not.toBe(secondId);
  });

  it('publishes without correlationId when the caller omits it', async () => {
    const { adapter, channel } = setupAdapter();

    await adapter.publish({ tenantId: 'tenant-1', eventType: 'order.created', payload: {} });

    expect(publishedBody(channel).correlationId).toBeUndefined();
    const [, , options] = channel.sendToQueue.mock.calls[0] as [string, Buffer, Record<string, unknown>];
    expect((options as { correlationId?: string }).correlationId).toBeUndefined();
  });

  it('onModuleDestroy closes the channel then the connection', async () => {
    const { adapter, channel, connection } = setupAdapter();

    await adapter.onModuleDestroy();

    expect(channel.close).toHaveBeenCalled();
    expect(connection.close).toHaveBeenCalled();
  });
});
