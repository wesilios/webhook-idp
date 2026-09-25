---
name: ddd-boundary-check
description: "Review pass catching domain-layer infrastructure imports and packages writing to a database they don't own, before merging changes to domain/, infrastructure/, or migrations"
---

# Skill: ddd-boundary-check

**Purpose**: a review pass that catches the most common violations of `../rules/architecture.md` before they land:
domain-layer files importing infrastructure packages, and a package writing to a schema it doesn't own.

**When to use**: before merging any change that touches `domain/`, `infrastructure/`, or a migration file.

**Procedure**:
1. Search every changed file under `packages/*/src/domain/**` for imports of `@nestjs/*`, `mongodb`, `mongoose`,
   or any other framework/infrastructure package. Flag any match.
2. Search every changed migration/index-setup file for operations targeting a database/collection namespace other
   than the one owned by the package that added the file. Flag any match.
3. Check that no `WebhookSubscription`-related code in `webhook-api` references key material — that boundary
   belongs to `key-management` only.
4. Report findings; do not auto-fix silently — the fix (e.g. moving a class, adding a port) is a design decision
   for a human or a follow-up task.
