export abstract class DomainEvent {
  protected constructor(
    readonly aggregateId: string,
    readonly occurredAt: Date
  ) {}
}
