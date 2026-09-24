import { ApiProperty } from '@nestjs/swagger';

/**
 * Swagger-only mirror of `ApiEnvelope<T>` (`envelope.dto.ts`) with `Data` untyped — used as the
 * generic "outer shape" that `ApiEnvelopedResponse()` combines with a specific `Data` model via
 * `allOf`. Never used as a runtime type; `EnvelopeInterceptor` builds the real response.
 */
export class ApiEnvelopeErrorItemSchema {
  @ApiProperty()
  ErrorCode!: string;

  @ApiProperty()
  ErrorMessage!: string;
}

export class ApiEnvelopeSchema {
  @ApiProperty({ nullable: true })
  Data: unknown;

  @ApiProperty()
  StatusCode!: number;

  @ApiProperty()
  Code!: string;

  @ApiProperty()
  Message!: string;

  @ApiProperty({ type: [ApiEnvelopeErrorItemSchema] })
  Errors!: ApiEnvelopeErrorItemSchema[];
}
