# Commands

Verified working in this repo (npm workspaces root). Update this file whenever a script is added, renamed, or a
new package is scaffolded — it should always reflect commands that actually run, not aspirational ones.

## Root (all packages)

- `npm install` — installs dependencies for every workspace package.
- `npm run build` — runs each package's `build` script (`--workspaces --if-present`).
- `npm run lint` — runs the root ESLint flat config (`eslint.config.js`) over the whole repo.
- `npm run format` — checks Prettier formatting (`prettier --check .`); use `npx prettier --write .` to fix.
- `npm run test` — runs each package's `test` script (`--workspaces --if-present`).

## Single package (e.g. `webhook-api`)

Scope any root script to one workspace with `--workspace <path>` (or `-w <path>`):

- `npm run build --workspace packages/webhook-api`
- `npm run lint --workspace packages/webhook-api`
- `npm run test --workspace packages/webhook-api`
- `npm install -D <package> --workspace packages/webhook-api` — add a dev dependency to just that package.

## Inside `packages/webhook-api` directly

- `npx nest build` — type-check/build (NestJS CLI).
- `npx nest start --watch` — run the dev server with reload.
- `npx vitest run` — run the full unit test suite once.
- `npx vitest run --config ./vitest.config.e2e.ts` — run the e2e suite.
- `npx vitest run -t "<test name>"` — run tests matching a name pattern.
- `npx oxlint --type-aware src/ test/` — lint just this package (oxlint, not ESLint, per this package's own
  `.oxlintrc.json` — root `npm run lint` still covers the rest of the workspace via the root ESLint flat config).

## Not available yet

No `docker-compose.yml` or migration commands exist yet — the current `src/` is an early NestJS skeleton wired to
connect to MongoDB via `@nestjs/mongoose` (`MONGODB_URI` env var), but no schema/repository/use-case code has been
rebuilt against it (see `CLAUDE.md`'s Project status). Don't assume `npm run migrate` or a local DB works until
those are scaffolded. The prior Postgres-backed implementation (Express + Kysely + `node-pg-migrate`) has been
removed from the repo entirely, not kept for reference.
