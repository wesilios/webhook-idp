import { InvalidEventTypeError } from '../inbox.errors.js';
import { EventType } from './event-type.vo.js';

describe('EventType', () => {
  it('accepts a non-empty event type string', () => {
    const eventType = EventType.fromString('order.created');
    expect(eventType.toString()).toBe('order.created');
  });

  it('rejects an empty string', () => {
    expect(() => EventType.fromString('')).toThrow(InvalidEventTypeError);
  });

  it('rejects a whitespace-only string', () => {
    expect(() => EventType.fromString('   ')).toThrow(InvalidEventTypeError);
  });

  it('compares by value', () => {
    const a = EventType.fromString('order.created');
    const b = EventType.fromString('order.created');
    const c = EventType.fromString('order.shipped');
    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
  });
});
