# Lane status

Durable handoff log for multi-agent work (see `.agent/rules/collaboration.md`). Not a live lock — the coordinator
sequences spawns, so update this when a lane's status changes, not continuously.

## webhook-api
- Status: built — merged to `master`
- Branch: —
- Current chunk: 5/5 — done
- Summary: rebuilt on NestJS/MongoDB (the earlier Express/Postgres implementation was removed from the repo
  entirely). All four layers are wired end-to-end: framework-free `domain/` (`WebhookSubscription` aggregate,
  value objects incl. UUIDv7 `SubscriptionId` and SSRF-guarded `TargetUrl`, domain events, `Clock`/
  `SubscriptionRepository`/`DomainEventPublisher` ports); five `application/use-cases/`; `infrastructure/`
  (`SubscriptionMongoRepository`, `SystemClock`, `EventEmitterDomainEventPublisher`); `presentation/`
  (`SubscriptionsController`, DTOs + global `ValidationPipe`, `IdentityGuard`, envelope/pagination/target-url-masking
  interceptors, `DomainExceptionFilter`, Swagger). See `packages/webhook-api/README.md`.
- Follow-ups: `EventType` catalog validation still intentionally deferred (no catalog exists); no `migrations/`
  folder or migration tool chosen yet (indexes come from the Mongoose schema).

## event-ingestion-worker
- Status: built — merged to `master` (PR #4)
- Branch: —
- Current chunk: 5/5 — done
- Summary: NestJS application context (no HTTP listener) consuming the Message Broker (RabbitMQ, queue
  `webhook.events`) via a `BrokerConsumer` port / `RabbitMqBrokerConsumerAdapter`, parsing and validating the event
  envelope in `runtime/`, and persisting `InboxRecord` aggregates to the `inbox` database through
  `InboxMongoRepository` — idempotent upsert on a unique `dedupKey` index. Graceful shutdown drains in-flight work.
  See `packages/event-ingestion-worker/README.md`.
- Follow-ups: signal to the Webhook Delivery Worker on new Inbox records is not wired (nothing consumes it yet).

## idp (sandbox — outside the standard lane set)
- Status: built — merged to `master` (PR #3)
- Branch: —
- Current chunk: —
- Summary: `POST /sandbox` builds an event envelope (server-generated `eventId`, auto `correlationId`) and
  publishes it to RabbitMQ queue `webhook.events`, so `event-ingestion-worker` can be exercised end-to-end without a
  real Internal Service. Confirmed end-to-end against a live broker. See `packages/idp/README.md`.
- Follow-ups: wider Developer Portal features (event type registration, delivery visibility, mock Consumer
  Endpoint) — see its README roadmap.

## webhook-delivery-worker
- Status: design only (README) — no code
- Branch: —
- Current chunk: —
- Summary: `packages/webhook-delivery-worker/README.md` documents the design; no `package.json` or `src/` yet.
- Follow-ups: scaffold via `new-worker-scaffold`, then `run-lane`.

## key-management
- Status: not started
- Branch: —
- Current chunk: —
- Summary: —
- Follow-ups: —
