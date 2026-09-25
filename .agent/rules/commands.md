# Commands

Verified working in this repo (Yarn 1.x classic workspaces root — `yarn.lock` is the only lockfile; never run
`npm install`). Update this file whenever a script is added, renamed, or a new package is scaffolded — it should
always reflect commands that actually run, not aspirational ones.

## Root (all packages)

- `yarn install` — installs dependencies for every workspace package (and the husky pre-commit hook).
- `yarn dev [app...]` — local orchestrator (`scripts/dev.mjs`): starts every workspace with a `start:dev` script
  (or only the named ones) in watch mode, prefixes logs per app, and prints a status table (kind, state,
  URL/port, Swagger, pid) plus MongoDB/RabbitMQ reachability. Refuses duplicate `PORT`s. `s`+Enter reprints
  status, `q`+Enter / Ctrl+C stops everything.
- `yarn setup:claude` — creates the gitignored local symlinks Claude Code needs (`CLAUDE.md` → `AGENT.md`,
  `.claude/skills` → `.agent/skills`); idempotent.
- `yarn build` / `yarn test` — `yarn workspaces run build|test` (every workspace must define the script).
- `yarn lint` — root ESLint flat config (`eslint.config.js`) over the whole repo; `yarn lint:packages` — each
  package's own oxlint.
- `yarn format` — `prettier --check .`; use `yarn prettier --write .` to fix.

## Docker (`docker-compose.yml`, root)

- `yarn infra:up` / `yarn infra:down` — only MongoDB (27017) + RabbitMQ (5672, UI 15672), for use with `yarn dev`.
- `yarn docker:up` — build every package image and start infra + apps (`--wait` for health); `yarn docker:ps`,
  `yarn docker:logs`, `yarn docker:down`.
- Each deployable package has its own `Dockerfile`, built from the repo root:
  `docker build -f packages/<name>/Dockerfile -t <name> .`. When adding a workspace package, add its
  `package.json` `COPY` line to the `deps` stage of every package Dockerfile (needed for `--frozen-lockfile`).

## Single package

- `yarn workspace <name> <script>` — e.g. `yarn workspace webhook-api test:e2e`.
- `yarn workspace <name> add [-D] <dep>` — add a (dev) dependency to just that package.

## Inside a package directly (`webhook-api`, `event-ingestion-worker`, `idp`)

- `yarn build` — `nest build` then `tsc-alias -p tsconfig.build.json` to rewrite path aliases (`idp` has no
  aliases, so its `build` is just `nest build`). Plain `nest build` leaves `@domain/...` specifiers unresolvable
  at runtime.
- `yarn start:dev` — run the app with reload (reads the package's `.env`).
- `yarn test` — full unit suite once (`vitest run`); `yarn test:e2e` — the e2e suite;
  `yarn vitest run -t "<test name>"` — tests matching a name.
- `yarn lint` — `oxlint --type-aware src/ test/` (this package's own `.oxlintrc.json`; root `yarn lint` still covers
  the rest of the workspace via ESLint).

## Not available yet

No migration commands exist — indexes currently come from the Mongoose schemas, not a migration tool. Don't assume
`yarn migrate` works until one is scaffolded.
