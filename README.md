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

**Prerequisites**

- Node.js `v22.22.3` (see `.nvmrc`)
- npm (workspaces — this is a monorepo, not a package split across separate repos)
- A MongoDB instance you control the connection string for — this repo does not ship a `docker-compose.yml` yet, so
  provision one yourself (local Docker, MongoDB Atlas, etc.)

**Setup**

```bash
git clone <this repo>
cd node-webhook
npm install          # installs all workspace packages from the root
```

**Running a package locally** — each package has its own `.env.example` and `start:dev` script:

```bash
cd packages/<package-name>
cp .env.example .env
npm run start:dev      # from the repo root: npm run start:dev --workspace packages/<package-name>
```

`webhook-api` and `idp` also serve Swagger UI at `/api/docs` once running. See each package's own README for its
exact env vars, API surface, and any external dependencies it needs (MongoDB, a running RabbitMQ, etc.).

**Workspace-wide commands** (from the repo root, run across every package that defines the script):

```bash
npm run build   # npm run build --workspaces --if-present
npm run lint    # eslint . (root config) — packages may also define their own stricter oxlint config
npm run test    # npm run test --workspaces --if-present
```

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
`.agent/rules/`. All direction, review, and decisions are mine; this note is here for transparency, and because
learning to work effectively _with_ an AI assistant is itself part of what this project is practicing.
