# syntax=docker/dockerfile:1
# Build from the repo root so the Yarn workspace lockfile applies:
#   docker build -f packages/event-ingestion-worker/Dockerfile -t event-ingestion-worker .
# (docker-compose.yml at the repo root does this for you.)

ARG NODE_VERSION=22.22.3

# ---- deps: install every workspace's dependencies against the shared yarn.lock ----
FROM node:${NODE_VERSION}-alpine AS deps
WORKDIR /repo
COPY package.json yarn.lock ./
# Every workspace manifest is needed so `--frozen-lockfile` sees the same workspace graph as yarn.lock.
COPY packages/webhook-api/package.json packages/webhook-api/
COPY packages/event-ingestion-worker/package.json packages/event-ingestion-worker/
COPY packages/idp/package.json packages/idp/
RUN yarn install --frozen-lockfile --ignore-scripts --non-interactive

# ---- build: compile this package only ----
FROM deps AS build
COPY packages/event-ingestion-worker packages/event-ingestion-worker
RUN yarn workspace event-ingestion-worker run build

# ---- prod-deps: production dependencies only ----
FROM deps AS prod-deps
RUN yarn install --frozen-lockfile --ignore-scripts --non-interactive --production \
  && mkdir -p packages/event-ingestion-worker/node_modules

# ---- runtime ----
FROM node:${NODE_VERSION}-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /repo
COPY --from=prod-deps /repo/node_modules ./node_modules
COPY --from=prod-deps /repo/packages/event-ingestion-worker/node_modules ./packages/event-ingestion-worker/node_modules
COPY --from=build /repo/packages/event-ingestion-worker/package.json ./packages/event-ingestion-worker/package.json
COPY --from=build /repo/packages/event-ingestion-worker/dist ./packages/event-ingestion-worker/dist
WORKDIR /repo/packages/event-ingestion-worker
USER node
CMD ["node", "dist/main.js"]
