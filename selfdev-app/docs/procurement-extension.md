# Procurement extension integration

Procurement is a trusted, statically allow-listed extension of `selfdev-app`.
It is excluded from the default build. Include it with:

```text
VITE_BUILD_PROCUREMENT=true
```

This flag controls only build availability. Runtime activation still requires
an authenticated `GET /v1/extensions` response with an enabled, compatible
capability and all manifest permissions. The browser never calls MongoDB or the
Python agent service directly.

For local visual development only, the following combination enables clearly
labelled fictional fixtures and a non-production visual-review session. The
fixture module and visual session bypass are reachable only when Vite is
running in development mode; production builds always use normal authentication
and call the BFF.

```text
VITE_BUILD_PROCUREMENT=true
VITE_PROCUREMENT_DEV_FIXTURES=true
```

## Capabilities contract

`selfdev-api` expects the procurement service to expose authenticated
`GET /capabilities` and adapts it to:

```json
{
  "apiVersion": 1,
  "extensions": [
    {
      "id": "procurement",
      "title": "Procurement",
      "enabled": true,
      "apiVersion": 1,
      "permissions": ["CARD_READ", "COMMUNICATION_READ"],
      "serviceAvailable": true
    }
  ]
}
```

Permissions use the identifiers already defined by `h9y-procurement`:
`CARD_READ`, `CARD_WRITE`, `COMMUNICATION_READ`, `ESCALATION_READ`,
`ESCALATION_ASSIGN`, `ESCALATION_CLAIM`, `ESCALATION_RECOMMEND`,
`ESCALATION_RESOLVE`, `EXPERT_REGISTRY_MANAGE`, and `AUDIT_READ`.

`selfdev-api` configuration:

```text
PROCUREMENT_ENABLED=true
PROCUREMENT_SERVICE_URL=http://h9y-procurement:8080/v1
PROCUREMENT_SERVICE_TOKEN=<service-to-service bearer token>
PROCUREMENT_EXTENSION_API_VERSION=1
PROCUREMENT_SERVICE_TIMEOUT_MS=15000
```

The gateway replaces inbound identity headers with authenticated Selfdev user
identity. The procurement service must authenticate the service token, resolve
the subject to its procurement principal/role bindings, authorize every
request, and return only records in the caller's scope. Frontend route hiding is
not authorization.

## Required read API

The BFF currently allow-lists these `GET` endpoints. Lists should accept
`page`, `pageSize`, `search`, `status`, and the relevant relationship filters,
and return `{ items, page, pageSize, total?, hasMore? }`.

- `/overview`: authoritative counts, stage groups, attention items and recent
  activity. Counts must be calculated by the procurement backend.
- `/cards` and `/cards/:cardId`: procurement cards, normalization and RFQ state,
  relationship counts and completeness.
- `/suppliers` and `/suppliers/:supplierId`: supplier directory, contacts,
  capabilities/evidence, assignments, current offers and paged communication.
- `/negotiations` and `/negotiations/:negotiationId`: assignments, delivery and
  worker state, expected action, messages and current offer.
- `/proposals` and `/proposals/:responseId`: latest supplier response revisions,
  evidence-backed fields, document states, completeness and warnings.
- `/proposals/compare?cardId=…`: backend-normalized `ComparisonResult`. React
  does not convert currency, normalize quantities, score or rank suppliers.
- `/escalations` and `/escalations/:escalationId`: expert-review queue and case.
- `/activity`: user-oriented audit/integration events with optional restricted
  diagnostics.

The frontend adapter accepts presentation-friendly camelCase DTOs and isolates
a limited set of current Python persistence names (`_id`, `card_id`,
`canonical_name`, etc.). A production API should return explicit DTOs rather
than raw Mongo documents.

## Current blocker

`h9y-procurement` currently exposes these workflows only as agent tools backed
by MongoDB. It does not expose the HTTP capabilities/read API above. Therefore
production activation remains safely denied (no permissions are fabricated)
until that service API and its authenticated principal resolution are added.
The frontend displays request failures and never falls back to fixtures in a
production build.
