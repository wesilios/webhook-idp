---
name: implementer-tester-chunk
description: "Atomic two-subagent handoff for one lane chunk: an implementer writes one layer's production code, then a fresh tester subagent writes its tests"
---

# Skill: implementer-tester-chunk

**Purpose**: the atomic two-subagent handoff used for every chunk of a lane (see
`.agent/rules/collaboration.md`'s chunk order) — one layer of code, built by one subagent, tested by a different,
freshly-spawned subagent.

**When to use**: for each of a lane's chunks 1–4 (Domain, Application, Infrastructure: data access & migration,
Composition + interface/runtime). Not used for chunk 5 (Docs), which has no separate tester step.

**Inputs**: lane name, chunk name, the lane's worktree path, the specific layer/files in scope for this chunk.

**Procedure**:
1. **Implementer spawn**: a fresh subagent, prompted with (a) a pointer to `.agent/agent.md` to read first, (b) the
   lane's responsibilities and owned schema from `.agent/rules/architecture.md`, (c) the exact chunk scope — which
   directory/layer it may create or edit, explicitly excluding tests and every other layer, (d) the worktree path to
   work in. It reports back the list of files it created/changed and any decisions/assumptions made.
2. **Verify before handoff**: confirm the implementer's chunk builds/lints (`.agent/rules/commands.md`) — a chunk
   with no tests yet can still fail to compile or lint, and that must be caught before spawning the tester.
3. **Tester spawn**: a *new* subagent (no shared context with the implementer), prompted with the same
   `.agent/agent.md` pointer, the worktree path, and the exact file list from step 1. Its scope is tests only — no
   production-code edits — following the test approach for that layer (`architecture.md`: pure unit tests for
   Domain; unit tests against in-memory fakes for Application; integration tests against a real dockerized MongoDB
   for Infrastructure; end-to-end tests through the fully-wired entrypoint for Composition + interface/runtime).
4. **Verify after handoff**: run build/lint/test for the chunk; only once green does the lane move to the next
   chunk. Update `.agent/status.md`'s "Current chunk" field for the lane.
