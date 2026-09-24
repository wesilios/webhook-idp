import { SystemClock } from './system-clock.js';

describe('SystemClock', () => {
  it('returns the current date/time', () => {
    const before = Date.now();
    const clock = new SystemClock();
    const now = clock.now();
    const after = Date.now();

    expect(now).toBeInstanceOf(Date);
    expect(now.getTime()).toBeGreaterThanOrEqual(before);
    expect(now.getTime()).toBeLessThanOrEqual(after);
  });

  it('returns a fresh Date instance on every call', () => {
    const clock = new SystemClock();
    const first = clock.now();
    const second = clock.now();

    expect(first).not.toBe(second);
  });
});
