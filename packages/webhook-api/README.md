# Webhook Management API

Subscription management for the Webhook Platform — the only component the **API Client** talks to (see the root
[`README.md`](../../README.md) for the full system context).

## Architecture

This package was rebuilt on **NestJS** against **MongoDB**, replacing the earlier Express + hexagonal/DDD + Awilix
+ Kysely/Postgres implementation, which has been **removed from the repo entirely** — no Postgres design is kept
around, not even for reference. MongoDB's document model fits storing variable-shaped event bodies better than a
fixed relational schema (see `CLAUDE.md`).

All four layers are built and wired end-to-end through NestJS's own module/DI system (Symbol-token ports bound in
`providers`, no separate `composition/` folder — see `.agent/rules/architecture.md`):

- **`domain/`** — framework-free (zero `@nestjs/*`/`mongoose` imports): the `WebhookSubscription` aggregate
  (`domain/subscription/aggregates/subscription.aggregate.ts`), its value objects (`SubscriptionId` — a real
  UUIDv7 via the `uuid` package —, `TenantId`, `ClientId`, `UserId`, `EventType`, `TargetUrl` with the 5-rule SSRF
  guard described below), domain errors (`subscription.errors.ts`), in-process domain events, and the
  `Clock`/`SubscriptionRepository`/`DomainEventPublisher` ports (`domain/ports/`, each exporting a `Symbol()` DI
  token colocated with its interface).
- **`application/`** — the five use-cases (`application/use-cases/*.usecase.ts`), plain NestJS `@Injectable()`
  classes (not `@nestjs/cqrs` — see `.agent/rules/architecture.md` for why), constructor-injecting the domain
  ports by token; `application/errors/` (`DuplicateSubscriptionError`, `SubscriptionNotFoundError` — cross-aggregate
  checks, so application-layer concerns, not domain invariants).
- **`infrastructure/`** — `SubscriptionMongoRepository` (`@nestjs/mongoose`, implements `SubscriptionRepository`,
  owns the document↔aggregate mapping via `WebhookSubscription.restore()`), `SystemClock`, and
  `EventEmitterDomainEventPublisher` (backed by `@nestjs/event-emitter`).
- **`presentation/`** — `SubscriptionsController` (all 5 REST endpoints), `class-validator`/`class-transformer`
  DTOs behind a global `ValidationPipe`, `IdentityGuard` + `@CurrentIdentity()`, `PaginationInterceptor` +
  `@Pagination()` (see note below), `TargetUrlMaskingInterceptor` (see note below), a global `DomainExceptionFilter`
  (`APP_FILTER`) mapping every domain/application error to the response envelope, and a global `EnvelopeInterceptor`
  (`APP_INTERCEPTOR`) wrapping every success response. `@nestjs/swagger` is wired up too — see "API docs" below.

**Pagination note**: `PaginationInterceptor` cannot default `page`/`pageSize` by mutating `request.query` — under
Express 5 (`@types/express` here), `req.query` is a read-only getter recomputed from the URL on every access, so an
assignment into it silently no-ops (confirmed by tracing a real request). It instead resolves pagination onto
`request.pagination`, read back via a `@Pagination()` param decorator — the same pattern `IdentityGuard`/
`@CurrentIdentity()` already uses for resolved identity.

**TargetUrl masking note**: every response that includes a subscription (`POST`/`GET`/`GET list`/`PATCH`/`DELETE`)
has `TargetUrl`'s hostname masked — subdomain labels fully replaced with asterisks, the domain label keeps a short
(≤3 char) prefix, the TLD is always exactly `**`, e.g. `https://api.hooks.destination.com/endpoint` becomes
something like `https://****.****.des***.**/endpoint`. The asterisk count is randomized per response so a
consistent mask length never itself hints at the real hostname's length. This is **display-only redaction** —
`TargetUrlMaskingInterceptor` (`presentation/common/interceptors/`) runs as a controller-level `@UseInterceptors()`,
which NestJS guarantees runs innermost (closer to the handler than the global `EnvelopeInterceptor`), so it masks
the raw `SubscriptionResponseDto`/`PaginatedSubscriptionsResponseDto` before envelope-wrapping; the real URL is
unchanged in MongoDB and in every internal use-case/repository call (including the duplicate-check query) — only
the JSON that leaves the process is obscured.


## Development

- `npm run build|lint|test --workspace packages/webhook-api` (from the repo root) — `build`/`start`/`start:dev` run
  through the NestJS CLI (`nest build` / `nest start`), `lint` runs `oxlint` (this package's own `.oxlintrc.json`,
  not the root ESLint config), `test`/`test:e2e` run through vitest.
