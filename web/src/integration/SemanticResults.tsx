import { apiUrl } from "../storage/api";
import { useState } from "react";
import { RelationshipSpace } from "./RelationshipSpace";
import { RelationshipSuggestions } from "./RelationshipSuggestions";
import { CombineRelationshipsModal } from "./CombineRelationshipsModal";
export type SchemaConfig = {
  mode?: "strict" | "hybrid" | "open";
  labels?: string[];
  definitions?: Record<string, string>;
  prompt_id?: string;
  context_config?: any;
  preset?: string;
};

export type SemanticPlan = {
  id: string;
  schema_config?: SchemaConfig;
  content_revision?: string;
  provenance_status?: string;
  model_decisions?: Decision[];
  curation?: {sources:string[];target:string;definition?:string;created:number}[];
  cached_calls?: number;
  llm_calls?: number;
  batch?: {mode?:string;total:number;retained?:number;run_total?:number};
  title: string;
  description: string;
  materialized: boolean;
  model: string;
  seconds: number;
  scope: string;
  counts: { include: number; abstain: number; conflict: number };
  coverage: {
    retained_pairs?: number;
    updated_pairs?: number;
    pending_pairs?: number;
    reviewed: number;
    available_pairs: number;
    pool_pairs: number;
    pool_omitted: number;
    ce_filtered: number;
    omitted: number;
  };
  pipeline: { model: string; device: string; clustering: string };
  cases: Case[];
  decisions: Decision[];
  output: JoinedRow[];
};
type Source = {
  source?: string;
  name: string;
  columns: string[];
  record: { record_id?: string; cells: string[] };
  anchor_column: number;
};
type Path = {
  anchors?: { left: string; right: string; start: number; end: number }[];
  evidence: string;
  left: string;
  right: string;
  text: string;
  context_text?: string;
  score: number;
  ce_score: number;
};
type Case = {
  document_name?: string;
  candidate: string;
  cluster: number;
  noise: boolean;
  point: number[];
  left: Source;
  right: Source;
  paths: Path[];
};
type Decision = {
  candidate: string;
  status: string;
  relations: string[];
  reason: string;
  validation: string;
  path_decisions: {
    evidence: string;
    relationship: string;
    basis: string;
    reason: string;
    diagnosis_quote?: string;
    medication_quote?: string;
    record_a_quote?: string;
    record_b_quote?: string;
  }[];
};
type JoinedRow = {
  candidate: string;
  left_value: string;
  right_value: string;
  record_a_value?: string;
  record_b_value?: string;
  relation: string;
  direction?: string;
  cluster: number;
  evidence_quote: string;
  record_a_quote?: string;
  record_b_quote?: string;
  evidence_count: number;
  path_count?: number;
  left_columns: string[];
  right_columns: string[];
  left_cells: string[];
  right_cells: string[];
  left_link: string;
  right_link: string;
};
export type DiffStatus = "added" | "changed" | "withdrawn" | "unchanged" | "not_reviewed";

export type DiffRow = JoinedRow & {
  diff_status?: DiffStatus;
  diff_key?: string;
  diff_origin?: "current" | "previous";
  diff_notes?: string;
  previous_relation?: string;
  previous_relations?: string[];
  current_relations?: string[];
  previous_evidence_count?: number;
};

export type DiffData = {
  has_previous: boolean;
  current: {
    id: string;
    title: string;
    created: number;
    model?: string;
  };
  previous: {
    id: string;
    title: string;
    created: number;
    model?: string;
  } | null;
  counts: {
    added: number;
    changed: number;
    withdrawn: number;
    unchanged: number;
    not_reviewed?: number;
    total_current: number;
    total_previous: number;
  };
  rows: DiffRow[];
};

const label = (s: string) => s;

