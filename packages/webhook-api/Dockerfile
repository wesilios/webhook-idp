# syntax=docker/dockerfile:1
# Build from the repo root so the Yarn workspace lockfile applies:
#   docker build -f packages/webhook-api/Dockerfile -t webhook-api .
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
COPY packages/webhook-api packages/webhook-api
RUN yarn workspace webhook-api run build

# ---- prod-deps: production dependencies only ----
FROM deps AS prod-deps
RUN yarn install --frozen-lockfile --ignore-scripts --non-interactive --production \
  && mkdir -p packages/webhook-api/node_modules

# ---- runtime ----
FROM node:${NODE_VERSION}-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /repo
COPY --from=prod-deps /repo/node_modules ./node_modules
COPY --from=prod-deps /repo/packages/webhook-api/node_modules ./packages/webhook-api/node_modules
COPY --from=build /repo/packages/webhook-api/package.json ./packages/webhook-api/package.json
COPY --from=build /repo/packages/webhook-api/dist ./packages/webhook-api/dist
WORKDIR /repo/packages/webhook-api
USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
