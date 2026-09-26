import { ApiProperty } from '@nestjs/swagger';

export class VersionzResponseDto {
  @ApiProperty({ description: 'Service name', example: 'idp' })
  service!: string;

  @ApiProperty({
    description: 'Deployed build version, from the VERSION env var',
    example: '1.0.0',
  })
  version!: string;
}