export function getPredicateStyle(relation: string): React.CSSProperties {
  if (relation === "ADVERSE_EFFECT") {
    return { background: "#fae9ef", color: "#9b2044", border: "1px solid #f2c2ce" };
  }
  if (relation === "DISCONTINUED") {
    return { background: "#fff3d8", color: "#846100", border: "1px solid #fae19c" };
  }
  if (relation === "CONTRAINDICATED") {
    return { background: "#fdf2f2", color: "#b91c1c", border: "1px solid #fecaca" };
  }
  if (relation === "TREATS" || relation === "INDICATED") {
    return { background: "#edf2fe", color: "#2f5abe", border: "1px solid #c7d7fc" };
  }
  if (relation === "NEGATIVE") {
    return { background: "#f3f4f6", color: "#4b5563", border: "1px solid #e5e7eb" };
  }
  if (relation === "UNRESOLVED") {
    return { background: "#fef3c7", color: "#92400e", border: "1px solid #fde68a" };
  }
  const palettes = [
    { background: "#ecfdf5", color: "#065f46", border: "1px solid #a7f3d0" },
    { background: "#f5f3ff", color: "#5b21b6", border: "1px solid #ddd6fe" },
    { background: "#ecfeff", color: "#155e75", border: "1px solid #a5f3fc" },
    { background: "#fff1f2", color: "#9f1239", border: "1px solid #fecdd3" },
    { background: "#eff6ff", color: "#1e40af", border: "1px solid #bfdbfe" },
    { background: "#fdf4ff", color: "#86198f", border: "1px solid #f5d0fe" },
    { background: "#f0fdf4", color: "#166534", border: "1px solid #bbf7d0" },
    { background: "#f8fafc", color: "#334155", border: "1px solid #cbd5e1" },
  ];
  let hash = 0;
  for (let i = 0; i < relation.length; i++) {
    hash = (hash * 31 + relation.charCodeAt(i)) >>> 0;
  }
  return palettes[hash % palettes.length];
}

export function isClinicalPlan(plan: SemanticPlan): boolean {
  const cfg = plan.schema_config;
  if (cfg) {
    if (cfg.prompt_id === "clinical-preset-v1") return true;
    if (cfg.prompt_id === "generic-evidence-v1" || cfg.prompt_id === "open-discovery-v1") return false;
    if (cfg.mode === "open") return false;
    const labels = cfg.labels || [];
    const clinicalMarkers = ["TREATS", "ADVERSE_EFFECT", "DISCONTINUED", "CONTRAINDICATED", "INDICATED"];
    if (labels.some((l: string) => clinicalMarkers.includes(l))) return true;
  }
  const title = (plan.title || "").toLowerCase();
  const desc = (plan.description || "").toLowerCase();
  if (title.includes("diagnosis") || title.includes("clinical") || desc.includes("clinical")) {
    return true;
  }
  return false;
}

