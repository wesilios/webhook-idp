---
name: scaffold-use-case
description: "Generate a new hexagonal use case with a passing unit test for an existing aggregate in a bounded-context package"
---

# Skill: scaffold-use-case

**Purpose**: generate a new use case for a bounded-context package following the hexagonal pattern in
`../rules/architecture.md`, so every use case starts with the same shape and a passing unit test.

**When to use**: adding a new operation to an existing aggregate (e.g. a new `PauseSubscription` use case).

**Inputs**: package name (e.g. `webhook-api`), aggregate name (e.g. `Subscription`), use-case name (e.g.
`PauseSubscription`).

**Procedure**:
1. Create `packages/<package>/src/application/use-cases/<UseCase>.usecase.ts` — a class taking its dependencies
   (ports only, e.g. `SubscriptionRepository`) via constructor injection.
2. If the use case needs a new port, add it to `packages/<package>/src/domain/ports/`.
3. Create `packages/<package>/tests/unit/application/<UseCase>.usecase.spec.ts` using an in-memory fake
   implementation of the port(s) — no real MongoDB.
4. Register the use case in `packages/<package>/src/composition/container.ts`.
5. Wire an HTTP route/controller (API packages) or runtime entrypoint call (worker packages) only after the unit
   test passes.
