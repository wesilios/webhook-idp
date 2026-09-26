import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { VersionzResponseDto } from './dto/versionz-response.dto.js';

export const SERVICE_NAME = 'idp';

/**
 * `GET /versionz` — which build is running, for debugging a deployed environment. Every HTTP app
 * in the platform exposes it at the same root path; unauthenticated, and it exposes nothing beyond
 * the service name and version.
 */
@ApiTags('diagnostics')
@Controller('versionz')
export class VersionzController {
  constructor(private readonly configService: ConfigService) {}

  @Get()
  @ApiOperation({ summary: 'Running service name and version' })
  @ApiOkResponse({ type: VersionzResponseDto })
  get(): VersionzResponseDto {
    return {
      service: SERVICE_NAME,
      version: this.configService.get<string>('version') ?? 'unknown',
    };
  }
}
