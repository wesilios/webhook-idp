# Architecture rules (DDD / hexagonal)

## Repo shape

Single repo, Yarn 1.x (classic) workspaces — `yarn.lock` is the only lockfile, never `npm install` — one shared
MongoDB instance with a database (or collection namespace) per owning component. Each bounded-context package owns
exactly one database/namespace; other packages may *read* it (via a published read-model type from `shared-kernel`)
but must never write to a database/namespace they don't own.

```
node-webhook/
  package.json                    # yarn workspaces root (+ `yarn dev`, `yarn docker:*` scripts)
  tsconfig.base.json
  docker-compose.yml              # local stack: mongodb + rabbitmq + every app image
  scripts/dev.mjs                 # `yarn dev` local orchestrator
  packages/
    shared-kernel/                # EventType, SubscriptionId — kept minimal, grow only when 2+ packages need it
    webhook-api/                  # subscription CRUD REST API (NestJS; database: subscriptions)
      migrations/                 # index/seed setup scripts for the `subscriptions` database only, if/when needed
    event-ingestion-worker/       # database: inbox
    webhook-delivery-worker/      # database: delivery
    key-management/               # database: keys — used only by webhook-delivery-worker
    idp/                          # sandbox publisher (no database) — simulates an Internal Service
```

Migrations are **per-package**, not a single shared root folder — revised from the original plan once multi-agent
lanes made a shared `migrations/` directory a contention point (`.agent/rules/collaboration.md`). MongoDB is
schemaless, so a package's `migrations/` (when it needs one at all) is limited to index creation, validator setup,
and one-off data backfills scoped to that package's own database — never a structural migration of another
component's data. This keeps the "one MongoDB instance, database-per-owner" goal without any lane needing to touch
a file another lane also writes to.

**Storage note**: MongoDB was chosen over the earlier PostgreSQL plan specifically because inbox/delivery records
need to store the event body payload delivered to a Consumer Endpoint, and that payload's shape varies per event
type/publisher — a document store lets it be embedded as-is instead of forcing it through a fixed relational schema
(JSON column workarounds, migrations per new event shape, etc.).

## Layering (every package)

