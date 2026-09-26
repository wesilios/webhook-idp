# AGENT.md

Guidance for AI coding agents working in this repository. `AGENT.md` and `.agent/` are the only committed agent
files. Claude Code users run `yarn setup:claude` once, which creates gitignored local symlinks
(`CLAUDE.md` → `AGENT.md`, `.claude/skills` → `.agent/skills`) so Claude Code loads these docs and skills.

## Read first

`.agent/` is the source of truth for project rules — read the relevant files before changing code:

- `.agent/agent.md` — role, index of rules and skills
- `.agent/rules/terminology.md` — the only allowed names for each component (API Client, Consumer Endpoint,
  Message Broker, Event Ingestion Worker, Webhook Delivery Worker, Key Management, Webhook DB). Never use the retired
  names ("Delivery Manager", "Webhook Worker Pool", "Client External Service", …).
- `.agent/rules/architecture.md` — DDD/hexagonal layering, NestJS DI, path aliases, database-per-owner rule
- `.agent/rules/identity.md` — JWT claim mapping; all access control is `TenantId`-scoped
- `.agent/rules/commands.md` — build/lint/test commands
- `.agent/rules/deployment.md` — per-component deploys, thin swappable worker runtime
- `.agent/rules/collaboration.md` — multi-agent lanes and the chunked implementer/tester handoff
- `.agent/status.md` — per-lane progress log; update it when a lane's status changes

Reusable procedures live in `.agent/skills/<name>/SKILL.md`. Edit them there, never through the symlinks.

## What this is

A centralized Webhook Delivery Service for a microservice platform: API Clients manage subscriptions, Internal
Services publish events onto a Message Broker, and the platform durably records and delivers signed webhooks to
Consumer Endpoints. See `README.md` for the event flow and C4 diagrams.

## Packages (Yarn workspaces under `packages/`)

| Package | State | Notes |
|---|---|---|
| `webhook-api` | built (all 4 layers) | NestJS REST API, `/api/v1/subscriptions`; MongoDB database `subscriptions`; Swagger at `/api/docs` |
| `event-ingestion-worker` | built | NestJS application context (no HTTP listener); consumes RabbitMQ, writes idempotent Inbox records to MongoDB (`inbox`); layers `domain/application/infrastructure/runtime` |
| `idp` | sandbox | `POST /sandbox` publishes a hand-built event envelope to RabbitMQ to exercise the ingestion worker end-to-end |
| `webhook-delivery-worker` | README/design only | no code yet |
| `key-management` | not started | owns signing keys; only consumed by `webhook-delivery-worker` |

Each package's `README.md` has its detailed design and implementation status.

## Architecture essentials

- **Layers per package**: `domain/` (framework-free — zero `@nestjs/*`, `mongoose`, `mongodb`, `express` imports),
  `application/use-cases/` (`@Injectable()` classes injecting domain ports by `Symbol` token),
  `infrastructure/` (Mongoose repositories, broker adapters), and `presentation/` (APIs) or `runtime/` (workers).
- Ports live in `domain/ports/*.port.ts` with a colocated `Symbol()` DI token; bindings happen in each module's
  `providers` — Nest modules are the composition root.
- Cross-layer imports use aliases (`@domain/*`, `@application/*`, `@infrastructure/*`, `@presentation/*`,
  `@runtime/*`); keep `tsconfig.json` `paths` and the `tsc-alias` post-build step in sync. Aliases don't resolve
  under `start:dev`, only via `build`/`start:prod`.
- ESM (`"type": "module"`): relative imports use the `.js` extension.
- Durability lives in MongoDB, never the broker; consumption and delivery must be idempotent; processes are
  stateless; outgoing webhooks are signed with asymmetric keys (RSA/ECDSA), never HMAC.
- Every HTTP app exposes an unauthenticated `GET /versionz` at the root, outside any global prefix, returning its
  service name and the `VERSION` env var (`"unknown"` if unset). Add it to any new HTTP package.
- A package writes only to its own database (`subscriptions`, `inbox`, `delivery`, `keys`).
- `webhook-api` never touches signing key material.

## Commands

Node `22.22.3` (`.nvmrc`), **Yarn 1.x classic workspaces** — `yarn.lock` is the only lockfile; never use npm.
Full list in `.agent/rules/commands.md`. Root:

- `yarn dev [app...]` — start every app (or the named ones) in watch mode with per-app log prefixes and a status
  table (URL/port, Swagger, pid, MongoDB/RabbitMQ reachability) — `scripts/dev.mjs`
- `yarn infra:up` / `yarn infra:down` — MongoDB + RabbitMQ only, in Docker (for `yarn dev`)
- `yarn docker:up` / `docker:ps` / `docker:logs` / `docker:down` — the whole stack in Docker (`docker-compose.yml`)
- `yarn build` / `yarn test` — every workspace; `yarn lint` — root ESLint; `yarn lint:packages` — per-package
  oxlint; `yarn format` — Prettier check
- Husky pre-commit runs `lint-staged` (ESLint on staged JS/TS)

Per package: `yarn workspace <name> <script>` (or `yarn <script>` inside the package):

- `build` — `nest build && tsc-alias -p tsconfig.build.json` (`idp` has no `tsc-alias` step)
- `test` — `vitest run` (unit specs are colocated `*.spec.ts`); single test: `yarn vitest run -t "<name>"`
- `test:e2e` — `vitest run --config ./vitest.config.e2e.ts`
- `lint` — `oxlint --type-aware src/ test/`
- `start:dev` — `nest start --watch`

## Local environment

Copy each package's `.env.example` to `.env`; defaults interlock (`webhook-api` :4321, `idp` :4322, MongoDB
`localhost:27017`, RabbitMQ `localhost:5672`, queue `webhook.events` shared by `idp` and `event-ingestion-worker`).
Every HTTP app needs a distinct `PORT` — `yarn dev` refuses to start on a clash. Each deployable package has its own
`Dockerfile` built from the repo root; adding a workspace package means adding its `package.json` `COPY` line to
every Dockerfile's `deps` stage.
