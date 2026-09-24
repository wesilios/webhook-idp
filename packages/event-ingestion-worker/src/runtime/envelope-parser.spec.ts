import { randomUUID } from 'node:crypto';
import { parseEnvelope } from './envelope-parser.js';
import { InvalidEnvelopeError } from './errors/invalid-envelope.error.js';

describe('parseEnvelope', () => {
  it('parses a valid envelope with all fields present', () => {
    const eventId = randomUUID();
    const correlationId = randomUUID();

    const dto = parseEnvelope({
      eventId,
      correlationId,
      tenantId: 'tenant-1',
      eventType: 'order.created',
      payload: { orderId: 'order-1' },
    });

    expect(dto.eventId).toBe(eventId);
    expect(dto.correlationId).toBe(correlationId);
    expect(dto.tenantId).toBe('tenant-1');
    expect(dto.eventType).toBe('order.created');
    expect(dto.payload).toEqual({ orderId: 'order-1' });
  });

  it('allows eventId and correlationId to be omitted', () => {
    const dto = parseEnvelope({ tenantId: 'tenant-1', eventType: 'order.created', payload: {} });

    expect(dto.eventId).toBeUndefined();
    expect(dto.correlationId).toBeUndefined();
  });

  it('rejects a body that is not a JSON object', () => {
    expect(() => parseEnvelope('nope')).toThrow(InvalidEnvelopeError);
    expect(() => parseEnvelope(null)).toThrow(InvalidEnvelopeError);
    expect(() => parseEnvelope(42)).toThrow(InvalidEnvelopeError);
  });

  it('rejects an array body', () => {
    expect(() => parseEnvelope([])).toThrow(InvalidEnvelopeError);
  });

  it('rejects a missing tenantId', () => {
    expect(() => parseEnvelope({ eventType: 'order.created', payload: {} })).toThrow(InvalidEnvelopeError);
  });

  it('rejects a missing eventType', () => {
    expect(() => parseEnvelope({ tenantId: 'tenant-1', payload: {} })).toThrow(InvalidEnvelopeError);
  });

  it('rejects a missing payload', () => {
    expect(() => parseEnvelope({ tenantId: 'tenant-1', eventType: 'order.created' })).toThrow(InvalidEnvelopeError);
  });

  it('rejects an array payload', () => {
    expect(() => parseEnvelope({ tenantId: 'tenant-1', eventType: 'order.created', payload: [] })).toThrow(
      InvalidEnvelopeError
    );
  });

  it('accepts a non-UUID eventId (e.g. a publisher-scoped id like "OrderService-<uuid>")', () => {
    const eventId = `OrderService-${randomUUID()}`;

    const dto = parseEnvelope({ tenantId: 'tenant-1', eventType: 'order.created', payload: {}, eventId });

    expect(dto.eventId).toBe(eventId);
  });

  it('rejects a non-string eventId', () => {
    expect(() =>
      parseEnvelope({ tenantId: 'tenant-1', eventType: 'order.created', payload: {}, eventId: 12345 })
    ).toThrow(InvalidEnvelopeError);
  });

  it('rejects a non-UUID correlationId', () => {
    expect(() =>
      parseEnvelope({ tenantId: 'tenant-1', eventType: 'order.created', payload: {}, correlationId: 'not-a-uuid' })
    ).toThrow(InvalidEnvelopeError);
  });
});
