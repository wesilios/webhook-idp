# Lane status

Durable handoff log for multi-agent work (see `.agent/rules/collaboration.md`). Not a live lock — the coordinator
sequences spawns, so update this when a lane's status changes, not continuously.

## webhook-api
- Status: rebuilding on NestJS/MongoDB (superseding the entry below)
- Branch: `chore/webhook_api/migrate_solution_to_nestjs`
- Current chunk: 1/5 — Domain done
- Summary: the previously-merged full DDD stack (see the superseded entry below) has been **removed from the repo
  entirely** — no Postgres design is kept, even for reference. `webhook-api` starts from an early NestJS skeleton
  (`AppModule`, stub `WebhookModule`/`WebhooksController`, shared `ApiEnvelope` response contract), wired to
  connect to MongoDB via `@nestjs/mongoose` (`MongooseModule.forRootAsync` in `app.module.ts`, `MONGODB_URI` env
  var) — nothing persisted yet, no repository adapter. The domain layer (chunk 1) is now rebuilt, framework-free,
  under `src/domain/`: the `WebhookSubscription` aggregate (`subscription/aggregates/subscription.aggregate.ts`,
  `create`/`restore`/`pause`/`resume`/`delete`/`updateTargetUrl`/`updateSubscribedEventTypes`, in-process domain
  events via `pullDomainEvents()`), value objects (`SubscriptionId` using `uuid`'s `v7()` — resolves the earlier
  "v4 vs v7" follow-up — `TenantId`, `ClientId`, `UserId`, `EventType`, `TargetUrl` with the same 5-rule
  SSRF-guard as the removed implementation), domain errors (`subscription.errors.ts`), and ports
  (`ports/clock.port.ts`, `ports/subscription-repository.port.ts`). File names follow this NestJS skeleton's
  kebab-case convention (`app.controller.ts`, `webhook.service.ts`), not the old implementation's PascalCase
  filenames. 46 unit tests passing (colocated `*.spec.ts`,
  not a separate `tests/` tree — matches this NestJS skeleton's existing convention), `nest build` and oxlint both
  clean, zero `@nestjs/*`/`mongodb`/`mongoose`/`express` imports under `src/domain/` (verified by grep, per the
  `ddd-boundary-check` skill). See `packages/webhook-api/README.md`'s "Implementation status" section.
- Follow-ups: build chunk 2 (Application: use-cases in `application/use-cases/`, depending only on the domain
  ports); then chunk 3 (Infrastructure: a Mongoose- or driver-backed `SubscriptionRepository` implementation, plus
  any index-setup/migration tooling — e.g. `migrate-mongo` — decision still open); `EventType` catalog validation
  is still intentionally deferred (documented in `EventType.vo.ts`, no catalog exists yet); local MongoDB
  provisioning (docker-compose or otherwise) is being set up separately, outside this repo's current tooling.

<details>
<summary>Superseded (code removed from repo): prior Express/Postgres full DDD build</summary>

- Current chunk: 5/5 — done
- Summary: full DDD stack built via the chunked implementer/tester pattern and independently re-verified by the
  coordinator at every step (including two direct-review fixes: rescoping the migration-tracking table off the
  shared `public` schema in chunk 3, and dropping `index.ts`'s dead `createApp` re-export in chunk 4). 136 tests
  passing (103 new since the walking skeleton), all clean from a fresh `npm install`. `MockSubscriptionsStore` is
  gone — the HTTP layer ran on the real `WebhookSubscription` aggregate, the five use-cases, and
  `PostgresSubscriptionRepository`.
- Follow-ups (none blocking, all pre-existing or newly surfaced during this run):
  - `SubscriptionId.generate()` uses `crypto.randomUUID()` (UUIDv4), not UUIDv7 as `architecture.md`/README
    document (Node has no built-in v7 generator — would need the `uuid` package's `v7()` or a manual impl). Needs
    a decision: add a dependency for v7, or update the docs to say v4.
  - `EventType` has no catalog validation yet (intentionally deferred, documented in the code itself) —
    `architecture.md` says event types should validate against "a known catalog" that doesn't exist in this
    project yet.
  - The HTTP layer's `zod`-based `targetUrl` validation (`interface/http/validation/`) still duplicates the
    domain's `TargetUrl` VO rules rather than delegating to it — both were kept as defense-in-depth per
    `architecture.md`, but they're two hand-maintained copies of the same 5 rules now. Worth a future cleanup pass
    to have the HTTP layer call the domain and only catch its errors, rather than re-validating independently.
  - `npm audit` reports 4 moderate transitive vulnerabilities (`uuid` <11.1.1, via `dockerode` <- `testcontainers`
    10.22-11.14 <- `@testcontainers/postgresql`) — dev/test-only dependency chain, not part of the shipped app.
    Fixing needs `testcontainers` 12.x, which requires Node >=22.22 (this environment has 22.19.0). Deferred until
    the Node version is bumped.

</details>

## event-ingestion-worker
- Status: not started
- Branch: —
- Current chunk: —
- Summary: —
- Follow-ups: —

## webhook-delivery-worker
- Status: not started
- Branch: —
- Current chunk: —
- Summary: —
- Follow-ups: —

## key-management
- Status: not started
- Branch: —
- Current chunk: —
- Summary: —
- Follow-ups: —
