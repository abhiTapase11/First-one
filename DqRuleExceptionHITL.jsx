import React, { useState, useMemo } from "react";
import {
  ArrowLeft, ChevronDown, ChevronRight, ShieldCheck, Ban,
  SlidersHorizontal, ArrowUpRight, CheckCircle2, AlertTriangle, Search
} from "lucide-react";

// ---------------------------------------------------------------------------
// Mock data — shaped like the fields we take from a Dataplex DQ scan result.
// Only the fields HITL actually needs are included.
// ---------------------------------------------------------------------------
const SEVERITY = {
  LOW:      { label: "Low",      cls: "bg-slate-100 text-slate-600 ring-slate-200" },
  MEDIUM:   { label: "Medium",   cls: "bg-amber-100 text-amber-700 ring-amber-200" },
  HIGH:     { label: "High",     cls: "bg-orange-100 text-orange-700 ring-orange-200" },
  CRITICAL: { label: "Critical", cls: "bg-red-100 text-red-700 ring-red-200" },
};

const STATUS = {
  OPEN:          { label: "Open",          cls: "bg-slate-100 text-slate-600 ring-slate-200" },
  WAIVED:        { label: "Waived",        cls: "bg-emerald-100 text-emerald-700 ring-emerald-200" },
  QUARANTINED:   { label: "Quarantined",   cls: "bg-red-100 text-red-700 ring-red-200" },
  RULE_ADJUSTED: { label: "Rule adjusted", cls: "bg-blue-100 text-blue-700 ring-blue-200" },
  ESCALATED:     { label: "Escalated",     cls: "bg-violet-100 text-violet-700 ring-violet-200" },
};

const initialCases = [
  {
    case_id: "DQX-1024", severity: "CRITICAL", status: "OPEN",
    scan: { scan_id: "dq-claims-20260817", file: "claims_2026_08_17.csv", scanned_at: "2026-08-17 04:12" },
    rule: { rule_name: "policy_number_unique", rule_type: "UniquenessExpectation", column: "policy_number",
      dimension: "UNIQUENESS", threshold_pct: 100, pass_pct: 99.9, rows_evaluated: 48210, rows_failed: 42,
      description: "Every policy_number must be unique across the file." },
    sample: [
      { row: 10241, policy_number: "PP000266", note: "duplicate" },
      { row: 22188, policy_number: "PP000266", note: "duplicate" },
      { row: 30934, policy_number: "PP014820", note: "duplicate" },
    ],
  },
  {
    case_id: "DQX-1025", severity: "HIGH", status: "OPEN",
    scan: { scan_id: "dq-claims-20260817", file: "claims_2026_08_17.csv", scanned_at: "2026-08-17 04:12" },
    rule: { rule_name: "customer_id_not_null", rule_type: "NonNullExpectation", column: "customer_id",
      dimension: "COMPLETENESS", threshold_pct: 100, pass_pct: 99.2, rows_evaluated: 48210, rows_failed: 386,
      description: "customer_id is a mandatory identifier and must not be null." },
    sample: [
      { row: 501, customer_id: null, note: "missing" },
      { row: 1893, customer_id: null, note: "missing" },
      { row: 4550, customer_id: "", note: "empty string" },
    ],
  },
  {
    case_id: "DQX-1026", severity: "HIGH", status: "OPEN",
    scan: { scan_id: "dq-claims-20260817", file: "claims_2026_08_17.csv", scanned_at: "2026-08-17 04:12" },
    rule: { rule_name: "premium_non_negative", rule_type: "RangeExpectation", column: "premium_amount",
      dimension: "VALIDITY", threshold_pct: 99, pass_pct: 97.4, rows_evaluated: 48210, rows_failed: 1253,
      description: "premium_amount must be >= 0." },
    sample: [
      { row: 233, premium_amount: -120.0, note: "negative" },
      { row: 8891, premium_amount: -5.5, note: "negative" },
      { row: 15002, premium_amount: -1000.0, note: "negative" },
    ],
  },
  {
    case_id: "DQX-1027", severity: "MEDIUM", status: "OPEN",
    scan: { scan_id: "dq-claims-20260817", file: "claims_2026_08_17.csv", scanned_at: "2026-08-17 04:12" },
    rule: { rule_name: "nps_in_range", rule_type: "RangeExpectation", column: "nps_score",
      dimension: "VALIDITY", threshold_pct: 98, pass_pct: 95.1, rows_evaluated: 12040, rows_failed: 590,
      description: "nps_score must be between 0 and 10." },
    sample: [
      { row: 77, nps_score: 12, note: "out of range" },
      { row: 320, nps_score: 45, note: "out of range" },
      { row: 900, nps_score: -3, note: "out of range" },
    ],
  },
  {
    case_id: "DQX-1028", severity: "LOW", status: "OPEN",
    scan: { scan_id: "dq-claims-20260817", file: "claims_2026_08_17.csv", scanned_at: "2026-08-17 04:12" },
    rule: { rule_name: "email_format", rule_type: "RegexExpectation", column: "email",
      dimension: "CONFORMANCE", threshold_pct: 95, pass_pct: 88.7, rows_evaluated: 40100, rows_failed: 4531,
      description: "email must match a standard email pattern." },
    sample: [
      { row: 12, email: "john.doe@", note: "malformed" },
      { row: 410, email: "no-at-symbol.com", note: "malformed" },
      { row: 1220, email: "a@b", note: "malformed" },
    ],
  },
  {
    case_id: "DQX-1030", severity: "HIGH", status: "OPEN",
    scan: { scan_id: "dq-wellness-20260817", file: "wellness_2026_08_17.csv", scanned_at: "2026-08-17 05:03" },
    rule: { rule_name: "risk_score_in_range", rule_type: "RangeExpectation", column: "customer_health_risk_score",
      dimension: "VALIDITY", threshold_pct: 99, pass_pct: 91.0, rows_evaluated: 15200, rows_failed: 1368,
      description: "customer_health_risk_score must be between 0 and 100." },
    sample: [
      { row: 55, customer_health_risk_score: 145, note: "out of range" },
      { row: 289, customer_health_risk_score: -10, note: "out of range" },
      { row: 1120, customer_health_risk_score: 999, note: "out of range" },
    ],
  },
];

