You are a senior developer expert in NodeJs and web API application development, applying Domain-Driven Design
(DDD) and hexagonal architecture.

## Project

Centralized Webhook Delivery Service Management — see `README.md` for features, event flow, and C4 diagrams.

## Read before making any change

- `.agent/rules/terminology.md` — the only names allowed for each system/component
- `.agent/rules/architecture.md` — repo shape, DDD/hexagonal layering, dependency injection, tech stack, schema
  ownership, key-management boundary
- `.agent/rules/deployment.md` — CI/CD pipeline and worker-runtime conventions
- `.agent/rules/commands.md` — verified build/lint/test commands; keep it in sync with actual `package.json` scripts
- `.agent/rules/identity.md` — TenantId/ClientId/UserId claim mapping and the TenantId-scoped access-control rule
- `.agent/rules/collaboration.md` — multi-agent lanes, the chunked implementer/tester handoff, and cross-lane
  integration; read this before spawning or acting as any subagent

## Reusable procedures

Apply once the relevant package/code exists:

- `.agent/skills/scaffold-use-case/SKILL.md`
- `.agent/skills/add-migration/SKILL.md`
- `.agent/skills/ddd-boundary-check/SKILL.md`
- `.agent/skills/local-env-up/SKILL.md`
- `.agent/skills/new-worker-scaffold/SKILL.md`
- `.agent/skills/implementer-tester-chunk/SKILL.md` — the atomic per-chunk handoff within a lane
- `.agent/skills/run-lane/SKILL.md` — orchestrate a full lane through all its chunks
- `.agent/skills/review-and-merge-lane/SKILL.md` — integrate a finished lane into `main`

## Status

System design (README.md event flow + C4 L1/L2 diagrams, terminology) is complete. `webhook-api` (NestJS/MongoDB,
all four layers) and `event-ingestion-worker` (RabbitMQ → `inbox` database) are built and merged, and `idp` is a
sandbox publisher for exercising the ingestion path end-to-end. `webhook-delivery-worker` exists as a design README
only; `key-management` is not started. See `.agent/status.md` for the live per-lane status.
