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

## Shadcn UI maintenance

Procurement uses the application-wide CLI-managed official Shadcn source
components. The current configuration is recorded in `components.json`: the
Vega style, React Aria foundation, JavaScript output, CSS variables, and the
neutral base color. Generated primitives live in `src/components/ui` and should
not be edited for product styling. Shared compositions live outside that
generated directory; Procurement pages consume the public component API.

Tailwind uses the configured `tw` prefix and scans the shared component and
extension directories. The prefix changes no Shadcn visual values; it prevents
Tailwind utilities and Semantic UI's global selectors from overriding one
another. Tailwind preflight is intentionally omitted, and the Shadcn base layer
is still scoped to its host workspace, so existing Semantic UI screens retain
their current reset, typography, and component behavior.

To add or refresh components, keep `components.json` unchanged and use the
official registry. For example:

```text
npx shadcn@latest add button card select --overwrite
```

The rest of `selfdev-app` remains on Semantic UI React. Procurement currently
has no JSON-schema form, so `@rjsf/shadcn` is not installed yet. Existing RJSF
v5 Semantic forms are left untouched. Introduce the Shadcn RJSF theme when the
first Procurement schema form is implemented, together with a reviewed RJSF
version upgrade; do not change legacy forms as part of that feature without
their own regression coverage.

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
`CARD_READ`, `CARD_WRITE`, `SOURCING_RESEARCH`, `SOURCING_REVIEW`,
`COMMUNICATION_READ`, `ESCALATION_READ`,
`ESCALATION_ASSIGN`, `ESCALATION_CLAIM`, `ESCALATION_RECOMMEND`,
`ESCALATION_RESOLVE`, `EXPERT_REGISTRY_MANAGE`, and `AUDIT_READ`.

`selfdev-api` configuration:

```text
PROCUREMENT_ENABLED=true
PROCUREMENT_SERVICE_URL=http://h9y-procurement:8080/v1
PROCUREMENT_SERVICE_TOKEN=<service-to-service bearer token>
PROCUREMENT_EXTENSION_API_VERSION=1
PROCUREMENT_SERVICE_TIMEOUT_MS=15000
PROCUREMENT_SOURCING_TIMEOUT_MS=180000
```

The gateway replaces inbound identity headers with authenticated Selfdev user
identity. The procurement service must authenticate the service token, resolve
the subject to its procurement principal/role bindings, authorize every
request, and return only records in the caller's scope. Frontend route hiding is
not authorization.

## Read API

The BFF allow-lists these implemented `GET` endpoints. Lists accept
`page`, `pageSize`, `search`, `status`, and the relevant relationship filters,
and return `{ items, page, pageSize, total?, hasMore? }`.

- `/overview`: authoritative counts, stage groups, attention items and recent
  activity. Counts must be calculated by the procurement backend.
- `/cards` and `/cards/:cardId`: procurement cards, normalization and RFQ state,
  relationship counts and completeness.
- `/cards/:cardId/sourcing` and `/sourcing/:runId`: open-source search snapshot,
  candidates, evidence, human review history and traceable sources.
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

## Deterministic actions

Milestone 1 exposes the procurement-card intake lifecycle through the same BFF:

- `POST /cards` creates a complete intake card;
- `PATCH /cards/:cardId` edits the supported intake fields and returns explicit
  RFQ/inquiry invalidation effects;
- `POST /cards/:cardId/normalize` verifies CAS/name through the existing PubChem
  normalizer and persists the traceable result.

All three require `CARD_WRITE`. The BFF explicitly allow-lists these method/path
pairs; no generic create/update/delete proxy exists. Development fixtures stay
read-only, so a mutation can never look successful without reaching the real
backend.

The sourcing workspace adds four explicit actions: start a new run, add a
public URL, record a human review, and promote a verified candidate into the
supplier directory. Promotion remains impossible until a reviewer records
`VERIFIED_MANUFACTURER` or `VERIFIED_DISTRIBUTOR`; the traffic-light score is
always presented as preliminary rather than automatic verification.

The frontend adapter accepts presentation-friendly camelCase DTOs and isolates
a limited set of current Python persistence names (`_id`, `card_id`,
`canonical_name`, etc.). A production API should return explicit DTOs rather
than raw Mongo documents.

## Communication section

`/procurement/communication` is the library that shapes what the negotiator
writes: directives, company answers to the specification's eight recurring
supplier questions, and mandatory sentences. It is a settings-shaped area — read
often, edited rarely — so it sits in its own tab rather than inside a card.

Two screens hang off it:

* `/procurement/communication/policy` — when a message waits for a human before
  it is sent, plus a dry run that shows exactly which rules would apply and the
  prompt text the agent would receive, without calling a model.
* `/procurement/communication/drafts` — every message the negotiator produced,
  including the ones that were held or blocked. Its detail page is the
  attribution panel: what triggered the message, which library items applied at
  which versions, what was withheld from the supplier, and every check with its
  result. From there a specialist approves (optionally editing the text, which
  is re-checked) or refuses to send with a mandatory reason.

Both directions of the link work: a library item lists the real messages it
shaped, and a message links back to each rule that shaped it.

Decision rules that mirror the backend state machine live in
`lib/compositions.js` rather than in the pages, for the same reason
`escalations.js` does — a rule the tests can reach cannot quietly drift away
from the backend's.

## Negotiator visibility

Two screens answer "what is the agent doing, and why".

`/procurement/negotiations/agent` is the worker's own view: what is due, what is
scheduled, what is stuck, and the messages whose supplier could not be
identified. The quarantine is resolved in place — attribute a message to an
assignment, or dismiss it with a reason.

The negotiation detail page merges three sources into one chronology through
`lib/timeline.js`: delivered messages, the drafts the agent produced but never
sent, and the assignment's status changes. A composition that was delivered
enriches its message with an inline "why this was written" rather than appearing
twice; a draft that was held, blocked or refused gets its own entry, so the
specialist sees what the agent wanted to send and why it did not go.

The merge lives in a tested module rather than in the page because the rules —
which entries are duplicates, what sorts where, what still owes a decision — are
exactly the sort of thing that drifts when it is embedded in JSX.

## Deployment activation

`h9y-procurement` exposes the authenticated HTTP read API in
`src.http_api:app`. Production activation remains opt-in: enable
`PROCUREMENT_API_ENABLED` in the Python service, configure the same non-empty
`PROCUREMENT_SERVICE_TOKEN` in both services, set `PROCUREMENT_ENABLED` and
`PROCUREMENT_SERVICE_URL` in `selfdev-api`, and include the frontend extension
at build time. Missing configuration or unavailable services fail closed; the
frontend never falls back to fixtures in production.
