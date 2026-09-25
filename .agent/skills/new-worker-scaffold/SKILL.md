---
name: new-worker-scaffold
description: "Scaffold a new script-based worker package (event-ingestion-worker, webhook-delivery-worker, key-management) following the deployment runtime conventions"
---

# Skill: new-worker-scaffold

**Purpose**: scaffold a new script-based worker package (`event-ingestion-worker`, `webhook-delivery-worker`, or
`key-management`) consistent with the `../rules/deployment.md` runtime conventions.

**When to use**: starting implementation of one of the three deferred packages.

**Procedure**:
1. Create `packages/<worker>/` with the same `domain/application/infrastructure` layering as `webhook-api`
   (`../rules/architecture.md`) — no framework in domain/application.
2. Add a `runtime/` folder instead of `interface/http/`: a `pm2-entrypoint.ts` and a `docker-entrypoint.ts`, both
   thin adapters that only call application-layer use-cases.
3. Add the package's own `Dockerfile` and a pm2 ecosystem entry.
4. Add a migration establishing the package's owned schema (via `add-migration`).
5. Add the package's own deploy workflow, scoped by path filter, independent from the other workers'
   (`../rules/deployment.md`).
