---
name: add-migration
description: "Scaffold a new Mongo migration/index-setup file pre-filled with the calling package's owned database/namespace"
---

# Manage migration

**Purpose**: scaffold a new Mongo migration/index-setup file pre-filled with the calling package's owned
database/namespace, so ownership rules (`../rules/architecture.md`) aren't violated by accident.

**When to use**: a package needs a new index, validator, or one-off backfill in its own database.

**Inputs**: package name, migration description.

## **Procedure**:

1. Confirm the package's owned database/namespace (`subscriptions` for `webhook-api`, `inbox` for
   `event-ingestion-worker`, `delivery` for `webhook-delivery-worker`, `keys` for `key-management`).
2. Add a new file to `packages/<package>/migrations/` via the project's Mongo migration tool (e.g. `migrate-mongo
create <description>`) (per-package, not a shared root folder — see `../rules/architecture.md`).
3. Scope every operation (index creation, validator, backfill) to that database/namespace — never touch another
   component's data.
4. Run the migration locally against the `local-env-up` MongoDB before committing.