// ---------------------------------------------------------------------------
// Small presentational helpers
// ---------------------------------------------------------------------------
function Pill({ map, k }) {
  const s = map[k] || { label: k, cls: "bg-slate-100 text-slate-600 ring-slate-200" };
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${s.cls}`}>{s.label}</span>;
}

// signature element: pass % against the required threshold
function ThresholdBar({ pass, threshold, compact }) {
  const gap = Math.max(0, threshold - pass);
  const passColor = pass >= threshold ? "bg-emerald-500" : "bg-orange-500";
  return (
    <div className={compact ? "w-40" : "w-full"}>
      <div className="relative h-2.5 w-full rounded-full bg-slate-200">
        <div className={`absolute left-0 top-0 h-2.5 rounded-full ${passColor}`} style={{ width: `${pass}%` }} />
        <div className="absolute top-[-3px] h-[16px] w-[2px] bg-slate-800" style={{ left: `calc(${threshold}% - 1px)` }} title={`Required: ${threshold}%`} />
      </div>
      {!compact && (
        <div className="mt-1 flex justify-between text-xs">
          <span className={pass >= threshold ? "text-emerald-600 font-medium" : "text-orange-600 font-medium"}>{pass}% passed</span>
          <span className="text-slate-500">required {threshold}%  ·  gap {gap.toFixed(1)}%</span>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Queue view
// ---------------------------------------------------------------------------
function Queue({ cases, onOpen, onBulk }) {
  const [sev, setSev] = useState("ALL");
  const [selected, setSelected] = useState({});
  const filtered = useMemo(
    () => cases.filter((c) => sev === "ALL" || c.severity === sev),
    [cases, sev]
  );
  const openCount = cases.filter((c) => c.status === "OPEN").length;
  const critCount = cases.filter((c) => c.severity === "CRITICAL" && c.status === "OPEN").length;
  const scans = new Set(cases.map((c) => c.scan.scan_id)).size;
  const selectedIds = Object.keys(selected).filter((k) => selected[k]);

  const toggle = (id) => setSelected((s) => ({ ...s, [id]: !s[id] }));

  return (
    <div>
      {/* summary */}
      <div className="mb-5 grid grid-cols-3 gap-3">
        {[
          { n: openCount, l: "Open exceptions" },
          { n: critCount, l: "Critical & open" },
          { n: scans, l: "Scans with breaches" },
        ].map((s) => (
          <div key={s.l} className="rounded-lg border border-slate-200 bg-white px-4 py-3">
            <div className="text-2xl font-semibold text-slate-800 tabular-nums">{s.n}</div>
            <div className="text-xs text-slate-500">{s.l}</div>
          </div>
        ))}
      </div>

      {/* filter */}
      <div className="mb-3 flex items-center gap-2">
        <span className="text-xs font-medium text-slate-500">Severity</span>
        {["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW"].map((s) => (
          <button key={s} onClick={() => setSev(s)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium ${sev === s ? "bg-slate-800 text-white" : "bg-white text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-slate-50"}`}>
            {s === "ALL" ? "All" : SEVERITY[s].label}
          </button>
        ))}
      </div>

      {/* bulk bar */}
      {selectedIds.length > 0 && (
        <div className="mb-2 flex items-center gap-3 rounded-lg bg-slate-800 px-3 py-2 text-sm text-white">
          <span>{selectedIds.length} selected</span>
          <button onClick={() => { onBulk(selectedIds, "WAIVED"); setSelected({}); }}
            className="rounded-md bg-white/10 px-2.5 py-1 text-xs font-medium hover:bg-white/20">Waive selected</button>
          <button onClick={() => { onBulk(selectedIds, "QUARANTINED"); setSelected({}); }}
            className="rounded-md bg-white/10 px-2.5 py-1 text-xs font-medium hover:bg-white/20">Quarantine selected</button>
        </div>
      )}

      {/* table */}
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="w-8 px-3 py-2"></th>
              <th className="px-3 py-2">Case</th>
              <th className="px-3 py-2">File</th>
              <th className="px-3 py-2">Column</th>
              <th className="px-3 py-2">Rule</th>
              <th className="px-3 py-2">Pass vs required</th>
              <th className="px-3 py-2 text-right">Rows failed</th>
              <th className="px-3 py-2">Severity</th>
              <th className="px-3 py-2">Status</th>
              <th className="w-6 px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.case_id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                <td className="px-3 py-2.5">
                  <input type="checkbox" checked={!!selected[c.case_id]} onChange={() => toggle(c.case_id)}
                    className="h-3.5 w-3.5 rounded border-slate-300" onClick={(e) => e.stopPropagation()} />
                </td>
                <td className="cursor-pointer px-3 py-2.5 font-medium text-slate-700" onClick={() => onOpen(c.case_id)}>{c.case_id}</td>
                <td className="cursor-pointer px-3 py-2.5 text-slate-600" onClick={() => onOpen(c.case_id)}>{c.scan.file}</td>
                <td className="cursor-pointer px-3 py-2.5 font-mono text-xs text-slate-600" onClick={() => onOpen(c.case_id)}>{c.rule.column}</td>
                <td className="cursor-pointer px-3 py-2.5 text-slate-600" onClick={() => onOpen(c.case_id)}>
                  {c.rule.rule_name}
                  <span className="ml-1 text-xs text-slate-400">· {c.rule.dimension.toLowerCase()}</span>
                </td>
                <td className="cursor-pointer px-3 py-2.5" onClick={() => onOpen(c.case_id)}>
                  <ThresholdBar pass={c.rule.pass_pct} threshold={c.rule.threshold_pct} compact />
                </td>
                <td className="cursor-pointer px-3 py-2.5 text-right tabular-nums text-slate-700" onClick={() => onOpen(c.case_id)}>{c.rule.rows_failed.toLocaleString()}</td>
                <td className="cursor-pointer px-3 py-2.5" onClick={() => onOpen(c.case_id)}><Pill map={SEVERITY} k={c.severity} /></td>
                <td className="cursor-pointer px-3 py-2.5" onClick={() => onOpen(c.case_id)}><Pill map={STATUS} k={c.status} /></td>
                <td className="px-3 py-2.5 text-slate-300"><ChevronRight size={15} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Review view
