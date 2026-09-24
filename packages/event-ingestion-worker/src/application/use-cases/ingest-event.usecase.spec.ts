import { Logger } from '@nestjs/common';
import { UnresolvableDedupKeyError } from '../errors/unresolvable-dedup-key.error.js';
import { FakeClock, InMemoryInboxRepository } from './support/fakes.js';
import { IngestEventUseCase, resolveCorrelationId, resolveDedupKey, type IngestEventInput } from './ingest-event.usecase.js';

function buildInput(overrides: Partial<IngestEventInput> = {}): IngestEventInput {
  return {
    eventId: '018f5b3e-9c1a-7c3e-8f3a-6b6b6b6b6b6b',
    correlationId: 'corr-1',
    tenantId: 'tenant-1',
    eventType: 'order.created',
    payload: { orderId: 'order-1' },
    brokerMessageId: null,
    ...overrides,
  };
}

describe('IngestEventUseCase', () => {
  function setup() {
    const repository = new InMemoryInboxRepository();
    const clock = new FakeClock();
    const useCase = new IngestEventUseCase(repository, clock);
    return { repository, clock, useCase };
  }

  it('persists a new Inbox record and reports inserted: true', async () => {
    const { useCase, repository } = setup();

    const result = await useCase.execute(buildInput());

    expect(result.inserted).toBe(true);
    expect(result.dedupKey).toBe('018f5b3e-9c1a-7c3e-8f3a-6b6b6b6b6b6b');
    expect(repository.get(result.dedupKey)?.tenantId.toString()).toBe('tenant-1');
  });

  it('is idempotent: a second call with the same eventId reports inserted: false and does not duplicate', async () => {
    const { useCase, repository } = setup();

    await useCase.execute(buildInput());
    const second = await useCase.execute(buildInput({ payload: { orderId: 'a-different-looking-payload' } }));

    expect(second.inserted).toBe(false);
    expect(repository.size).toBe(1);
  });

  it('falls back to the broker message id when eventId is absent', async () => {
    const { useCase } = setup();

    const result = await useCase.execute(buildInput({ eventId: null, brokerMessageId: 'broker-msg-42' }));

    expect(result.dedupKey).toBe('broker-msg-42');
  });

  it('rejects when neither eventId nor a broker message id is present', async () => {
    const { useCase } = setup();

    await expect(useCase.execute(buildInput({ eventId: null, brokerMessageId: null }))).rejects.toThrow(
      UnresolvableDedupKeyError
    );
  });

  it('propagates domain validation errors for an invalid tenantId', async () => {
    const { useCase } = setup();

    await expect(useCase.execute(buildInput({ tenantId: '' }))).rejects.toThrow();
  });
});

describe('resolveDedupKey', () => {
  it('prefers eventId over the broker message id', () => {
    expect(resolveDedupKey('event-1', 'broker-1').toString()).toBe('event-1');
  });

  it('falls back to the broker message id when eventId is null', () => {
    expect(resolveDedupKey(null, 'broker-1').toString()).toBe('broker-1');
  });

  it('throws UnresolvableDedupKeyError when both are null', () => {
    expect(() => resolveDedupKey(null, null)).toThrow(UnresolvableDedupKeyError);
  });
});

describe('resolveCorrelationId', () => {
  it('uses the given correlationId when present', () => {
    const logger = new Logger('test');
    expect(resolveCorrelationId('corr-1', logger).toString()).toBe('corr-1');
  });

  it('generates a fallback and logs a warning when correlationId is null', () => {
    const logger = new Logger('test');
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);

    const correlationId = resolveCorrelationId(null, logger);

    expect(correlationId.toString()).toMatch(/^[0-9a-f-]{36}$/i);
    expect(warnSpy).toHaveBeenCalledOnce();
  });
});
