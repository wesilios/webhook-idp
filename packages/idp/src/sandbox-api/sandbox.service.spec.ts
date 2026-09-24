import type { BrokerPublisher, EventEnvelope } from './ports/broker-publisher.port.js';
import { SandboxService } from './sandbox.service.js';

class FakeBrokerPublisher implements BrokerPublisher {
  readonly published: EventEnvelope[] = [];

  async publish(envelope: EventEnvelope): Promise<void> {
    this.published.push(envelope);
  }
}

describe('SandboxService', () => {
  it('forwards the input to the broker publisher and resolves true', async () => {
    const publisher = new FakeBrokerPublisher();
    const service = new SandboxService(publisher);
    const input = {
      eventId: 'evt-1',
      correlationId: 'corr-1',
      tenantId: 'tenant-1',
      eventType: 'order.created',
      payload: { orderId: 'order-1' },
    };

    const result = await service.publish(input);

    expect(result).toBe(true);
    expect(publisher.published).toEqual([input]);
  });

  it('propagates a publish failure instead of swallowing it', async () => {
    const publisher: BrokerPublisher = {
      publish: vi.fn().mockRejectedValue(new Error('broker unreachable')),
    };
    const service = new SandboxService(publisher);

    await expect(
      service.publish({ tenantId: 'tenant-1', eventType: 'order.created', payload: {} })
    ).rejects.toThrow('broker unreachable');
  });
});