export function SemanticResults({
  plan,
  diff,
  busy,
  onMaterialize,
  onEvidence,
  onPlanUpdated,
  csvHref,
}: {
  plan: SemanticPlan;
  diff?: DiffData;
  busy: boolean;
  onMaterialize: () => void;
  onEvidence: (l: string, r: string) => void;
  onPlanUpdated?: (updated: SemanticPlan) => void;
  csvHref?: (relation?: string) => string;
}) {
  const [view, setView] = useState("table");
  const [relation, setRelation] = useState("all");
  const [allFields, setAllFields] = useState(false);
  const [focus, setFocus] = useState("");
  const [diffMode, setDiffMode] = useState(false);
  const [diffFilter, setDiffFilter] = useState<"all" | DiffStatus>("all");
  const [remapModalOpen, setRemapModalOpen] = useState(false);
  const [remapModalSources, setRemapModalSources] = useState<string[]>([]);

  const activeRows: DiffRow[] =
    diffMode && diff?.has_previous
      ? diff.rows.filter((r) => diffFilter === "all" || r.diff_status === diffFilter)
      : plan.output;

  const relations = [...new Set(activeRows.map((r) => r.relation))];
  const cols = (rows: JoinedRow[], side: "left" | "right") =>
    Array.from(
      new Map(
        rows.flatMap((r) =>
          r[`${side}_columns`].map(
            (name, index) =>
              [JSON.stringify([index, name]), { name, index }] as const,
          ),
        ),
      ).values(),
    );
  return (
    <>
      <div className="integration-plan-title">
        <span className="live-kicker">
          {plan.materialized
            ? "MATERIALIZED SEMANTIC JOIN"
            : "SEMANTIC JOIN PREVIEW"}
        </span>
        <h2>{plan.title}</h2>
        <p>{plan.description}</p>
        <small>
          {plan.model} · {plan.seconds.toFixed(1)} seconds ·{" "}
          {plan.coverage.retained_pairs !== undefined && <span>{plan.coverage.retained_pairs} retained candidates · {plan.coverage.updated_pairs} candidates reviewed this batch · {plan.coverage.pending_pairs} pending. </span>}
          {plan.cached_calls !== undefined && <span>{plan.cached_calls} passage responses reused from cache. </span>}
          {plan.llm_calls !== undefined && <span>{plan.llm_calls} LLM calls. </span>}
          {plan.coverage.reviewed} of {plan.coverage.available_pairs} row pairs
          reviewed
        </small>
      </div>
      {!!plan.curation?.length && <details className="integration-muted">
        <summary>Relationship edit history ({plan.curation.length}) · original labels</summary>
        {plan.provenance_status !== 'model_original' && <p>Legacy baseline: labels before earlier edits cannot be verified.</p>}
        <ol>{plan.curation.map((edit, index) => <li key={index}>
          {edit.sources.join(', ')} → {edit.target} · {new Date(edit.created * 1000).toLocaleString()}
        </li>)}</ol>
        <details><summary>Original recorded decisions</summary>
          <pre style={{maxHeight:240,overflow:'auto',whiteSpace:'pre-wrap'}}>{JSON.stringify(plan.model_decisions, null, 2)}</pre>
        </details>
      </details>}
      <div className="integration-counts">
        <span>
          <b>{plan.output.length}</b> joined rows
        </span>
        <span>
          <b>{plan.counts.abstain}</b> withheld pairs
        </span>
        <span>
          <b>{plan.counts.conflict}</b> conflicting pairs
        </span>
        <span>
          <b>{relations.length}</b> relation types
        </span>
      </div>
      <div className="semantic-overview">
        <div className="relationship-space-card">
          <span className="live-kicker">RELATIONSHIP SPACE</span>
          <p>
            LOKI contextual evidence → HDBSCAN → {isClinicalPlan(plan) ? "clinical relation refinement" : "relation refinement"}
          </p>
          <RelationshipSpace key={plan.id} cases={plan.cases} decisions={plan.decisions} focus={focus}
            onSelect={id => { setFocus(id); setView("decisions"); }} />
        </div>
        <div className="semantic-summary">
          <h3>Full records, connected through evidence</h3>
          <p>
            Record A and Record B fields stay attached to each relationship.
            Different source rows remain separate; multiple evidence passages
            are grouped.
          </p>
          <p>{plan.scope}</p>
          <small>
            Cross-encoder: {plan.pipeline.model} ({plan.pipeline.device}).{" "}
            {plan.coverage.ce_filtered} weak pairs filtered;{" "}
            {plan.coverage.pool_omitted} pairs outside the ranking pool.
          </small>
        </div>
      </div>
      <RelationshipSuggestions key={plan.id} plan={plan} onEvidence={onEvidence}
        onCombine={labels => { setRemapModalSources(labels); setRemapModalOpen(true); }} />
      <div className="integration-actions">
        <button
          aria-pressed={view === "table"}
          onClick={() => setView("table")}
        >
          Relationship tables
        </button>
        <button
          aria-pressed={view === "decisions"}
          onClick={() => {
            setFocus("");
            setView("decisions");
          }}
        >
          Review every decision
        </button>
        {diff?.has_previous && (
          <button
            type="button"
            className={`diff-toggle-btn ${diffMode ? "active" : ""}`}
            aria-pressed={diffMode}
            onClick={() => {
              setDiffMode(!diffMode);
              setDiffFilter("all");
            }}
            title="Compare with immediately preceding run"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M16 3h5v5" />
              <path d="M8 21H3v-5" />
              <path d="M21 3l-7 7" />
              <path d="M3 21l7-7" />
            </svg>
            <span>{diffMode ? "Exit comparison" : "Compare with previous run"}</span>
            <span className="diff-chip-count">
              +{diff.counts.added} · Δ{diff.counts.changed} · -{diff.counts.withdrawn}
            </span>
          </button>
        )}
        <button
          type="button"
          className="integration-primary combine-labels-action-btn"
          disabled={busy || !plan.output.length}
          onClick={() => {
            setRemapModalSources([]);
            setRemapModalOpen(true);
          }}
          title="Combine multiple relationships into one or rename relationship labels"
        >
          Combine / Rename Labels
        </button>
        {plan.materialized ? (
          <a
            href={csvHref ? csvHref() : apiUrl(`/integration/${plan.id}/csv`)}
            download
          >
            Download joined CSV ↓
          </a>
        ) : (
          <button
            className="integration-primary"
            disabled={busy || !plan.output.length}
            onClick={onMaterialize}
          >
            Materialize {plan.output.length} joined rows
          </button>
        )}
      </div>

      {diffMode && diff?.has_previous && (
        <div className="diff-banner" role="region" aria-label="Run comparison info">
          <div className="diff-banner-info">
            <span className="diff-banner-badge">BEFORE / AFTER COMPARISON</span>
            <div className="diff-banner-titles">
              <span className="diff-target-label">
                Current: <strong>{diff.current.title}</strong> (<code>{diff.current.id.slice(0, 8)}</code>)
              </span>
              <span className="diff-vs-arrow">← comparing against</span>
              <span className="diff-base-label">
                Previous: <strong>{diff.previous?.title}</strong> (<code>{diff.previous?.id.slice(0, 8)}</code>
                {diff.previous?.created ? ` · ${new Date(diff.previous.created * 1000).toLocaleDateString()}` : ""}
                )
              </span>
            </div>
          </div>
          <div className="diff-stats-pills" role="toolbar" aria-label="Filter by change type">
            <button type="button" className={`diff-pill ${diffFilter === "not_reviewed" ? "active" : ""}`} onClick={() => setDiffFilter("not_reviewed")}>
              Not reviewed ({diff.counts.not_reviewed || 0})
            </button>
            <button
              type="button"
              className={`diff-pill ${diffFilter === "all" ? "active" : ""}`}
              onClick={() => setDiffFilter("all")}
            >
              All comparison rows ({diff.rows.length})
            </button>
            <button
              type="button"
              className={`diff-pill diff-pill-added ${diffFilter === "added" ? "active" : ""}`}
              onClick={() => setDiffFilter("added")}
            >
              <span className="diff-symbol">+</span> Added ({diff.counts.added})
            </button>
            <button
              type="button"
              className={`diff-pill diff-pill-changed ${diffFilter === "changed" ? "active" : ""}`}
              onClick={() => setDiffFilter("changed")}
            >
              <span className="diff-symbol">Δ</span> Changed ({diff.counts.changed})
            </button>
            <button
              type="button"
              className={`diff-pill diff-pill-withdrawn ${diffFilter === "withdrawn" ? "active" : ""}`}
              onClick={() => setDiffFilter("withdrawn")}
            >
              <span className="diff-symbol">-</span> Withdrawn ({diff.counts.withdrawn})
            </button>
            <button
              type="button"
              className={`diff-pill diff-pill-unchanged ${diffFilter === "unchanged" ? "active" : ""}`}
              onClick={() => setDiffFilter("unchanged")}
            >
              <span className="diff-symbol">=</span> Unchanged ({diff.counts.unchanged})
            </button>
          </div>
        </div>
      )}

      {view === "table" ? (
        <>
          <div
            className="semantic-relation-tabs"
            aria-label="Relationship tables"
          >
            <button
              aria-pressed={relation === "all"}
              onClick={() => setRelation("all")}
            >
              All relationships ({activeRows.length})
            </button>
            {relations.map((r) => (
              <button
                key={r}
                aria-pressed={relation === r}
                onClick={() => setRelation(r)}
              >
                {label(r)} ({activeRows.filter((o) => o.relation === r).length}
                )
              </button>
            ))}
            <label>
              <input
                type="checkbox"
                checked={allFields}
                onChange={(e) => setAllFields(e.target.checked)}
              />
              All source columns
            </label>
          </div>
          {relations
            .filter((r) => relation === "all" || r === relation)
            .map((group) => {
              const rows = activeRows.filter((r) => r.relation === group);
              const leftCols = cols(rows, "left"),
                rightCols = cols(rows, "right");

              const groupCases = rows
                .map((r) => plan.cases?.find((c) => c.candidate === r.candidate))
                .filter(Boolean);

              const cleanSourceName = (n: string) => {
                const base = n.replace(/\.[^/.]+$/, "").replaceAll("_", " ").trim();
                return base.length > 20 ? base.slice(0, 18) + "…" : base;
              };

              const leftSourceNames = [
                ...new Set(
                  groupCases
                    .map((c) => (c!.left?.name ? cleanSourceName(c!.left.name) : ""))
                    .filter(Boolean)
                ),
              ];
              const rightSourceNames = [
                ...new Set(
                  groupCases
                    .map((c) => (c!.right?.name ? cleanSourceName(c!.right.name) : ""))
                    .filter(Boolean)
                ),
              ];

              const isClinical = isClinicalPlan(plan);

              const leftLabel = isClinical
                ? "Diagnosis"
                : leftSourceNames.length === 1
                ? `Record A (${leftSourceNames[0]})`
                : "Record A";

              const relationLabel = isClinical ? "Clinical relationship" : "Relationship";

              const rightLabel = isClinical
                ? "Medication"
                : rightSourceNames.length === 1
                ? `Record B (${rightSourceNames[0]})`
                : "Record B";

              const attributesLabel = isClinical
                ? "Dose / route"
                : rightSourceNames.length === 1
                ? `${rightSourceNames[0]} attributes`
                : "Record B attributes";

              const leftColPrefix = isClinical
                ? "Diagnosis"
                : leftSourceNames.length === 1
                ? leftSourceNames[0]
                : "Record A";

              const rightColPrefix = isClinical
                ? "Medication"
                : rightSourceNames.length === 1
                ? rightSourceNames[0]
                : "Record B";

              return (
                <section
                  className={`relationship-table-group ${group}`}
                  key={group}
                  aria-label={`${label(group)} relationship table`}
                >
                  <header className="relationship-table-heading">
                    <div>
                      <h3>{label(group)}</h3>
                      <p>
                        {rows.length} joined rows · Source records and
                        supporting evidence
                        {diffMode && (
                          <span> · ({rows.filter((x) => x.diff_status === "added").length} added, {rows.filter((x) => x.diff_status === "changed").length} changed, {rows.filter((x) => x.diff_status === "withdrawn").length} withdrawn)</span>
                        )}
                      </p>
                    </div>
                    <div className="relationship-table-heading-actions">
                      <button
                        type="button"
                        className="group-remap-btn"
                        onClick={() => {
                          setRemapModalSources([group]);
                          setRemapModalOpen(true);
                        }}
                        title={`Rename or merge ${group}`}
                      >
                        Rename / Merge
                      </button>
                      {plan.materialized && (
                        <a
                          href={
                            csvHref
                              ? csvHref(group)
                              : apiUrl(`/integration/${plan.id}/csv?relation=${encodeURIComponent(group)}`)
                          }
                          download
                        >
                          Download {label(group)} CSV ↓
                        </a>
                      )}
                    </div>
                  </header>
                  <div className="integration-table semantic-table">
                    <table aria-label={`${label(group)} joined records`}>
                      <thead>
                        <tr>
                          <th>{diffMode ? "Pair / Diff" : "Pair"}</th>
                          {allFields ? (
                            leftCols.map((c, i) => (
                              <th key={i}>{leftColPrefix} · {c.name}</th>
                            ))
                          ) : (
                            <th>{leftLabel}</th>
                          )}
                          <th>{relationLabel}</th>
                          {allFields ? (
                            rightCols.map((c, i) => (
                              <th key={i}>{rightColPrefix} · {c.name}</th>
                            ))
                          ) : (
                            <>
                              <th>{rightLabel}</th>
                              <th>{attributesLabel}</th>
                            </>
                          )}
                          <th>Evidence</th>
                          <th>Trace</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r) => (
                          <tr
                            key={r.diff_key || `${r.candidate}/${r.relation}/${r.direction || ""}/${r.diff_status || ""}`}
                            className={`semantic-row ${diffMode && r.diff_status ? `diff-row-${r.diff_status}` : ""}`}
                          >
                            <td>
                              <div className="pair-cell">
                                <strong>{r.candidate}</strong>
                                <small>Cluster {r.cluster}</small>
                                {diffMode && r.diff_status && (
                                  <span className={`diff-badge diff-badge-${r.diff_status}`}>
                                    {r.diff_status === "added" && "+ Added"}
                                    {r.diff_status === "changed" && "Δ Changed"}
                                    {r.diff_status === "withdrawn" && "- Withdrawn"}
                                    {r.diff_status === "unchanged" && "= Unchanged"}
                                    {r.diff_status === "not_reviewed" && "Not reviewed"}
                                  </span>
                                )}
                              </div>
                            </td>
                            {allFields ? (
                              leftCols.map((c, i) => (
                                <td key={i}>
                                  {r.left_columns[c.index] === c.name
                                    ? r.left_cells[c.index] || "—"
                                    : "—"}
                                </td>
                              ))
                            ) : (
                              <td>{r.left_value}</td>
                            )}
                            <td>
                              <span
                                className={`semantic-relation ${r.relation}`}
                                style={getPredicateStyle(r.relation)}
                              >
                                {label(r.relation)}
                              </span>
                              {r.direction && r.direction !== "undirected" && (
                                <small className="direction-badge" style={{ display: "block", color: "#666", fontSize: "0.8em", marginTop: "2px" }}>
                                  {r.direction === "a_to_b" ? "A → B" : r.direction === "b_to_a" ? "B → A" : r.direction === "bidirectional" ? "A ↔ B" : r.direction}
                                </small>
                              )}
                              {diffMode && r.diff_notes && (
                                <small className="diff-row-notes">{r.diff_notes}</small>
                              )}
                            </td>
                            {allFields ? (
                              rightCols.map((c, i) => (
                                <td key={i}>
                                  {r.right_columns[c.index] === c.name
                                    ? r.right_cells[c.index] || "—"
                                    : "—"}
                                </td>
                              ))
                            ) : (
                              <>
                                <td>{r.right_value}</td>
                                <td>
                                  {(() => {
                                    if (isClinical) {
                                      const clinical = ["dosage", "unit", "route"]
                                        .map((c) => r.right_cells[r.right_columns.findIndex((n) => n.toLowerCase() === c)])
                                        .filter(Boolean)
                                        .join(" · ");
                                      if (clinical) return clinical;
                                    }
                                    const others = r.right_columns
                                      .map((name, i) => ({ name, val: r.right_cells[i] }))
                                      .filter((c, i) => c.val && c.val !== r.right_value && i !== 0)
                                      .map((c) => `${c.name}: ${c.val}`)
                                      .join(" · ");
                                    return others || "—";
                                  })()}
                                </td>
                              </>
                            )}
                            <td>
                              <mark>{r.evidence_quote}</mark>
                              <small>
                                {r.evidence_count} supporting passage
                                {r.evidence_count === 1 ? "" : "s"}
                                {r.path_count
                                  ? ` · ${r.path_count} sentence paths`
                                  : ""}
                              </small>
                            </td>
                            <td>
                              <button
                                onClick={() =>
                                  onEvidence(r.left_link, r.right_link)
                                }
                              >
                                Inspect evidence
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {!rows.length && (
                      <p>
                        No supported relationships in this selection. Review the
                        withheld decisions and their source evidence.
                      </p>
                    )}
                  </div>
                </section>
              );
            })}
          {!plan.output.length && (
            <p>
              No supported relationships yet. Review the withheld decisions and
              their source evidence.
            </p>
          )}
          <p className="integration-muted">
            {isClinicalPlan(plan)
              ? "Clinical relation labels are model proposals. Matching a clinical relationship does not establish patient or admission identity. CSV includes every projected source column and evidence provenance."
              : "Relation labels are model proposals. CSV includes every projected source column and evidence provenance."}
          </p>
        </>
      ) : (
        <div className="integration-decisions">
          {focus && (
            <button onClick={() => setFocus("")}>
              Show all reviewed pairs
            </button>
          )}
          {plan.decisions
            .filter((d) => !focus || d.candidate === focus)
            .map((d) => {
              const c = plan.cases.find((c) => c.candidate === d.candidate)!;
              return (
                <article key={d.candidate}>
                  <div>
                    <strong>
                      {d.candidate} ·{" "}
                      {c.left.record.cells[c.left.anchor_column]} ↔{" "}
                      {c.right.record.cells[c.right.anchor_column]}
                    </strong>
                    <span className={`integration-disposition ${d.status}`}>
                      {d.status === "include" ? "proposed join" : d.status}
                    </span>
                  </div>
                  <small>
                    Raw cluster {c.cluster}
                    {c.noise ? " · HDBSCAN noise kept as singleton" : ""} ·{" "}
                    {c.left.name} + {c.right.name}
                  </small>
                  {d.path_decisions.map((v, i) => {
                    const p = c.paths.find((p) => p.evidence === v.evidence)!;
                    const quoteA = v.record_a_quote || v.diagnosis_quote;
                    const quoteB = v.record_b_quote || v.medication_quote;
                    const isClinical = isClinicalPlan(plan);
                    return (
                      <section className="semantic-path" key={i}>
                        <strong>
                          {label(v.relationship)} · {label(v.basis)}
                        </strong>
                        <p>{v.reason}</p>
                        <blockquote>{p.context_text || p.text}</blockquote>
                        {(quoteA || quoteB) && (
                          <p>
                            {isClinical ? "Diagnosis evidence" : "Record A evidence"}:{" "}
                            {quoteA || "Not established"}
                            <br />
                            {isClinical ? "Medication evidence" : "Record B evidence"}:{" "}
                            {quoteB || "Not established"}
                          </p>
                        )}
                        <small>
                          LOKI {p.score.toFixed(3)} · cross-encoder{" "}
                          {p.ce_score.toFixed(3)}
                        </small>
                        <button onClick={() => onEvidence(p.left, p.right)}>
                          Inspect this passage
                        </button>
                        {(p.anchors || []).slice(1).map((anchor, index) => (
                          <button
                            key={`${anchor.left}/${anchor.right}`}
                            onClick={() =>
                              onEvidence(anchor.left, anchor.right)
                            }
                          >
                            Sentence path {index + 2}
                          </button>
                        ))}
                      </section>
                    );
                  })}
                  <small>{d.validation}</small>
                </article>
              );
            })}
        </div>
      )}
      <CombineRelationshipsModal
        isOpen={remapModalOpen}
        onClose={() => setRemapModalOpen(false)}
        plan={plan}
        initialSources={remapModalSources}
        onPlanUpdated={(updated) => {
          const newRelations = [...new Set(updated.output.map((r) => r.relation))];
          if (relation !== "all" && !newRelations.includes(relation)) {
            setRelation("all");
          }
          onPlanUpdated?.(updated);
        }}
      />
    </>
  );
}
