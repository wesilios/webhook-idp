import { Inject, Injectable, Logger } from '@nestjs/common';
import { BROKER_CONSUMER, type BrokerConsumer, type BrokerMessage } from '@domain/ports/index.js';
import { IngestEventUseCase } from '@application/use-cases/index.js';
import { parseEnvelope } from './envelope-parser.js';

/**
 * The "runtime" layer for this worker (analogous to `webhook-api`'s `presentation/` controllers
 * — see `.agent/rules/architecture.md`'s layering doc). Owns starting/stopping consumption,
 * deserializing/validating the raw broker message via `parseEnvelope` (the decorator-driven
 * equivalent of a controller + `ValidationPipe`), and logging the outcome. All business logic —
 * dedup-key/correlation-id resolution, persistence — lives in `IngestEventUseCase`, per
 * `.agent/rules/deployment.md`'s "thin, swappable runtime entrypoint" rule.
 */
@Injectable()
export class IngestionRuntimeService {
  private readonly logger = new Logger(IngestionRuntimeService.name);

  constructor(
    @Inject(BROKER_CONSUMER) private readonly brokerConsumer: BrokerConsumer,
    private readonly ingestEvent: IngestEventUseCase
  ) {}

  async start(): Promise<void> {
    await this.brokerConsumer.consume((message) => this.handle(message));
    this.logger.log('Started consuming from the Message Broker');
  }

  async stop(): Promise<void> {
    await this.brokerConsumer.disconnect();
    this.logger.log('Stopped consuming from the Message Broker');
  }

  private async handle(message: BrokerMessage): Promise<void> {
    const envelope = parseEnvelope(message.body);

    const result = await this.ingestEvent.execute({
      eventId: envelope.eventId ?? null,
      correlationId: envelope.correlationId ?? null,
      tenantId: envelope.tenantId,
      eventType: envelope.eventType,
      payload: envelope.payload,
      brokerMessageId: message.brokerMessageId,
    });

    this.logger.log(
      result.inserted
        ? `Ingested new event (dedupKey=${result.dedupKey})`
        : `Duplicate delivery, already ingested (dedupKey=${result.dedupKey})`
    );
  }
}
