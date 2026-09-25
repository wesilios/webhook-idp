# Deployment & CI rules

- **Testing is shared**: one CI workflow runs lint + unit + integration tests across all workspace packages on
  every push/PR, reusing shared test infra (e.g. a MongoDB service container).
- **Deployment is per-component, never shared**: `webhook-api`, `event-ingestion-worker`, and
  `webhook-delivery-worker` each get their own `Dockerfile` and their own deploy workflow, triggered by path
  filters (e.g. only deploy `webhook-api` when `packages/webhook-api/**` or `shared-kernel` changed).
  `event-ingestion-worker` and `webhook-delivery-worker` pipelines must stay independent of each other — they scale
  and release independently in production even though they share a repo and a test run.
- **Worker runtime is a thin, swappable adapter**: each worker's triggering mechanism (a pm2 script, a Docker
  entrypoint, and eventually a cloud-function handler for AWS Lambda / Azure Function) only calls into
  application-layer use-cases — no business logic lives in the entrypoint file itself. This lets a worker move from
  pm2/Docker to a cloud function later by swapping only that one file, not the domain/application code underneath.

## Deployment target tradeoffs

pm2, standalone Docker, and Kubernetes all run the **same artifact** — the long-running consumer/worker process
described above. Only the orchestrator around it changes; the entrypoint file doesn't. A serverless **Cloud
Function** (AWS Lambda / Azure Function) is the exception, not a drop-in swap: the platform invokes it per-batch
instead of running a persistent poll/consume loop, so it needs a *structurally different* entrypoint (e.g.
`runtime/lambda-handler.ts`), not just a different deploy config.

Staged path — don't jump straight to the heaviest option:

1. **pm2, locally** — the default while a package's domain/application/infrastructure layers are still being built;
   fastest iteration, already the local dev story.
2. **Docker image via a managed container service** (ECS Fargate / Cloud Run / Azure Container Apps) for the first
   real deploy — same image Kubernetes would use later; gets rolling deploys + autoscaling without operating a
   cluster. A bare `docker run` on a VM has the same manual-scaling/rollback gap as pm2, just containerized — the
   managed service is what actually buys you autoscaling and rollback.
3. **Kubernetes** only once it's deliberately worth it — either a real ops/HPA-vs-KEDA learning goal, or enough
   components running that shared-cluster economics make sense. Its scaling story is the strongest (HPA, or KEDA
   for queue-depth-aware autoscaling matching each worker's "autoscale on broker lag" strategy), but it carries the
   highest baseline operational cost even managed (control plane, node pools, RBAC/ingress) — disproportionate for
   a single small worker at this project's current scale.
4. **Cloud Function** only after the cloud message broker is settled on AWS SQS or Azure Service Bus specifically —
   both have native serverless triggers (Lambda event-source-mapping / Azure Function Service Bus trigger).
   RabbitMQ has no native serverless trigger, so this option doesn't apply until that broker decision is made, and
   even then it needs the separate entrypoint noted above — plus it has the weakest local/prod parity of the four,
   since nothing about running a Lambda handler resembles `yarn dev` locally.
