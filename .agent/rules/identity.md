# Identity & authentication

The system authenticates callers via a Bearer JWT (OIDC/OAuth2 access token). Every package that needs caller
identity resolves these claims the same way — never invent a different mapping:

| Claim | Maps to | Required? | Notes |
|---|---|---|---|
| `tenant_id` | `TenantId` | required | Primary ownership/isolation boundary — every tenant-owned resource (e.g. `WebhookSubscription`) is scoped by this. |
| `client_id` | `ClientId` | required | The OAuth client (application/service) that made the call. Recorded as audit metadata; not part of the access-control boundary. |
| `sub` | `UserId` | optional | The human user, when the token was issued via an interactive/user flow. Absent on client-credentials (machine-to-machine) tokens — treat as nullable everywhere. |

**Access control rule**: authorization is TenantId-scoped. Any caller authenticated with a given `tenant_id` can
list/get/update/delete any resource owned by that tenant, regardless of which `client_id` or `sub` originally
created it. `ClientId`/`UserId` are for audit trails ("who created/changed this"), never for restricting access.

**Where this applies now**: `webhook-api`'s `WebhookSubscription.tenantId` is the scoping field; `createdByClientId`
and `createdByUserId` (nullable) are recorded for audit only. Future packages (workers, key-management) that need
to scope data per tenant should follow the same TenantId-primary pattern.
