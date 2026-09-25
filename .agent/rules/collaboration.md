# Multi-agent collaboration

**Model**: a coordinator session spawns Claude Code subagents via the `Agent` tool with `isolation: "worktree"`, one
git worktree per lane. Subagents start with zero shared context — they only know what's in their spawn prompt and
what they read from the repo, so every prompt must point at `.agent/agent.md` first.

## Lanes

A lane is one package under `packages/*` (`webhook-api`, `event-ingestion-worker`, `webhook-delivery-worker`,
`key-management`), or a "platform" lane for root-level/shared changes. A lane's subagents only create/edit files
under its own `packages/<lane>/` directory (plus its own `README.md`). `shared-kernel`, root config, and `.agent/`
itself are platform-owned — changed by the coordinator directly, or a dedicated platform-only subagent, never run
concurrently with package lanes, since they touch files every lane depends on.

## Chunked implementer/tester handoff (within a lane)

Work inside a lane is never one monolithic subagent building the whole package — it's a sequence of small chunks,
each layer-sized, in this standard order (mirrors `architecture.md`'s layering):

1. **Domain (DDD)** — aggregate(s), value objects, domain errors, `domain/ports/*.port.ts`. No framework imports.
2. **Application** — use-cases in `application/use-cases/`, depending only on the domain's ports.
3. **Infrastructure: data access & migration** — the MongoDB repository adapter implementing the port(s), plus any
   index-setup/migration file(s) for the lane's owned database/namespace.
4. **Composition + interface/runtime** — NestJS module wiring (providers/imports), and the lane's entrypoint (HTTP
   controller for an API-style package, or a `runtime/` script entrypoint for a worker package per
   `deployment.md`).
5. **Docs** — the package's own `README.md`, following `packages/webhook-api/README.md`'s structure. No separate
   tester step.

For chunks 1–4: an **implementer** subagent writes production code only (no tests) for that one layer and reports
which files it created/changed. A **new, separate** tester subagent is then spawned — scoped to exactly those files
— to write tests only (no production-code edits), in the same lane worktree so it can see and extend the
implementer's exact files. The coordinator confirms build/lint/test are green (`.agent/rules/commands.md`) before
starting the next chunk. See `.agent/skills/implementer-tester-chunk/SKILL.md` and `.agent/skills/run-lane/SKILL.md`.

Keeping each chunk to one layer — not the whole package — makes each handoff small enough for the tester to fully
cover and gives the coordinator a natural point to catch scope drift early.

## Cross-lane dependencies are mocked, not imported, during parallel work

If lane B needs something from lane A that may not exist yet (e.g. `webhook-delivery-worker` needs signing keys
from `key-management`), B defines its own port for what it needs and builds against a local fake adapter — the same
pattern already used in `webhook-api` (`src/interface/http/mock/MockSubscriptionsStore.ts`). Wiring the real adapter
once both lanes exist is a separate follow-up integration step, never assumed inside a chunk.

## Cross-lane integration

Lanes are built in parallel; merges into `main` happen one at a time. Before merging a lane: check its full diff
against `terminology.md`, `architecture.md`, and the `ddd-boundary-check` skill, then merge and record the outcome
in `.agent/status.md`. See `.agent/skills/review-and-merge-lane/SKILL.md`.
