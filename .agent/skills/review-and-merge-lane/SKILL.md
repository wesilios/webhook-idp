---
name: review-and-merge-lane
description: "Integrate a finished lane's worktree back into main once every chunk is green"
---

# Skill: review-and-merge-lane

**Purpose**: integrate a finished lane's worktree back into `main` once every chunk (per `run-lane`) is green.

**When to use**: after a lane's Docs chunk is complete and `.agent/status.md` shows all chunks done.

**Procedure**:
1. Read the full diff for the lane's worktree/branch against `main`.
2. Re-run build, lint, and the full test suite for the lane (`.agent/rules/commands.md`) from a clean state — not
   just trusting each chunk's earlier green run.
3. Check the diff against `.agent/rules/terminology.md` (no reintroduced old/ambiguous names),
   `.agent/rules/architecture.md` (layering, DI via NestJS modules, database/namespace ownership, key-management
   boundary), and run the `ddd-boundary-check` skill (no domain-layer imports of infrastructure packages, no
   cross-database writes).
4. If clean, merge the lane's branch into `main`.
5. Update `.agent/status.md`: mark the lane `merged`, note any deferred follow-ups (e.g. "needs the real
   key-management adapter once that lane merges" for a lane that used a mock cross-lane dependency).
6. Clean up the worktree.
