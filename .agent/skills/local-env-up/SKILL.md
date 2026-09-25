---
name: local-env-up
description: "Bring up the local dev environment (MongoDB, RabbitMQ and every app) via yarn dev or docker compose"
---

# Skill: local-env-up

**Purpose**: bring up a working local dev environment for every app in one step.

**When to use**: starting local development, or reproducing an issue end-to-end (`idp` → RabbitMQ →
`event-ingestion-worker` → MongoDB).

**Procedure**:
1. `yarn install` at the repo root (Yarn 1.x workspaces — never npm).
2. For each app without one, `cp packages/<name>/.env.example packages/<name>/.env` (defaults interlock; keep
   HTTP `PORT`s distinct).
3. Pick one:
   - **Host (watch mode)**: `yarn infra:up` (MongoDB + RabbitMQ, waits for healthy), then `yarn dev` (or
     `yarn dev <app...>`). Confirm the status table shows every HTTP app `ready` and both dependencies
     `reachable`.
   - **All in Docker**: `yarn docker:up`, then `yarn docker:ps`.
4. Smoke test: `POST http://localhost:4322/sandbox` with `{"tenantId":"t1","eventType":"order.created","payload":{}}`
   and check `event-ingestion-worker` logs the ingest.
5. Tear down with Ctrl+C (`yarn dev`) plus `yarn infra:down`, or `yarn docker:down`.

**Not yet available**: no migration script (indexes come from Mongoose schemas) and no seeded auth fixtures —
`webhook-api` requests need a Bearer JWT carrying `tenant_id`/`client_id` (see `../../rules/identity.md`).