- `domain/` — one subfolder per bounded concept (e.g. `domain/subscription/`), each split into:
  - `aggregates/` — aggregate roots (e.g. `subscription.aggregate.ts`).
  - `entities/` — non-root entities with identity but not an aggregate root (create only when one is actually
    needed — don't add an empty folder speculatively).
  - `value-objects/` — value objects (`*.vo.ts` for validated wrapper types; a plain type alias like
    `subscription-status.ts` also belongs here).
  - `events/` — in-process domain events.
  - Domain errors (e.g. `subscription.errors.ts`) stay at the concept's root, not in a subfolder.
  - `domain/ports/*.port.ts` — interfaces, one level up (shared across the package's aggregates). Each port file
    also exports a `Symbol()` DI token colocated with the interface it binds (e.g. `CLOCK` next to `Clock` in
    `clock.port.ts`, `SUBSCRIPTION_REPOSITORY` next to `SubscriptionRepository` in
    `subscription-repository.port.ts`, `DOMAIN_EVENT_PUBLISHER` next to `DomainEventPublisher` in
    `domain-event-publisher.port.ts`) — the same string-token-for-DI-binding shape already used by
    `webhook/webhook.interface.ts`'s `WH_SERVICE_NAME`, just a `Symbol` instead of a plain string. `webhook-api` has
    three ports: `Clock`, `SubscriptionRepository`, and `DomainEventPublisher`
    (`publishAll(events: DomainEvent[]): Promise<void> | void`) — use-cases call
    `publisher.publishAll(aggregate.pullDomainEvents())` after `save()`; the port is bound later to an adapter built
    on `@nestjs/event-emitter`'s `EventEmitter2`, but application code only ever imports the port, never
    `@nestjs/event-emitter` directly. See [Dependency injection](#dependency-injection) for the binding mechanics.
  Zero imports from `@nestjs/*`, `mongodb`, `mongoose`, or any other infrastructure package — this is the one rule
  in this file that does not change with the NestJS migration.
- `application/use-cases/` — one `@Injectable()` class per use case (the decorator comes from `@nestjs/common`),
  constructor-injecting ports via `@Inject(TOKEN)`. Nest's DI decorators are the one framework import allowed here;
  application code must still never import infrastructure-specific packages (`mongoose`, `express`) or
  interface/http-layer code (DTOs, guards, decorators) — only domain ports/types plus `@nestjs/common`'s DI
  decorators. Plain `@Injectable()` classes are the current choice over `@nestjs/cqrs`'s `CommandBus`/`QueryBus`
  (the root README's original architecture sketch mentioned a "CQRS handler," and Create/Update/Delete/Pause/Resume
  as commands + Get/List as queries would be a natural fit) — for now the five use cases are straightforward enough
  that a bus adds indirection without payoff. Revisit `@nestjs/cqrs` if/when there's real read-model divergence or
  cross-aggregate sagas (e.g. the future delivery pipeline). Even if adopted later, use its bus only — never its
  `AggregateRoot`/`apply()` base class, since extending it would pull Nest decorators into `domain/`, breaking the
  framework-free rule above.
- `infrastructure/` — concrete adapters implementing ports (MongoDB repositories, etc.). For `webhook-api`:
  `@nestjs/mongoose` `@Schema()`/`@Prop()` classes + `SchemaFactory.createForClass()`, with
  `MongooseModule.forFeature()` registered per feature module — not on `AppModule`, which only owns the root
  connection via `MongooseModule.forRootAsync` — keeping database/namespace ownership modular, one collection per
  owning module. The repository adapter uses `@InjectModel()`, implements `SubscriptionRepository`, and owns the
  document↔aggregate mapping (rehydrating via `WebhookSubscription.restore()`) — this mapping is inherently custom,
  no Nest built-in replaces it.
- `interface/http/` (API packages) or `runtime/` (worker packages) — the thin, swappable "what triggers/serves the
  use case" layer: NestJS controllers/modules for `webhook-api`; a pm2/Docker entrypoint for workers (see
  `deployment.md`). For `webhook-api`, built on Nest's own extension points rather than hand-rolled plumbing:
  `class-validator`/`class-transformer` request DTOs validated by one global `ValidationPipe` (registered in
  `main.ts`); a `Guard` (`CanActivate`) resolving the Bearer JWT into `TenantId`/`ClientId`/`UserId` (replacing
  `resolveIdentity.middleware.ts`), paired with a `@CurrentIdentity()` `createParamDecorator` so controllers read
  resolved identity instead of the raw `request`; a global `ExceptionFilter` (`@Catch()`, via `APP_FILTER` or
  `app.useGlobalFilters()`) mapping `DomainError` subclasses (`domain/subscription/subscription.errors.ts`, each
  carrying a `code`) and application-layer errors (e.g. a not-yet-built `DuplicateSubscriptionError`) to HTTP status
  codes and the `ApiEnvelope` error shape; and a global response `Interceptor` (`NestInterceptor`) wrapping
  successful controller return values into `ApiEnvelope` automatically. Once that lands, controllers just return
  plain data or throw, and `src/base.controller.ts`'s `sendSuccess()`/`sendError()` becomes unnecessary — it is not
  removed yet, that's a later interface-layer chunk, this is just the documented plan.
- Composition root: **Nest's own module/DI system**, not a separate file — each feature module's
  `@Module({ providers: [...] })` array (e.g. `webhook/webhook.module.ts`) *is* the composition root. There is no
  `composition/` folder going forward; see [Dependency injection](#dependency-injection) below for the binding
  pattern.

Every use case ships with a unit test against an in-memory fake repository before any real MongoDB code is written
for it — either plain `new UseCase(fakeRepo, fakeClock, fakePublisher)` construction, or `@nestjs/testing`'s
`Test.createTestingModule` + `overrideProvider()` to substitute fakes for ports. Both are fine for a single
use-case class; the DI-container form earns its keep once a class has more than one collaborator to wire.

## Path aliases

Every package uses `@domain/*`, `@application/*`, `@infrastructure/*`, `@presentation/*` (mapped to `src/domain/*`
etc.) for imports that cross a layer boundary — there is no `@composition/*` alias, since there is no `composition/`
folder (see Layering above and Dependency injection below) — relative imports (`./`, `../`) stay for imports
within the same layer/folder. This needs three separate pieces of config kept in sync (there is no single source
of truth the others derive from — update all three when adding a package or a new top-level `src/` folder):

- `tsconfig.json`'s `compilerOptions.paths` — for type-checking and editor resolution. This TypeScript version
  deprecates `baseUrl`; omit it and give each `paths` target a leading `./` instead (e.g.
  `"@domain/*": ["./src/domain/*"]`) — without a `./` prefix, `tsc` rejects non-relative `paths` targets when
  `baseUrl` isn't set.
- `vitest.config.ts` needs no separate alias config in this package — it already uses the `vite-tsconfig-paths`
  plugin, which reads `tsconfig.json`'s `paths` automatically. A package without that plugin would need a manual
  `resolve.alias` instead, since vitest/Vite doesn't read `tsconfig.json` on its own.
- The package's `build` script must run `tsc-alias` after `nest build`: `nest build` type-checks and emits aliases
  fine but leaves the literal `@domain/...` specifier in the emitted `.js`, which plain Node can't resolve at
  runtime (confirmed by running the compiled output directly) — `tsc-alias -p tsconfig.build.json` (not
  `tsconfig.json` — it needs the build config's `rootDir`/`outDir` to compute correct relative paths) rewrites them
  post-build. `nest start`/`start:dev` (no separate build step) do not currently get this rewrite — aliases only
  resolve reliably through `build`/`start:prod` until a watch-mode alias rewrite is added, so avoid relying on an
  alias import anywhere that only `start:dev` would exercise until that's in place.

## Dependency injection

**NestJS's own module/DI system** (`@Injectable()`, `@Module()`, constructor injection), required project-wide —
this replaces the earlier Awilix-based composition-root approach used by the Express implementation, which has been
removed from the repo entirely, and there is no separate `composition/container.ts` file. Each feature module's
`@Module({ providers: [...] })` array *is* the composition root: infrastructure adapters and use-cases are
registered as providers on their owning `*.module.ts`; controllers/services resolve them via constructor injection,
never an ambient singleton/global import.

**Binding ports to adapters**: a `Symbol()` DI token lives colocated with each port interface in
`domain/ports/*.port.ts` — e.g.

```ts
// domain/ports/clock.port.ts
export interface Clock { now(): Date; }
export const CLOCK = Symbol('Clock');
```

— and is bound to a concrete adapter in the owning module's `providers`:

```ts
providers: [
  CreateSubscriptionUseCase,
  { provide: SUBSCRIPTION_REPOSITORY, useClass: MongooseSubscriptionRepository },
  { provide: CLOCK, useClass: SystemClock },
]
```

This is the same string-token-for-DI-binding shape already used by `webhook/webhook.interface.ts`'s
`WH_SERVICE_NAME` (bound in `webhook.module.ts`'s `providers`) — just a `Symbol` instead of a plain string, and
colocated with the port it binds rather than living in the consuming module's own interface file. Apply this
pattern to all three `webhook-api` ports (`CLOCK`, `SUBSCRIPTION_REPOSITORY`, `DOMAIN_EVENT_PUBLISHER`) and to any
port added later.

`reflect-metadata` and Nest decorators are an accepted cost project-wide **outside `domain/`** (they were
previously kept out of the whole hexagonal layer stack under the Awilix approach) — `application/`,
`infrastructure/`, and `interface/http/` code may import `@nestjs/common` (`@Injectable()`, `@Inject()`, etc.)
freely. `domain/` is the one layer this does not apply to, and that does not change with this migration: zero
imports from `@nestjs/*` or any other infrastructure package, full stop (see Layering above) — ports and their
tokens live in `domain/ports/` precisely so outer layers can depend inward on `domain/`, never the reverse.

## `webhook-api` domain model

Aggregate `WebhookSubscription`: `id` (UUIDv7), `tenantId` (ownership/isolation boundary — see `identity.md`),
`createdByClientId`, `createdByUserId` (nullable — audit metadata only, never used for access control), `targetUrl`
(HTTPS-only, SSRF-guarded value object), `subscribedEventTypes` (non-empty, validated against a known catalog),
`status` (`ACTIVE | PAUSED | DELETED`, soft-delete only, never a hard row delete), `createdAt`/`updatedAt`. State
transitions go through named methods (`pause()`, `resume()`, `delete()`), never a generic setter; `DELETED` is
terminal. Domain events (`SubscriptionCreated`, `SubscriptionPaused`, `SubscriptionResumed`, `SubscriptionDeleted`)
are in-process only, not published to the external Message Broker — use-cases hand them to the `DomainEventPublisher`
port after `save()` (see Layering above), which is bound to an `@nestjs/event-emitter` adapter, not a broker client.
Duplicate-check invariant is on
`(tenantId, targetUrl)`, not on client or user.

REST surface (`/api/v1/subscriptions`): `POST` create, `GET` list (paginated, filter by `status`/`eventType`,
scoped to the caller's tenant), `GET /:id`, `PATCH /:id` (update `eventTypes`/`targetUrl`/`status`), `DELETE /:id`
(soft-delete, idempotent — 204 even if already deleted). Auth is a Bearer JWT resolved per `identity.md`
(`tenant_id`/`client_id`/`sub` claims); every route is authorized by `TenantId`, not by `ClientId` or `UserId`.

## Key management boundary

`webhook-api` never generates, stores, returns, or logs signing key material — a `WebhookSubscription` has no key
field at all. Key generation/storage/rotation belongs entirely to `key-management`, consumed only by
`webhook-delivery-worker` at send time. How a Consumer Endpoint gets the public key to verify signatures is an open
question left to `key-management`'s own design — do not solve it inside `webhook-api`.

## Tech stack (`webhook-api`; same conventions apply to future packages unless noted otherwise)

- NestJS, TypeScript, ESM (`"type": "module"`), targeting Node `v22.19.0`+
- MongoDB as the datastore via `@nestjs/mongoose` — not Postgres, not the bare MongoDB driver. Root connection setup
  (`MongooseModule.forRootAsync`, reading `MONGODB_URI`) lives on `AppModule`; `MongooseModule.forFeature()` is
  registered per feature module instead (see Layering above). Repository adapters hand-map `@Schema()` documents
  to/from aggregates — no ORM auto-hydration of domain objects — kept behind a port like the old Kysely repository
  was
- a Mongo migration/index-setup tool (e.g. `migrate-mongo`) for index creation and data backfills, once needed —
  not `node-pg-migrate`
- `class-validator`/`class-transformer` DTOs validated by a single global `ValidationPipe` (registered once in
  `main.ts`) for request validation at the HTTP boundary — the settled choice, in place of hand-rolled zod
  middleware — re-validated inside aggregates/value objects regardless (HTTP validation is defense-in-depth; the
  domain layer is the source of truth for invariants)
- `@nestjs/testing`'s `Test.createTestingModule` + `overrideProvider()` where a DI-wired test is useful; plain
  constructor injection of fakes is equally fine for a single use-case class (see Layering above)
- vitest (unit) + supertest (integration, against a real dockerized MongoDB — no DB mocking, since
  uniqueness/status-transition invariants are worth testing against real constraints)
- oxlint (see the package's own `.oxlintrc.json`) + Prettier at the package level; root ESLint flat config +
  Prettier still cover the rest of the workspace
