# IDP — Sandbox API

Sandbox API for the Internal Developer Platform (IDP) roadmap item — lets a developer simulate an
Internal Service publishing a domain event, without needing a real internal service or a real
Message Broker message (see the root [`README.md`](../../README.md) for full system context).

## Purpose

The platform root README lists a Developer Portal as a future IDP roadmap item — internal service
teams registering event types, debugging event/delivery flow, and sandbox/mock-testing webhooks.
This package is the first, narrowest slice of that: a sandbox endpoint that builds a valid event
envelope by hand (see `event-ingestion-worker`'s README, "Event envelope contract"), so the rest of
the pipeline can eventually be exercised end-to-end without waiting on a real internal service to
integrate first.

## Current state

- `POST /sandbox` accepts a body matching `event-ingestion-worker`'s `EventEnvelopeDto` — `tenantId`/`eventType`/
  `payload` required, `correlationId` optional (backfilled with a fresh UUID by `CorrelationIdInterceptor` when
  omitted) — validated via `class-validator` decorators plus a global `ValidationPipe`.
- `eventId` is never client-supplied (`@Exclude()`d from the request body) — `RabbitMqBrokerPublisherAdapter`
  always generates it as `${APPLICATION_NAME}-<uuid>`, scoping it to whichever simulated Internal Service
  published it.
- `SandboxService.publish()` publishes the envelope onto RabbitMQ for real, via `BrokerPublisher`/
  `RabbitMqBrokerPublisherAdapter` — confirmed end-to-end against a real broker and `event-ingestion-worker`
  actually ingesting the result into MongoDB.
- Swagger UI is live at `/api/docs` once the server is running — `@nestjs/swagger`'s CLI plugin infers the DTO
  schema from those decorators, same convention as `webhook-api`.

## Roadmap

1. **Done** — request validation, Swagger docs, and a real RabbitMQ publish path (`eventId` server-generated,
   `correlationId` auto-populated when omitted) — confirmed end-to-end against a live broker.
2. **Later, part of the wider Developer Portal** (see the root README's Roadmap):
   - event type / payload schema registration for internal teams
   - visibility into ingested/delivered events (reading `inbox`/`delivery` records) for debugging
   - a mock Consumer Endpoint, so a webhook subscription's delivery can be sandbox-tested too
   - still an open question, per the root README: whether this portal should generate
     Terraform/IaC for provisioning event types/subscriptions

## Development

- `npm run build|lint|test --workspace packages/idp` (from the repo root).
- `npm run start:dev --workspace packages/idp` — needs `PORT` (defaults to `3000`), `RABBIT_MQ_CONN`/
  `RABBIT_MQ_QUEUE` (see `.env.example`) pointed at the same broker/queue `event-ingestion-worker` consumes
  from, and `APPLICATION_NAME` (scopes the generated `eventId`).

## Reference

- Root [`README.md`](../../README.md) — project introduction, features, Roadmap.
- Root [`architecture.md`](../../architecture.md) — system design, current-vs-target state.
- [`../event-ingestion-worker/README.md`](../event-ingestion-worker/README.md) — the event
  envelope contract this sandbox's request body deliberately mirrors.
- `.agent/rules/terminology.md` — canonical naming.
