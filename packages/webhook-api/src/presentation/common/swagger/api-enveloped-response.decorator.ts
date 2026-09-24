import { applyDecorators, Type } from '@nestjs/common';
import { ApiExtraModels, ApiResponse, getSchemaPath } from '@nestjs/swagger';
import { ApiEnvelopeSchema } from './api-envelope.schema.js';

/**
 * Documents a success response as `ApiEnvelope<TModel>` — every real response goes through the
 * global `EnvelopeInterceptor`, so a plain `@ApiResponse({ type: TModel })` would describe the
 * unwrapped inner shape, not what the API actually returns. Follows Nest's own documented
 * "generic ApiResponse" recipe (`allOf` + `ApiExtraModels` + `getSchemaPath`) rather than a
 * hand-rolled response type.
 */
export function ApiEnvelopedResponse<TModel extends Type<unknown>>(model: TModel, status: number) {
  return applyDecorators(
    ApiExtraModels(ApiEnvelopeSchema, model),
    ApiResponse({
      status,
      schema: {
        allOf: [{ $ref: getSchemaPath(ApiEnvelopeSchema) }, { properties: { Data: { $ref: getSchemaPath(model) } } }],
      },
    })
  );
}
