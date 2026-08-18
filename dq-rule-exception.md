# Copilot Build Spec — DQ Rule Exception (HITL)

## Context
This extends the **existing** HITL Governance Review app (the one already scaffolded for
schema drift). **Schema drift is paused** — do not remove or change it. Add a new exception
type, `DQ_RULE`, that reuses the same case-driven pattern: a queue of exceptions and a review
screen where a data steward makes a decision that is written back through the API (mocked for
now) plus an audit record.

Keep the existing conventions: Vite + React + TypeScript, the isolated API layer in `src/api/`
with a mock implementation toggled by `VITE_USE_MOCK` (default true), React Router, plain CSS,
and the shared components (severity badge, data table, field rows) from the schema-drift work.

## What a DQ rule exception is
The input is a **Dataplex data-quality scan result** — not raw failing rows. Each exception is
one **column + rule that breached its threshold** in a scan. A scan with thousands of failing
rows still produces only a handful of exceptions. The steward acts on the exception, **not** on
individual rows. Failing rows are shown only as a small read-only **sample** (evidence to judge
whether it's a real data problem or a misconfigured rule).

## Fields we take from the scan result (only these)
Do not model the full Dataplex result — take only what the UI needs.

```ts
type Severity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
type DqStatus = 'OPEN' | 'WAIVED' | 'QUARANTINED' | 'RULE_ADJUSTED' | 'ESCALATED';
type DqDimension =
  'COMPLETENESS' | 'ACCURACY' | 'VALIDITY' | 'UNIQUENESS' |
  'CONSISTENCY' | 'TIMELINESS' | 'CONFORMANCE';

interface DqScanContext {
  scan_id: string;        // e.g. "dq-claims-20260817"
  file: string;           // scanned file name, e.g. "claims_2026_08_17.csv"
  scanned_at: string;     // ISO / display timestamp
}

interface DqRuleResult {
  rule_name: string;      // e.g. "premium_non_negative"
  rule_type: string;      // e.g. "RangeExpectation", "NonNullExpectation"
  column: string;         // column the rule applies to
  dimension: DqDimension;
  threshold_pct: number;  // required pass %
  pass_pct: number;       // actual pass %
  rows_evaluated: number;
  rows_failed: number;
  description?: string;
}

interface DqSampleRow {
  // a few representative failing rows; shape varies per rule.
  // Always include a "row" number and the offending column value.
  [key: string]: string | number | null;
}

interface DqRuleException {
  case_id: string;
  exception_type: 'DQ_RULE';
  severity: Severity;
  status: DqStatus;
  scan: DqScanContext;
  rule: DqRuleResult;
  sample: DqSampleRow[];  // capped (e.g. <= 100). Read-only evidence.
}
```

## Decision model
The steward makes a **governance decision** on the exception — never edits data.

```ts
type DqDecision = 'WAIVE' | 'QUARANTINE' | 'ADJUST_RULE' | 'ESCALATE';

interface DqDecisionInput {
  case_id: string;
  decision: DqDecision;
  new_threshold_pct?: number; // required when decision === 'ADJUST_RULE'
  comments?: string;
}
```
Decision → resulting status: WAIVE→`WAIVED`, QUARANTINE→`QUARANTINED`,
ADJUST_RULE→`RULE_ADJUSTED`, ESCALATE→`ESCALATED`.

Meaning of each:
- **Waive** — accept the breach and allow promotion (with a reason).
- **Quarantine** — block promotion of this file/dataset until fixed (fail-closed).
- **Adjust threshold** — the rule/threshold is wrong; propose a new threshold (feedback to BA/registry).
- **Escalate** — raise a fix upstream to the source team.

## API (mock now, same contract style as schema drift)
Add to the API layer, mock implementation by default:
- `getDqCases(): Promise<DqRuleException[]>` — for the queue.
- `getDqCase(caseId: string): Promise<DqRuleException>` — full detail.
- `submitDqDecision(input: DqDecisionInput): Promise<{ ok: true; case_id: string; status: DqStatus }>`
  — updates in-memory status; later this writes decision + audit to the registry.

Seed the mock with ~6 exceptions across 2 scans (`claims_2026_08_17.csv`,
`wellness_2026_08_17.csv`), varied dimensions and severities, each with 3 sample failing rows.
Include at least: a non-null completeness breach, a range/validity breach, a uniqueness breach,
a regex/conformance breach.

## Screens

### DQ Queue
One row per exception. Columns:
`Case | File | Column | Rule (+ dimension) | Pass vs required | Rows failed | Severity | Status`.
- Severity filter (All / Critical / High / Medium / Low).
- Summary counters: open exceptions, critical & open, scans with breaches.
- **Bulk select**: checkboxes with a bar to Waive or Quarantine multiple at once (one scan can raise many low-severity exceptions).
- Row click → DQ Review.
- If the app has a single shared queue for all exception types, add a type filter and route
  `DQ_RULE` rows to the DQ review screen; otherwise a dedicated DQ queue is fine.

### DQ Review
Pre-filled, read-only context + a decision. Sections:
1. Header: case_id, severity badge, status badge.
2. Scan + rule context: file, scan_id, scanned_at, column, rule, dimension, description.
3. **Threshold breach** (the key visual): a pass-vs-required bar showing `pass_pct` filled with a
   marker at `threshold_pct`; below it, three figures — rows evaluated, rows failed, pass % vs required.
4. **Sample of failing rows**: collapsible, read-only table, labelled "showing N of {rows_failed}",
   with a note that rows are evidence only and HITL decides on the rule, not individual rows.
5. **Decision**: four actions (Waive / Quarantine / Adjust threshold / Escalate). Selecting
   "Adjust threshold" reveals a numeric input for the proposed threshold. A comments box (recorded
   in audit). Submit calls `submitDqDecision`, then returns to the queue with a confirmation toast.

## The signature UI element
The pass-vs-threshold bar is what makes each breach readable at a glance — reuse it in both the
queue (compact) and the review screen (full, with labels). Colour the pass fill green when it
meets the threshold and orange when it falls short; draw a dark marker line at the required %.

## Conventions & non-goals
- Reuse the severity badge and shared components already built.
- All data access stays in `src/api/`; components never fetch directly.
- No auth yet. No real registry calls yet (mock only).
- **No data editing / no per-row remediation** — the steward only decides the exception disposition.
- Do not touch the paused schema-drift feature.

## Reference prototype
A working single-file React prototype of this exact flow exists (`DqRuleExceptionHITL.jsx`) —
use it as the visual and behavioural reference for layout, the threshold bar, the sample-rows
panel, and the decision actions.
