import { ApiProperty } from '@nestjs/swagger';

/** Outbound shape for `GET /versionz` — PascalCase, per the response-envelope contract. */
export class VersionzResponseDto {
  @ApiProperty({ description: 'Service name', example: 'webhook-api' })
  Service!: string;

  @ApiProperty({
    description: 'Deployed build version, from the VERSION env var',
    example: '1.0.0',
  })
  Version!: string;
}
