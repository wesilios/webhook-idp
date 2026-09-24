# Skill: run-lane

**Purpose**: orchestrate a full package lane from nothing to a merge-ready worktree, by driving the standard chunk
order through repeated `implementer-tester-chunk` handoffs.

**When to use**: starting work on one of the not-yet-built lanes (`event-ingestion-worker`,
`webhook-delivery-worker`, `key-management`), or resuming one that's partway through (check
`.agent/status.md` first for its current chunk).

**Procedure**:
1. Check `.agent/status.md` — confirm the lane isn't already in progress elsewhere. If resuming, pick up at the
   recorded "Current chunk."
2. If starting fresh: create the lane's worktree (spawn the chunk-1 implementer with `isolation: "worktree"`, or
   open one directly — either way, record the branch/path in `.agent/status.md` once known). All subsequent
   subagents for this lane are pointed at that same worktree path so work accumulates in one place.
3. Run `implementer-tester-chunk` for chunk 1 (Domain), then chunk 2 (Application), then chunk 3 (Infrastructure:
   data access & migration), then chunk 4 (Composition + interface/runtime) — in that order, verifying green before
   each advance, updating `.agent/status.md`'s "Current chunk" after every handoff.
4. Chunk 5 (Docs): write (or have the coordinator write) the lane's `README.md` following
   `packages/webhook-api/README.md`'s structure (Analysis, contract design, diagrams). No tester step.
5. Once all 5 chunks are done, hand off to `.agent/skills/review-and-merge-lane.md` for integration into `main`.
