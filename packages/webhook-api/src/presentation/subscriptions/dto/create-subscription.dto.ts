import { ArrayNotEmpty, IsArray, IsString } from 'class-validator';

/**
 * HTTP-boundary shape validation only (defense-in-depth) — the domain value objects
 * (`TargetUrl`, `EventType`) are the source of truth for the real invariants (URL format,
 * HTTPS-only, SSRF guard, non-empty event type strings, etc.) and throw `DomainError`s that
 * the global exception filter maps to the response envelope.
 */
export class CreateSubscriptionDto {
  @IsString()
  targetUrl!: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  eventTypes!: string[];
}
