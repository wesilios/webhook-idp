# Terminology

Use these names everywhere — code, docs, diagrams, commit messages, variable/container IDs. Never reintroduce the
old/ambiguous names on the right; they caused real confusion (e.g. two different "Client...Subscri..." names for two
different roles, and a component called "Delivery Manager" that never delivered anything).

| Term | Role | Old names it replaces |
|---|---|---|
| **API Client** | External system that calls the Webhook Management API to create/list/update/delete its own webhook subscriptions. Control-plane touchpoint. | "Client External Service", `ClientService`, "User Client Service" |
| **Consumer Endpoint** | External HTTP endpoint that the Webhook Delivery Worker sends the signed webhook request to. Data-plane touchpoint — often the same customer as the API Client, but a distinct technical role. | "Client External Subscriber Service", `SubscriberClientService`, "Subscribed Client Service" |
| **Internal Service** | Our own internal microservice that publishes domain events onto the Message Broker. | (unchanged) |
| **Message Broker** | RabbitMQ / Azure Service Bus / AWS SQS — transport only, never the durability source of truth. | "Event Bus Service" |
| **Webhook Management API** (package `webhook-api`) | REST API for subscription CRUD. The only component the API Client talks to. | `backend_api` |
| **Event Ingestion Worker** (package `event-ingestion-worker`) | Pulls events off the Message Broker and durably persists them as Inbox records in the Webhook DB. | `event_consumer_worker`, "Delivery Manager" |
| **Webhook Delivery Worker** (package `webhook-delivery-worker`) | Polls the Inbox for due deliveries, fetches the signing key from Key Management, signs the payload, and POSTs it to the Consumer Endpoint. Owns retries + idempotency. | `delivery_event_worker`, "Webhook Delivery Manager", "Webhook Worker Pool" / worker01-03 |
| **Key Management** (package `key-management`) | Generates, stores and rotates asymmetric signing key pairs, looked up by subscription id. Used only by the Webhook Delivery Worker at send time. Local storage now; swappable to Azure Key Vault / AWS Secrets Manager later. Not owned by `webhook-api`. | did not exist before |
| **Webhook DB** | Shared MongoDB instance; one database (or collection namespace) per owning component (`subscriptions`, `inbox`, `delivery`, `keys`). Document model chosen over relational so inbox/delivery records can embed the arbitrarily-shaped event body payload directly. | `database`, "WebhookManagementDb" |

See `README.md` (event flow, C4 L1, C4 L2) for the diagrams that use these names.
