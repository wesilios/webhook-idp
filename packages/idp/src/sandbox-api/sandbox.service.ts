import { Inject, Injectable } from '@nestjs/common';
import { BROKER_PUBLISHER, type BrokerPublisher } from './ports/broker-publisher.port.js';

export interface CreateSandboxEventInput {
  eventId?: string;
  correlationId?: string;
  tenantId: string;
  eventType: string;
  payload: Record<string, unknown>;
}

@Injectable()
export class SandboxService {
  constructor(@Inject(BROKER_PUBLISHER) private readonly brokerPublisher: BrokerPublisher) {}

  async publish(eventInput: CreateSandboxEventInput): Promise<boolean> {
    await this.brokerPublisher.publish(eventInput);
    return true;
  }
}
