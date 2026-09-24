import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { EventEnvelopeDto } from './dto/event-envelope.dto.js';
import { InvalidEnvelopeError } from './errors/invalid-envelope.error.js';

/**
 * Deserializes and shape-validates a raw broker message body into an `EventEnvelopeDto` — the
 * decorator-driven equivalent of webhook-api's `ValidationPipe`, just invoked manually since
 * there's no HTTP pipeline to trigger it here. Exported as a standalone function (not buried in
 * `IngestionRuntimeService`) so it's directly unit-testable without standing up the whole runtime
 * service or a real broker connection.
 */
export function parseEnvelope(body: unknown): EventEnvelopeDto {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new InvalidEnvelopeError('Envelope must be a JSON object');
  }

  const dto = plainToInstance(EventEnvelopeDto, body);
  const errors = validateSync(dto);
  if (errors.length > 0) {
    const details = errors.map((error) => Object.values(error.constraints ?? {}).join(', ')).join('; ');
    throw new InvalidEnvelopeError(`Envelope failed validation: ${details}`);
  }

  return dto;
}
