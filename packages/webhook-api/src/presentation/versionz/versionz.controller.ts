import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiEnvelopedResponse } from '../common/swagger/api-enveloped-response.decorator.js';
import { VersionzResponseDto } from './dto/versionz-response.dto.js';

export const SERVICE_NAME = 'webhook-api';

/**
 * `GET /versionz` — which build is running, for debugging a deployed environment. Served at the
 * root, outside the `api/v1` prefix (see `app.setup.ts`), and deliberately unauthenticated: no
 * `IdentityGuard`, and it exposes nothing beyond the service name and version.
 */
@ApiTags('diagnostics')
@Controller('versionz')
export class VersionzController {
  constructor(private readonly configService: ConfigService) {}

  @Get()
  @ApiOperation({ summary: 'Running service name and version' })
  @ApiEnvelopedResponse(VersionzResponseDto, 200)
  get(): VersionzResponseDto {
    return {
      Service: SERVICE_NAME,
      Version: this.configService.get<string>('version') ?? 'unknown',
    };
  }
}