// ---------------------------------------------------------------------------
const ACTIONS = [
  { key: "WAIVED",        label: "Waive",            icon: ShieldCheck,       hint: "Accept the breach and allow promotion", cls: "hover:bg-emerald-50 hover:text-emerald-700 hover:ring-emerald-200" },
  { key: "QUARANTINED",   label: "Quarantine",       icon: Ban,               hint: "Block promotion until fixed",           cls: "hover:bg-red-50 hover:text-red-700 hover:ring-red-200" },
  { key: "RULE_ADJUSTED", label: "Adjust threshold", icon: SlidersHorizontal, hint: "Rule/threshold is wrong — propose new",  cls: "hover:bg-blue-50 hover:text-blue-700 hover:ring-blue-200" },
  { key: "ESCALATED",     label: "Escalate",         icon: ArrowUpRight,      hint: "Raise a fix upstream",                  cls: "hover:bg-violet-50 hover:text-violet-700 hover:ring-violet-200" },
];

function Field({ label, children, mono }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-slate-400">{label}</div>
      <div className={`text-sm text-slate-800 ${mono ? "font-mono" : ""}`}>{children}</div>
    </div>
  );
}

function Review({ c, onBack, onDecide }) {
  const [choice, setChoice] = useState(null);
  const [comment, setComment] = useState("");
  const [newThreshold, setNewThreshold] = useState(c.rule.threshold_pct);
  const [showRows, setShowRows] = useState(true);
  const cols = Object.keys(c.sample[0]);

  return (
    <div>
      <button onClick={onBack} className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft size={15} /> Back to queue
      </button>

      {/* header */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-semibold text-slate-800">{c.case_id}</h2>
        <Pill map={SEVERITY} k={c.severity} />
        <Pill map={STATUS} k={c.status} />
        <span className="text-sm text-slate-400">DQ rule exception</span>
      </div>

      {/* scan + rule context */}
      <div className="mb-4 grid grid-cols-2 gap-4 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-3">
        <Field label="File">{c.scan.file}</Field>
        <Field label="Scan id" mono>{c.scan.scan_id}</Field>
        <Field label="Scanned at">{c.scan.scanned_at}</Field>
        <Field label="Column" mono>{c.rule.column}</Field>
        <Field label="Rule">{c.rule.rule_name}</Field>
        <Field label="Dimension">{c.rule.dimension}</Field>
        <div className="col-span-2 sm:col-span-3"><Field label="Description">{c.rule.description}</Field></div>
      </div>

      {/* the numbers + signature bar */}
      <div className="mb-4 rounded-lg border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-700">
          <AlertTriangle size={15} className="text-orange-500" /> Threshold breach
        </div>
        <ThresholdBar pass={c.rule.pass_pct} threshold={c.rule.threshold_pct} />
        <div className="mt-4 grid grid-cols-3 gap-4 text-center">
          <div><div className="text-lg font-semibold tabular-nums text-slate-800">{c.rule.rows_evaluated.toLocaleString()}</div><div className="text-xs text-slate-500">rows evaluated</div></div>
          <div><div className="text-lg font-semibold tabular-nums text-orange-600">{c.rule.rows_failed.toLocaleString()}</div><div className="text-xs text-slate-500">rows failed</div></div>
          <div><div className="text-lg font-semibold tabular-nums text-slate-800">{c.rule.pass_pct}%</div><div className="text-xs text-slate-500">passed (need {c.rule.threshold_pct}%)</div></div>
        </div>
      </div>

      {/* sample failing rows — evidence, not a worklist */}
      <div className="mb-4 rounded-lg border border-slate-200 bg-white">
        <button onClick={() => setShowRows((s) => !s)} className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-slate-700">
          <span className="inline-flex items-center gap-2"><Search size={14} className="text-slate-400" /> Sample of failing rows</span>
          <span className="inline-flex items-center gap-2 text-xs font-normal text-slate-400">
            showing {c.sample.length} of {c.rule.rows_failed.toLocaleString()}
            {showRows ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
          </span>
        </button>
        {showRows && (
          <div className="overflow-x-auto border-t border-slate-100 px-4 py-2">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                  {cols.map((k) => <th key={k} className="py-1.5 pr-4">{k}</th>)}
                </tr>
              </thead>
              <tbody>
                {c.sample.map((r, i) => (
                  <tr key={i} className="border-t border-slate-50">
                    {cols.map((k) => (
                      <td key={k} className="py-1.5 pr-4 font-mono text-xs text-slate-600">
                        {r[k] === null ? <span className="italic text-slate-400">null</span> : String(r[k])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="py-2 text-xs text-slate-400">Read-only. Rows are shown as evidence to judge the cause — HITL decides on the rule, not individual rows.</div>
          </div>
        )}
      </div>

      {/* decision */}
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="mb-3 text-sm font-medium text-slate-700">Decision</div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {ACTIONS.map((a) => {
            const Icon = a.icon; const active = choice === a.key;
            return (
              <button key={a.key} onClick={() => setChoice(a.key)}
                className={`flex flex-col items-start gap-1 rounded-lg border p-3 text-left ring-1 ring-inset transition ${active ? "border-slate-800 bg-slate-800 text-white ring-slate-800" : "border-slate-200 bg-white text-slate-700 ring-transparent " + a.cls}`}>
                <Icon size={16} />
                <span className="text-sm font-medium">{a.label}</span>
                <span className={`text-xs ${active ? "text-slate-200" : "text-slate-400"}`}>{a.hint}</span>
              </button>
            );
          })}
        </div>

        {choice === "RULE_ADJUSTED" && (
          <div className="mt-3 flex items-center gap-2">
            <label className="text-sm text-slate-600">Proposed threshold</label>
            <input type="number" value={newThreshold} min={0} max={100}
              onChange={(e) => setNewThreshold(e.target.value)}
              className="w-24 rounded-md border border-slate-300 px-2 py-1 text-sm" />
            <span className="text-sm text-slate-400">% (was {c.rule.threshold_pct}%)</span>
          </div>
        )}

        <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2}
          placeholder="Add a comment (reason for the decision — recorded in the audit trail)"
          className="mt-3 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500" />

        <div className="mt-3 flex justify-end">
          <button disabled={!choice}
            onClick={() => onDecide(c.case_id, choice, { comment, newThreshold: choice === "RULE_ADJUSTED" ? newThreshold : undefined })}
            className={`rounded-md px-4 py-2 text-sm font-medium ${choice ? "bg-slate-800 text-white hover:bg-slate-900" : "cursor-not-allowed bg-slate-200 text-slate-400"}`}>
            Submit decision
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// App shell
// ---------------------------------------------------------------------------
export default function App() {
  const [cases, setCases] = useState(initialCases);
  const [openId, setOpenId] = useState(null);
  const [toast, setToast] = useState(null);

  const current = cases.find((c) => c.case_id === openId);

  const flash = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2600); };

  const decide = (id, status, meta) => {
    setCases((cs) => cs.map((c) => (c.case_id === id ? { ...c, status } : c)));
    setOpenId(null);
    flash(`${id} — ${STATUS[status].label.toLowerCase()}`);
  };
  const bulk = (ids, status) => {
    setCases((cs) => cs.map((c) => (ids.includes(c.case_id) ? { ...c, status } : c)));
    flash(`${ids.length} case${ids.length > 1 ? "s" : ""} — ${STATUS[status].label.toLowerCase()}`);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900" style={{ fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif" }}>
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-800 text-white"><ShieldCheck size={16} /></div>
            <h1 className="text-base font-semibold text-slate-800">HITL Governance Workbench</h1>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">Data Quality exceptions</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-6">
        {current
          ? <Review c={current} onBack={() => setOpenId(null)} onDecide={decide} />
          : <Queue cases={cases} onOpen={setOpenId} onBulk={bulk} />}
      </main>

      {toast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 rounded-lg bg-slate-800 px-4 py-2 text-sm text-white shadow-lg">
          <span className="inline-flex items-center gap-2"><CheckCircle2 size={15} className="text-emerald-400" /> {toast} · decision + audit recorded</span>
        </div>
      )}
    </div>
  );
}
