import { Body, Controller, Post, UseInterceptors } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CreateEventDto } from './dto/create-event.dto.js';
import { CorrelationIdInterceptor } from './interceptors/correlation-id.interceptor.js';
import { SandboxService } from './sandbox.service.js';

@ApiTags('sandbox')
@Controller('sandbox')
export class SandboxController {
  constructor(private readonly sandboxService: SandboxService) {}

  @Post()
  @UseInterceptors(CorrelationIdInterceptor)
  @ApiOperation({
    summary: 'Simulate an Internal Service publishing a domain event',
    description:
      "Builds an event envelope from the request body — the same shape event-ingestion-worker's " +
      'EventEnvelopeDto expects — and publishes it onto the Message Broker (RabbitMQ), so a developer can ' +
      'exercise the real ingestion pipeline without a real Internal Service. `eventId` is always generated ' +
      'server-side (scoped by APPLICATION_NAME); `correlationId` is generated too, but only when omitted.',
  })
  @ApiResponse({ status: 201, description: 'The event was published onto the Message Broker.' })
  async create(@Body() body: CreateEventDto): Promise<{ result: boolean }> {
    const result = await this.sandboxService.publish(body);
    return { result };
  }
}