- **Running the test suite**: unit tests (`vitest run`) need no database. Once a MongoDB-backed repository exists,
  its integration suite should start its own ephemeral MongoDB via `testcontainers` rather than requiring a
  manually-run `docker compose up`.
- **Running the server locally** (`npm run start:dev`) needs a real, running MongoDB instance and a `MONGODB_URI`
  env var (see `.env.example`; defaults to `mongodb://localhost:27017/webhook` if unset) — local MongoDB
  provisioning (Docker, Atlas, etc.) is up to you, this repo doesn't ship a `docker-compose.yml` for it.
- **API docs**: `@nestjs/swagger` is wired up (`main.ts`) — once the server is running, Swagger UI is at
  `/api/docs` and the raw OpenAPI JSON at `/api/docs-json`. Request DTOs (`CreateSubscriptionDto`,
  `UpdateSubscriptionDto`, `ListSubscriptionsQueryDto`) need no manual `@ApiProperty()` annotations — the
  `@nestjs/swagger` CLI plugin (`nest-cli.json`) infers their schema from the `class-validator` decorators already
  on them. Success responses are documented as the real `ApiEnvelope<T>`-wrapped shape (not the bare inner DTO) via
  a small `ApiEnvelopedResponse()` helper (`presentation/common/swagger/`), following Nest's own documented
  "generic response" recipe (`allOf` + `ApiExtraModels` + `getSchemaPath`) — otherwise the docs would describe a
  shape the API doesn't actually return, since every response passes through the global `EnvelopeInterceptor`.

## Analysis

