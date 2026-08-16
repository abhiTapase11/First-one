# Copilot Instructions — HITL Governance Review UI

## What we are building
A small internal web UI for a Human-in-the-Loop (HITL) data steward to review
governance **exceptions** (schema-drift and data-quality rule exceptions) and
**approve**, **modify**, or **reject** them.

The steward is already notified of an exception through an external channel
(Jira), so this app does NOT let them search for objects. Each exception arrives
as a **pre-populated case**; the steward opens it and acts on it.

The Metadata Registry (owned by another team) is the source of truth. This app
only reads cases and writes the steward's decision + an audit record back
through a backend API. It never touches source or warehouse data.

## Scope of THIS work
- Frontend only, for now. Build the UI against a **mock API layer**.
- No authentication/authorization yet — assume the user is already an authorized steward.
- Do not call the registry directly from the browser. All data goes through an API module.

## Tech stack (use exactly this)
- Vite + React + TypeScript.
- React Router for navigation.
- Plain CSS modules (no heavy UI library). Keep dependencies minimal.
- A single isolated API layer in `src/api/` with:
  - A typed client interface.
  - A **mock implementation** (in-memory sample data) used by default.
  - Selection controlled by an env var `VITE_USE_MOCK` (default "true"), so a real
    backend can be swapped in later without changing components.

## Folder structure
```
src/
  api/            # client interface + mock impl + real impl stub
  types/          # shared TypeScript types
  pages/          # CaseQueuePage, CaseReviewPage
  components/     # reusable UI (Badge, DataTable, Field, ActionBar, etc.)
  App.tsx, main.tsx, router.tsx
```

## Data model (types)
```ts
type ExceptionType = 'SCHEMA_DRIFT' | 'DQ_RULE';
type Severity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
type CaseStatus = 'OPEN' | 'IN_REVIEW' | 'APPROVED' | 'MODIFIED' | 'REJECTED';
type DecisionType = 'APPROVE' | 'MODIFY' | 'REJECT';

interface GovernanceCase {
  case_id: string;
  exception_type: ExceptionType;
  severity: Severity;
  status: CaseStatus;
  owner: string;
  detected_by: string;              // e.g. "DLP Scan", "Schema Drift Detector"
  object: {                         // the affected object, fully qualified
    project: string;
    dataset: string;
    table: string;
    column?: string;
  };
  summary: string;                  // one-line description of the exception
  recommended_value?: string;       // e.g. recommended classification "PHI-Restricted"
  before_value?: string;            // for schema drift / classification change
  after_value?: string;
  sample_value?: string;            // internal tool — OK to show
  details?: Record<string, string>; // any extra key/value context
}

interface DecisionInput {
  case_id: string;
  decision: DecisionType;
  modified_value?: string;          // required when decision === 'MODIFY'
  comments?: string;
}
```

## API contract (mock now, real later)
- `getCases(status?: CaseStatus): Promise<GovernanceCase[]>`  → list for the queue
- `getCase(caseId: string): Promise<GovernanceCase>`          → full pre-filled detail
- `submitDecision(input: DecisionInput): Promise<{ ok: true; case_id: string; status: CaseStatus }>`

The mock impl should hold ~6 sample cases (mix of SCHEMA_DRIFT and DQ_RULE,
varied severity) and, on submitDecision, update the in-memory case status and
return the new status. Simulate ~300ms latency.

## Screens
### 1. Case Queue (`/`)
- Header showing counts: Open, Critical, In Review.
- A table of cases: Case ID | Type | Severity (colored badge) | Object (dataset.table.column) | Status.
- Filter by exception_type and severity.
- Click a row → navigate to `/cases/:caseId`.

### 2. Case Review (`/cases/:caseId`)
- Show ALL case fields, pre-filled and read-only, grouped clearly:
  - Header: case_id, type, severity, status, detected_by.
  - Object: project / dataset / table / column.
  - Summary.
  - For SCHEMA_DRIFT: before_value → after_value, and an editable
    "classification" field pre-filled with recommended_value.
  - For DQ_RULE: show the rule details from `details`.
  - sample_value shown in a labeled box.
- Action bar: **Approve**, **Modify**, **Reject**, each with an optional comments box.
  - Modify enables the editable value field; the edited value is sent as modified_value.
- On submit, call `submitDecision`, show a success confirmation with the new status,
  and offer a link back to the queue.
- Disable actions and show a spinner while the request is in flight.

## Conventions
- TypeScript strict, functional components + hooks only.
- Keep all network access inside `src/api/`; components import the client, never fetch directly.
- Small, composable components; no business logic in JSX.
- Severity → color: LOW gray, MEDIUM amber, HIGH orange, CRITICAL red.
- Clean, professional, dense internal-tool look. No marketing styling.

## Non-goals (do not build)
- No login/SSO/RBAC yet.
- No direct BigQuery/registry access from the app.
- No editing of source data — only decision + audit are ever written (via the API).

## Later phases (context only, don't build now)
- Phase 2: real backend (FastAPI) implementing the same API contract, writing to the
  registry tables registry_hitl_case / _decision / _audit.
- Phase 3: auth via IAP + app-level RBAC.
