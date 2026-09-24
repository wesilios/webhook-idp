# Skill: local-env-up

**Purpose**: bring up a working local dev environment for `webhook-api` in one step.

**When to use**: starting local development or running integration tests.

**Procedure**:
1. `docker compose up -d mongodb` (from the repo root `docker-compose.yml`).
2. Run pending migrations/index setup for the `subscriptions` database: `npm run -w packages/webhook-api migrate`.
3. Seed a test API Client / API key for local auth (the `clients` lookup referenced in
   `../rules/architecture.md`'s REST surface notes).
4. Confirm readiness with `npm run -w packages/webhook-api test:integration`.