**Responsibility.** Owns the lifecycle of a `WebhookSubscription`: create, list, get, update (event types / target
URL / status), and delete. Nothing else — it does not ingest events, does not deliver webhooks, and does not touch
signing keys (see [Key management boundary](#key-management-boundary)).

**Why it exists.** Root feature #1 ("Webhook subscription management — Restful API: GET/POST/DELETE") requires a
control-plane surface the API Client can call to register interest in event types and manage that registration over
time, independent of whether any events have flowed yet.

**Actors.**

- **API Client** (external) — an authenticated caller (an OAuth client, optionally acting on behalf of a user)
  managing subscriptions for its tenant. See [Authentication](#authentication) for how identity is resolved.
- **Webhook Delivery Worker** (internal, different package) — _reads_ subscription data (target URL, event types,
  status) to know where and what to deliver. It never writes here.

**Non-functional constraints that shape the design:**

- _Stateless_: no in-memory session/request state; every request is fully resolved from the bearer token and the
  database. Lets the container scale horizontally with no sticky sessions.
- _Idempotent delete_: deleting an already-deleted subscription returns the same `200` rather than `404`, so
  retries from flaky API Client networking are always safe.
- _Fail-closed validation_: HTTP-layer (zod, or Nest's `class-validator`/`class-transformer` DTO pipes) and
  domain-layer (aggregate invariants) validation are both mandatory — the HTTP layer rejects malformed input early,
  the domain layer is the source of truth invariants are enforced against regardless of how the call was made
  (HTTP today, an internal call later).

### Key management boundary

`webhook-api` never generates, stores, returns, or logs signing key material — there is no key field anywhere on
`WebhookSubscription`. Key generation, storage and rotation belong entirely to the separate `key-management`
component, consumed only by the Webhook Delivery Worker at send time. How a Consumer Endpoint eventually gets the
public key to verify signatures is intentionally left to `key-management`'s own design, not solved here.

### Domain model

Aggregate `WebhookSubscription`:

| Field                     | Type                       | Notes                                                                          |
| ------------------------- | -------------------------- | ------------------------------------------------------------------------------ |
| `id`                      | `SubscriptionId` (UUIDv7)  |                                                                                |
| `tenantId`                | `TenantId`                 | ownership/isolation boundary — every list/get/update/delete is scoped to this  |
| `createdByClientId`       | `ClientId`                 | which OAuth client created it — audit metadata, not access control             |
| `createdByUserId`         | `UserId` \| `null`         | which human user created it, if any — null for machine-to-machine calls        |
| `targetUrl`               | `TargetUrl` (value object) | HTTPS-only, SSRF-guarded — see [Target URL validation](#target-url-validation) |
| `subscribedEventTypes`    | `EventType[]`              | non-empty, each validated against the known event catalog                      |
| `status`                  | `SubscriptionStatus`       | `ACTIVE \| PAUSED \| DELETED`                                                  |
| `createdAt` / `updatedAt` | `Date`                     |                                                                                |

### Target URL validation

Applies to `targetUrl` on both `POST /subscriptions` and `PATCH /subscriptions/:id`. Checks run in order; the
first violated rule is reported (with the matching `ErrorCode` in the [envelope](#response-envelope)'s `Errors`):

| #   | Rule                                                                                                                                                                                                       | `ErrorCode`                |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| 1   | Must be ≤ 2048 characters                                                                                                                                                                                  | `URL_TOO_LONG`             |
| 2   | Must parse as an absolute URL                                                                                                                                                                              | `INVALID_URL_FORMAT`       |
| 3   | Scheme must be exactly `https:` — `http:`, `ftp:`, etc. are rejected                                                                                                                                       | `HTTPS_REQUIRED`           |
| 4   | Must not contain userinfo (`https://user:pass@host/...`)                                                                                                                                                   | `CREDENTIALS_NOT_ALLOWED`  |
| 5   | Hostname must not be `localhost`, a loopback/private/link-local/unique-local address, or the unspecified address (`0.0.0.0`/`::`) — see the exact ranges in `src/interface/http/validation/privateHost.ts` | `PRIVATE_HOST_NOT_ALLOWED` |

Rule 5 explicitly rejects the `169.254.169.254` link-local range, which covers the AWS/GCP/Azure cloud-metadata
endpoint — the single most common real-world SSRF target.

**This is a static check on the literal hostname/IP in the URL — it does not perform a DNS lookup.** A domain that
resolves to a public IP today but is later repointed to an internal address (DNS rebinding) will pass this check.
That gap is intentional: a lookup here adds latency and a new failure mode (DNS timeout/outage blocking subscription
creation) to a synchronous API call, and still wouldn't stop rebinding after creation. The **authoritative** SSRF
defense — resolve-then-check-IP immediately before connecting, limit/disable redirects, re-check on every attempt —
belongs to the Webhook Delivery Worker at delivery time, not here, since that's the component that actually opens
the connection.

State transitions only happen through named aggregate methods (`pause()`, `resume()`, `delete()`) — never a generic
setter — so an invalid transition throws a domain error instead of silently corrupting state:

```mermaid
stateDiagram-v2
    [*] --> ACTIVE: create()
    ACTIVE --> PAUSED: pause()
    PAUSED --> ACTIVE: resume()
    ACTIVE --> DELETED: delete()
    PAUSED --> DELETED: delete()
    DELETED --> [*]
    note right of DELETED
        Terminal. delete() on an
        already-DELETED subscription
        is a no-op (idempotent).
    end note
```

A cross-aggregate check (needs a query, not a pure invariant) rejects/warns on a duplicate `(tenantId, targetUrl)`
pair.

## API design

### Authentication

Callers send a Bearer JWT (`Authorization: Bearer <token>`). Auth middleware verifies the token and resolves three
claims — the same mapping used across the whole system, never reinvented per-package:

| Claim       | Resolves to | Required?                                |
| ----------- | ----------- | ---------------------------------------- |
| `tenant_id` | `TenantId`  | yes — missing/invalid token is `401`     |
| `client_id` | `ClientId`  | yes                                      |
| `sub`       | `UserId`    | no — absent on machine-to-machine tokens |

**Authorization is TenantId-scoped**: every route operates on `TenantId`, so any caller authenticated for a tenant
can manage that tenant's subscriptions regardless of which `client_id`/`sub` originally created them. `ClientId`
and `UserId` are recorded on the aggregate purely for audit (see [Domain model](#domain-model)) and never gate
access. A request for a subscription belonging to a different tenant returns `404` (not `403`), consistent with the
"not found / not owned" handling below — existence isn't leaked across tenants.

> **Current implementation status**: the presentation layer built so far resolves identity from plain
> `x-tenant-id` / `x-client-id` / `x-user-id` headers instead of verifying a real Bearer JWT — a deliberate
> stand-in so the HTTP layer and its integration tests could be built and run before a token verifier exists.
> Swapping in real JWT verification only touches `resolveIdentity.middleware.ts`; nothing downstream changes.

### Response envelope

Every response — success or error — is wrapped in the same envelope, and **all keys, at every level (envelope and
`Data` payload alike), are PascalCase**:

```json
{
  "Data": null,
  "StatusCode": 200,
  "Code": "string",
  "Message": "string",
  "Errors": [{ "ErrorCode": "string", "ErrorMessage": "string" }]
}
```

| Field        | Type                      | Notes                                                                                                               |
| ------------ | ------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `Data`       | object \| array \| `null` | the payload; `null` on error                                                                                        |
| `StatusCode` | integer                   | mirrors the HTTP status code of the response                                                                        |
| `Code`       | string                    | machine-readable outcome code, e.g. `OK`, `VALIDATION_ERROR`, `SUBSCRIPTION_NOT_FOUND`, `INVALID_STATUS_TRANSITION` |
| `Message`    | string                    | human-readable summary                                                                                              |
| `Errors`     | array                     | empty on success; one or more `{ ErrorCode, ErrorMessage }` items on error (e.g. one per failed validation field)   |

**Why `DELETE` returns `200`, not `204`**: HTTP `204 No Content` forbids a response body, which conflicts with the
"every response is wrapped in an envelope" rule — some HTTP clients/proxies strip a body sent with `204` even if
present. `DELETE` therefore returns `200` with `Data` set to the (now `DELETED`) subscription, keeping the envelope
contract exception-free.

### Endpoints

Base path: `/api/v1/subscriptions`.

| Method   | Path                 | Description                                                                             | Success | Errors                                                                          |
| -------- | -------------------- | --------------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------- |
| `POST`   | `/subscriptions`     | Create a subscription                                                                   | `201`   | `400` invalid body/targetUrl/eventType, `409` duplicate `(tenantId, targetUrl)` |
| `GET`    | `/subscriptions`     | List the caller's tenant's subscriptions, paginated, filterable by `status`/`eventType` | `200`   | `400` invalid query                                                             |
| `GET`    | `/subscriptions/:id` | Get one subscription                                                                    | `200`   | `404` not found / different tenant                                              |
| `PATCH`  | `/subscriptions/:id` | Update `eventTypes`, `targetUrl`, and/or `status`                                       | `200`   | `400` invalid body, `404` not found, `409` invalid status transition            |
| `DELETE` | `/subscriptions/:id` | Soft-delete (idempotent)                                                                | `200`   | `404` not found / different tenant                                              |

All request bodies use camelCase (`targetUrl`, `eventTypes`, `status`) — only _responses_ are PascalCase, per the
[Response envelope](#response-envelope) contract.

**POST /subscriptions** request:

```json
{
  "targetUrl": "https://client.example.com/webhooks/inbound",
  "eventTypes": ["order.created", "order.shipped"]
}
```

response (`201`):

```json
{
  "Data": {
    "Id": "0193f2b4-8f2a-7c31-9a0e-2c8f0a4d9b10",
    "TargetUrl": "https://client.example.com/webhooks/inbound",
    "EventTypes": ["order.created", "order.shipped"],
    "Status": "ACTIVE",
    "CreatedAt": "2026-09-20T12:00:00.000Z",
    "UpdatedAt": "2026-09-20T12:00:00.000Z"
  },
  "StatusCode": 201,
  "Code": "OK",
  "Message": "Created",
  "Errors": []
}
```

**GET /subscriptions** query params: `?status=ACTIVE&eventType=order.created&page=1&pageSize=20`, response `Data`
is a paginated envelope: `{ "Items": [...], "Page": 1, "PageSize": 20, "Total": 3 }`.

**PATCH /subscriptions/:id** request (any subset of fields, still camelCase):

```json
{ "status": "PAUSED" }
```

**Error response** (e.g. an invalid status transition, `409`):

```json
{
  "Data": null,
  "StatusCode": 409,
  "Code": "INVALID_STATUS_TRANSITION",
  "Message": "Cannot update a deleted subscription",
  "Errors": [
    {
      "ErrorCode": "INVALID_STATUS_TRANSITION",
      "ErrorMessage": "Cannot update a deleted subscription"
    }
  ]
}
```

## Sequence diagrams

### Create subscription

```mermaid
sequenceDiagram
    actor Client as API Client
    participant HTTP as NestJS Controller
    participant MW as IdentityGuard
    participant Val as ValidationPipe (DTO)
    participant UC as CreateSubscription UseCase
    participant Agg as WebhookSubscription (domain)
    participant Repo as MongoSubscriptionRepository
    participant DB as Webhook DB (subscriptions database)
    participant Pub as DomainEventPublisher

    Client->>HTTP: POST /api/v1/subscriptions {targetUrl, eventTypes}
    HTTP->>MW: resolve x-tenant-id/x-client-id/x-user-id -> TenantId/ClientId/UserId
    MW-->>HTTP: request.identity (or 401)
    HTTP->>Val: validate request body (CreateSubscriptionDto)
    Val-->>HTTP: parsed DTO (or 400)
    HTTP->>UC: execute({tenantId, createdByClientId, createdByUserId, targetUrl, eventTypes})
    UC->>Repo: findByTenantAndTargetUrl(tenantId, targetUrl)
    Repo-->>UC: existing? (409 DuplicateSubscriptionError if found)
    UC->>Agg: WebhookSubscription.create(...)
    Agg-->>UC: aggregate (or throws InvalidTargetUrlError / InvalidEventTypeError -> 400)
    UC->>Repo: save(aggregate)
    Repo->>DB: findOneAndUpdate({_id}, doc, {upsert: true})
    DB-->>Repo: ok
    Repo-->>UC: ok
    UC->>Pub: publishAll(aggregate.pullDomainEvents())
    UC-->>HTTP: WebhookSubscription aggregate (use-cases return the aggregate, not a DTO)
    HTTP->>HTTP: map to SubscriptionResponseDto (toSubscriptionResponseDto)
    HTTP-->>Client: 201 Created + enveloped subscription JSON (via global EnvelopeInterceptor)
```

### Update status (invalid transition)

```mermaid
sequenceDiagram
    actor Client as API Client
    participant HTTP as NestJS Controller
    participant UC as UpdateSubscription UseCase
    participant Repo as MongoSubscriptionRepository
    participant Agg as WebhookSubscription (domain)

    Client->>HTTP: PATCH /api/v1/subscriptions/:id {status: "ACTIVE"}
    HTTP->>UC: execute(id, tenantId, patch)
    UC->>Repo: findByIdAndTenant(id, tenantId)
    Repo-->>UC: aggregate (status=DELETED)
    UC->>Agg: aggregate.resume()
    Agg-->>UC: throws InvalidStatusTransitionError
    UC-->>HTTP: domain error
    HTTP-->>Client: 409 Conflict
```

### Delete subscription (idempotent)

```mermaid
sequenceDiagram
    actor Client as API Client
    participant HTTP as NestJS Controller
    participant UC as DeleteSubscription UseCase
    participant Repo as MongoSubscriptionRepository

    Client->>HTTP: DELETE /api/v1/subscriptions/:id
    HTTP->>UC: execute(id, tenantId)
    UC->>Repo: findByIdAndTenant(id, tenantId)
    alt not found or different tenant
        Repo-->>UC: null
        UC-->>HTTP: SubscriptionNotFoundError
        HTTP-->>Client: 404
    else found (any status, including already DELETED)
        Repo-->>UC: aggregate
        UC->>UC: aggregate.delete() — no-op (no new event) if already DELETED
        UC->>Repo: save(aggregate)
        Repo-->>UC: ok
        UC->>UC: publishAll(aggregate.pullDomainEvents()) — empty batch if it was already DELETED
        UC-->>HTTP: aggregate (status DELETED)
        HTTP-->>Client: 200 OK (envelope, Data = subscription with status DELETED)
    end
```

## Container diagram (scoped to this component)

Full platform L1/L2 diagrams (all containers) live in the root [`README.md`](../../README.md). This is the same
L2 model filtered to just this container and its direct dependencies:

```mermaid
  C4Container
    title Container diagram (scoped) - Webhook Management API

    System_Ext(ApiClient, "API Client", "External system that manages its webhook subscriptions via the platform")

    Container_Boundary(webhook_management, "Webhook Platform") {
      Container(webhook_api, "Webhook Management API", "NestJS, Docker Container", "Provides webhook subscription management via REST API")
      ContainerDb(database, "Webhook DB", "MongoDB", "subscriptions database - owned by this component")
    }

    Rel(ApiClient, webhook_api, "Uses", "HTTPS")
    Rel(webhook_api, database, "Read/write webhook subscriptions", "MongoDB Wire Protocol")

    UpdateRelStyle(ApiClient, webhook_api, $offsetY="60", $offsetX="90")
    UpdateRelStyle(webhook_api, database, $offsetY="-20", $offsetX="10")
```

Not shown here (see root README for these): the Webhook Delivery Worker, Event Ingestion Worker, Key Management,
Message Broker, and Consumer Endpoint — none of them are direct dependencies of this container.

## Reference

- Root [`README.md`](../../README.md) — project introduction, features, how to use, developer guideline.
- Root [`architecture.md`](../../architecture.md) — full event-flow diagram and C4 L1/L2 for the whole platform,
  problem statement, and design rationale.
- `.agent/rules/architecture.md` — repo shape, layering, and the `subscriptions` database ownership rule.
- `.agent/rules/deployment.md` — per-component Dockerfile/deploy pipeline for this package.
- `.agent/rules/terminology.md` — canonical naming used throughout this README.
- `.agent/rules/identity.md` — the `TenantId`/`ClientId`/`UserId` identity model referenced under
  [Authentication](#authentication).
