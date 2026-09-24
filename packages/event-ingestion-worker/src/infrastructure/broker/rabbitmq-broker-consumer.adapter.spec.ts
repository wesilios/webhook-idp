import amqp from 'amqp-connection-manager';
import type { ConsumeMessage } from 'amqplib';
import { RabbitMqBrokerConsumerAdapter } from './rabbitmq-broker-consumer.adapter.js';

vi.mock('amqp-connection-manager', () => ({
  default: { connect: vi.fn() },
}));

function createFakeChannel() {
  return {
    consume: vi.fn().mockResolvedValue(undefined),
    ack: vi.fn(),
    nack: vi.fn(),
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

function setupAdapter(url = 'amqp://localhost:5672', queue = 'webhook.events') {
  const channel = createFakeChannel();
  const connection = createFakeConnection(channel);
  vi.mocked(amqp.connect).mockReturnValue(connection as never);

  const adapter = new RabbitMqBrokerConsumerAdapter(url, queue);
  return { adapter, channel, connection };
}

function fakeMessage(body: unknown, messageId: string | null = null): ConsumeMessage {
  return {
    content: Buffer.from(JSON.stringify(body)),
    properties: { messageId: messageId ?? undefined },
    fields: {},
  } as unknown as ConsumeMessage;
}

describe('RabbitMqBrokerConsumerAdapter', () => {
  it('connects and asserts a durable queue on setup', async () => {
    const { connection } = setupAdapter('amqp://broker', 'my-queue');

    expect(amqp.connect).toHaveBeenCalledWith(['amqp://broker']);
    expect(connection.createChannel).toHaveBeenCalledWith(expect.objectContaining({ setup: expect.any(Function) }));

    const assertQueue = vi.fn().mockResolvedValue(undefined);
    await connection.getCapturedSetup()?.({ assertQueue });

    expect(assertQueue).toHaveBeenCalledWith('my-queue', { durable: true });
  });

  // `channel.consume`'s callback is fired-and-forgotten by the real amqp-connection-manager
  // library (confirmed by reading its source: `consumer.onMessage(msg)` is called with no
  // `await`/`.then()`) — that's exactly why the adapter's own onMessage wrapper never lets an
  // error escape it (see the adapter's doc comment). It also means the callback itself returns
  // `void`, not a Promise, so tests can't `await` calling it directly — `vi.waitFor` polls for
  // the async work inside to finish instead.

  it('acks the message when the handler resolves', async () => {
    const { adapter, channel } = setupAdapter();
    const handler = vi.fn().mockResolvedValue(undefined);

    await adapter.consume(handler);
    const onMessage = channel.consume.mock.calls[0]?.[1] as (msg: ConsumeMessage | null) => void;
    const msg = fakeMessage({ tenantId: 't1' }, 'broker-msg-1');
    onMessage(msg);

    await vi.waitFor(() => expect(channel.ack).toHaveBeenCalledWith(msg));
    expect(handler).toHaveBeenCalledWith({ body: { tenantId: 't1' }, brokerMessageId: 'broker-msg-1' });
    expect(channel.nack).not.toHaveBeenCalled();
  });

  it('passes brokerMessageId: null when the message has no messageId property', async () => {
    const { adapter, channel } = setupAdapter();
    const handler = vi.fn().mockResolvedValue(undefined);

    await adapter.consume(handler);
    const onMessage = channel.consume.mock.calls[0]?.[1] as (msg: ConsumeMessage | null) => void;
    onMessage(fakeMessage({ tenantId: 't1' }));

    await vi.waitFor(() =>
      expect(handler).toHaveBeenCalledWith({ body: { tenantId: 't1' }, brokerMessageId: null })
    );
  });

  it('nacks without requeue when the handler rejects', async () => {
    const { adapter, channel } = setupAdapter();
    const handler = vi.fn().mockRejectedValue(new Error('boom'));

    await adapter.consume(handler);
    const onMessage = channel.consume.mock.calls[0]?.[1] as (msg: ConsumeMessage | null) => void;
    const msg = fakeMessage({ tenantId: 't1' });
    onMessage(msg);

    await vi.waitFor(() => expect(channel.nack).toHaveBeenCalledWith(msg, false, false));
    expect(channel.ack).not.toHaveBeenCalled();
  });

  it('nacks without requeue when the message body is not valid JSON', async () => {
    const { adapter, channel } = setupAdapter();
    const handler = vi.fn().mockResolvedValue(undefined);

    await adapter.consume(handler);
    const onMessage = channel.consume.mock.calls[0]?.[1] as (msg: ConsumeMessage | null) => void;
    const badMsg = { content: Buffer.from('not json'), properties: {} } as unknown as ConsumeMessage;
    onMessage(badMsg);

    await vi.waitFor(() => expect(channel.nack).toHaveBeenCalledWith(badMsg, false, false));
    expect(handler).not.toHaveBeenCalled();
  });

  it('does nothing when the broker delivers a null message (consumer cancelled)', async () => {
    const { adapter, channel } = setupAdapter();
    const handler = vi.fn().mockResolvedValue(undefined);

    await adapter.consume(handler);
    const onMessage = channel.consume.mock.calls[0]?.[1] as (msg: ConsumeMessage | null) => void;
    onMessage(null);
    // No async work happens on the null path, so there's nothing to `vi.waitFor` — the
    // synchronous return is the whole story here.

    expect(handler).not.toHaveBeenCalled();
    expect(channel.ack).not.toHaveBeenCalled();
    expect(channel.nack).not.toHaveBeenCalled();
  });

  it('disconnect closes the channel then the connection', async () => {
    const { adapter, channel, connection } = setupAdapter();

    await adapter.disconnect();

    expect(channel.close).toHaveBeenCalled();
    expect(connection.close).toHaveBeenCalled();
  });
});
