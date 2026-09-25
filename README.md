# Webhook Service

Centralized Webhook Delivery Service Management — a platform that sits inside a foundation/shared service in a
microservice architecture, letting external clients subscribe to internal system events and receive real-time
delivery of those events over HTTP webhooks.

## Purpose

This is a personal learning project — the goal is to practice core NestJS concepts (modules, DI, guards,
interceptors, pipes, microservice transports) and deepen general Node.js/TypeScript fluency, using a realistic
system design as the vehicle instead of a toy CRUD app. The domain chosen for that is a webhook delivery platform
built as **microservices in an event-driven architecture (EDA)**: a control-plane subscription API kept decoupled
from a data-plane ingestion/delivery pipeline, the two sides only ever talking through a durable inbox/outbox in
MongoDB — never a direct call.

This project is built with the help of an AI coding assistant (Claude Code) as part of the workflow — pairing on
design docs, scaffolding, and implementation. See [Built with AI assistance](#built-with-ai-assistance) below.

## Features

1. **Webhook subscription management** — a RESTful API (`GET`/`POST`/`PATCH`/`DELETE`) for an external API Client
   to create, list, update, and delete its own webhook subscriptions.
2. **Durable event ingestion** — events are pulled off a message broker and persisted as durable Inbox records
   before any delivery is attempted, independent of the broker's own durability guarantees. This is what makes
   audit history, troubleshooting, delivery status, retry visibility, operational reporting, and manual replay
   possible after the fact.
3. **Signed, retried, idempotent delivery** — outgoing webhook requests are signed with asymmetric cryptography
   (RSA/ECDSA, header-attached, not a shared-secret HMAC), retried on failure with tracked attempt history, and
   safe to retry or redeliver without double-processing on either side.
4. **Developer Portal** — a sandbox API (`packages/idp`) simulating an Internal Service publisher; see
   [Roadmap](#roadmap).

## Architecture overview

The system is split into two logically decoupled concerns: the **Webhook Management API** (control plane) and a
two-stage **delivery pipeline** — an Event Ingestion Worker (durable inbox) feeding a Webhook Delivery Worker pool
(signs and sends). Full C4 diagrams, the event-flow diagram, the underlying problem statement, design rationale,
and current-vs-target state per component live in **[`architecture.md`](architecture.md)** — kept out of this
README so the two documents don't mix "what is this and how do I run it" with "why is it shaped this way, and
what's built so far."

## How to use (quickstart)

### Prerequisites

- Node.js `v22.22.3` (`nvm use` picks it up from `.nvmrc`)
- Yarn `1.22.x` (classic) — the monorepo uses **Yarn workspaces**; don't mix in `npm install` (there is no
  `package-lock.json`, `yarn.lock` is the only lockfile)
- Docker with Docker Compose v2 — for MongoDB/RabbitMQ, or to run the whole stack in containers

### 1. Install

```bash
git clone <this repo>
cd <repo>
nvm use
yarn install          # installs every workspace package from the root (also sets up the husky pre-commit hook)
```

### 2. Configure each app

Every runnable package has its own `.env.example`. Copy it once:

```bash
for p in webhook-api event-ingestion-worker idp; do cp -n packages/$p/.env.example packages/$p/.env; done
```

The defaults already fit together: distinct HTTP ports (`webhook-api` → 4321, `idp` → 4322), MongoDB on
`localhost:27017`, RabbitMQ on `localhost:5672`, and the same `RABBIT_MQ_QUEUE` (`webhook.events`) for the `idp`
publisher and the `event-ingestion-worker` consumer.

### 3a. Run everything on the host — `yarn dev` (recommended for development)

```bash
yarn dev              # start every app in watch mode
```

`yarn dev` doesn't start MongoDB or RabbitMQ itself. It only needs them to be reachable at the addresses in each
package's `.env` (by default `localhost:27017` and `localhost:5672`). Run them however suits your machine: a
systemd `mongod`, your own RabbitMQ container, or `yarn infra:up` to start both from `docker-compose.yml`. The
status report shows whether each one is reachable.

`yarn dev` (`scripts/dev.mjs`) finds every workspace package that has a `start:dev` script and starts them
together, so it picks up new packages without extra config. Each log line starts with the app's name, and once the
apps are up it prints a status report:

```text
━━━ Apps ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  APP                      KIND     STATE     ENDPOINT                       SWAGGER                          PID
  event-ingestion-worker   worker   running   no HTTP listener               —                                31777
  idp                      http     ready     http://localhost:4322          http://localhost:4322/api/docs   31781
  webhook-api              http     ready     http://localhost:4321/api/v1   http://localhost:4321/api/docs   31788

━━━ Dependencies ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  SERVICE    ADDRESS           STATUS      USED BY
  MongoDB    localhost:27017   reachable   event-ingestion-worker, webhook-api
  RabbitMQ   localhost:5672    reachable   event-ingestion-worker, idp
```

- **Only some apps**: `yarn dev webhook-api idp`
- **While it's running**: type `s` + Enter to reprint the status, `q` + Enter or Ctrl+C to stop every app.
  Afterwards a one-line notice reports each state change (for example, an app restarting after a watch-mode
  rebuild, or exiting).
- **Before starting**, it stops with an error if two apps are set to the same `PORT`. It skips any app whose port is
  already taken, and warns if an app has no `.env` (it falls back to `.env.example`).
- **How it works out each app**: an app is `http` if its `src/main.ts` calls `.listen(`. Its port is `PORT` from the
  package `.env`. The Swagger and API-prefix paths are also read from `main.ts`. HTTP apps are `ready` once their
  port accepts connections.
- **Stop the infra** afterwards with `yarn infra:down` (data is kept in Docker volumes).

### 3b. Run everything in Docker — `yarn docker:up`

```bash
yarn docker:up        # build all images and start infra + apps (waits until healthy)
yarn docker:ps        # what's running, and on which ports
yarn docker:logs      # follow logs of every container
yarn docker:down      # stop and remove the containers (add -v to also drop the data volumes)
```

| Service | Host address | Notes |
|---|---|---|
| `webhook-api` | http://localhost:4321/api/v1 — Swagger at `/api/docs` | |
| `idp` | http://localhost:4322 — Swagger at `/api/docs` | `POST /sandbox` publishes a test event |
| `event-ingestion-worker` | — | no HTTP listener; consumes `webhook.events` |
| MongoDB | `mongodb://localhost:27017` | database per component (`subscriptions`, `inbox`, …) |
| RabbitMQ | `amqp://localhost:5672`, management UI http://localhost:15672 | `guest` / `guest` |

The host ports match the `.env.example` defaults, so 3a and 3b are interchangeable — just don't run both at once.
Inside Docker the apps use service names (`mongodb`, `rabbitmq`) instead of `localhost`; that config lives in
`docker-compose.yml`, not in the package `.env` files. Each package has its own `Dockerfile` (built from the repo
root, since it needs the shared `yarn.lock`), which is the same image a per-component deployment would use.

### Try the pipeline end-to-end

With either option running, publish a sandbox event through `idp` and watch `event-ingestion-worker` store it as an
Inbox record:

```bash
curl -X POST http://localhost:4322/sandbox \
  -H 'Content-Type: application/json' \
  -d '{"tenantId":"tenant-1","eventType":"order.created","payload":{"orderId":"123"}}'
```

See `packages/idp/README.md` for the envelope contract, and each package's own README for its env vars and API
surface.

### Workspace-wide commands

Run from the repo root:

```bash
yarn build            # yarn workspaces run build — nest build (+ tsc-alias) in every package
yarn test             # yarn workspaces run test — vitest unit suites, no database needed
yarn lint             # root ESLint flat config over the whole repo
yarn lint:packages    # each package's own oxlint config
yarn format           # prettier --check .
```

To target one package: `yarn workspace <name> <script>` (e.g. `yarn workspace webhook-api test:e2e`), or run
`yarn <script>` inside `packages/<name>`. Add a dependency to one package with
`yarn workspace <name> add <dep>` (`-D` for dev dependencies).

## Developer guideline (local)

- **Naming**: use the canonical component names in `.agent/rules/terminology.md` everywhere — code, docs, commit
  messages, diagrams. A few old/ambiguous names (e.g. "Delivery Manager") are explicitly retired there because
  they caused real confusion.
- **Code conventions**: DDD/hexagonal layering (`domain/application/infrastructure/presentation` or `runtime`),
  path aliases, dependency injection pattern, and per-package tech stack are documented in
  [`.agent/rules/architecture.md`](.agent/rules/architecture.md) — read that before adding code to any package.
- **Testing**: unit tests run against in-memory fakes and need no database; integration tests run against a real
  MongoDB (via `testcontainers`, not a mocked DB) — see `webhook-api`'s README for the concrete commands.
- **Linting/formatting**: each package may define its own `oxlint` config; the root ESLint flat config + Prettier
  cover everything else in the workspace.
- **Deployment/CI**: one shared CI workflow lints/tests every package on each push; deployment is per-component
  (each package gets its own Dockerfile and deploy pipeline, triggered by path filters) — see
  [`.agent/rules/deployment.md`](.agent/rules/deployment.md).

## Considerations

A short list of the non-functional constraints that shape every package's design — see `architecture.md`'s
[Design constraints](architecture.md#design-constraints) table for the full rationale behind each:

- **Durability over broker reliance** — delivery state lives in MongoDB, never trusted to the message broker alone.
- **Security** — outgoing webhooks are signed with asymmetric crypto (RSA/ECDSA) in a header, not shared-secret HMAC.
- **Idempotency** — both event ingestion and delivery retries must be safe to repeat without double-processing.
- **Statelessness** — every process (API, workers) is horizontally scalable; all durable state lives in the DB.

## Roadmap

**Core** (the webhook platform itself — see [Architecture overview](#architecture-overview) and each package's own
README):

1. [`webhook-api`](packages/webhook-api/README.md) — Webhook Management API: lets an external client (API Client)
   subscribe to/manage the events it wants notified about.
2. [`event-ingestion-worker`](packages/event-ingestion-worker/README.md) — pulls events off the Message Broker and
   durably persists them as Inbox records.
3. [`webhook-delivery-worker`](packages/webhook-delivery-worker/README.md) — polls due deliveries, signs, and POSTs
   them to each subscriber's Consumer Endpoint.

**IDP** (Internal Developer Platform):

4. [`idp`](packages/idp/README.md) — **Sandbox API**, started ahead of the original "defer until the three core
   packages are further along" plan, since it's small, decoupled, and directly useful for exercising
   `event-ingestion-worker` on its own. A `POST /sandbox` endpoint builds a valid event envelope (validated +
   documented via Swagger) and publishes it onto the Message Broker — a real end-to-end trigger through
   ingestion, not just a validated no-op. See that package's own Roadmap for what's next.
5. **Developer Portal** — still exploratory, no design commitments yet. The fuller platform-engineering-style
   portal for _internal_ service teams (not the external API Client) to:
   - register the event types their service publishes and the shape of each event's payload
   - debug/view webhook events as they flow through the system (ingestion → delivery → outcome), for a given event
     or subscription
   - sandbox / mock-test a webhook delivery against a fake Consumer Endpoint before going live

   Part of the learning goal is figuring out, as I go, whether this portal should generate Terraform (or other
   IaC) to provision event types/subscriptions, and what else would meaningfully improve the developer experience
   for internal teams onboarding onto the platform.

## Reference

- **[`architecture.md`](architecture.md)** — problem statement, C4 diagrams, event flow, design rationale,
  current-vs-target state, and a running lessons-learned log.
- **[`.agent/rules/`](.agent/rules)** — contributor/agent conventions: `architecture.md` (code-level layering/DI),
  `deployment.md` (CI/deploy), `identity.md`, `terminology.md` (canonical naming), `collaboration.md`, `commands.md`.
- **Package READMEs**: [`webhook-api`](packages/webhook-api/README.md),
  [`event-ingestion-worker`](packages/event-ingestion-worker/README.md),
  [`webhook-delivery-worker`](packages/webhook-delivery-worker/README.md), [`idp`](packages/idp/README.md).

## Built with AI assistance

This project uses an AI coding assistant (Claude Code) throughout — for drafting design docs like this one and
`architecture.md`, scaffolding package structure, and implementing code against the conventions in
`.agent/rules/`. Agent guidance lives in tool-agnostic files, `AGENT.md` and `.agent/` (rules + skills). If you
use Claude Code, run `yarn setup:claude` once: it creates gitignored local symlinks (`CLAUDE.md`,
`.claude/skills`) so Claude Code picks them up. All direction, review, and decisions are mine; this note is here
for transparency, and because learning to work effectively _with_ an AI assistant is itself part of what this
project is practicing.
