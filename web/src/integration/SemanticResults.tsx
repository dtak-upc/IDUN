import { apiUrl, api } from "../storage/api";
import { useState, useEffect } from "react";
import { RelationshipSpace } from "./RelationshipSpace";
import { RelationshipSuggestions } from "./RelationshipSuggestions";
import { CombineRelationshipsModal } from "./CombineRelationshipsModal";

export type OuterScope = {
  scope_id: string;
  relation: string;
  left_table: {
    id: string;
    name: string;
    version: string;
    columns: string[];
    total_rows: number;
    matched_rows: number;
    unmatched_rows: number;
  };
  right_table: {
    id: string;
    name: string;
    version: string;
    columns: string[];
    total_rows: number;
    matched_rows: number;
    unmatched_rows: number;
  };
  matched_pairs_count: number;
  is_self_join: boolean;
};

export type OuterView = {
  plan_id: string;
  policy: string;
  scope: OuterScope;
  counts: {
    matched_rows: number;
    unmatched_left: number;
    unmatched_right: number;
    total_rows: number;
    unique_matched_left_records: number;
    unique_matched_right_records: number;
    reasons_breakdown: Record<string, number>;
  };
  columns: {
    left_columns: string[];
    right_columns: string[];
  };
  rows: any[];
  notice: string;
};

export type SchemaConfig = {
  mode?: "strict" | "hybrid" | "open";
  labels?: string[];
  definitions?: Record<string, string>;
  prompt_id?: string;
  context_config?: any;
  preset?: string;
};

export type SemanticPlan = {
  journey_input?: {revision:string;evidence_filter?:{min_score?:number;max_score?:number;top_k?:number};summary?:{links?:number;bridges?:number}};
  parent_run_id?: string;
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
  left_record?: string;
  right_record?: string;
  evidence?: {evidence?:string;text?:string;context_text?:string;score?:number;ce_score?:number}[];
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
  onMaterialize: (policy?: string) => void;
  onEvidence: (l: string, r: string) => void;
  onPlanUpdated?: (updated: SemanticPlan) => void;
  csvHref?: (relation?: string, policy?: string) => string;
}) {
  const [view, setView] = useState("table");
  const [relation, setRelation] = useState("all");
  const [allFields, setAllFields] = useState(false);
  const [focus, setFocus] = useState("");
  const [diffMode, setDiffMode] = useState(false);
  const [diffFilter, setDiffFilter] = useState<"all" | DiffStatus>("all");
  const [remapModalOpen, setRemapModalOpen] = useState(false);
  const [remapModalSources, setRemapModalSources] = useState<string[]>([]);
  const [resumeReview, setResumeReview] = useState<{panel:'meanings'|'pairs';serial:number}>();
  const [mergeSuggestion, setMergeSuggestion] = useState<{target:string;kind:'equivalent'|'direction_review'|'structural'} | undefined>();
  const [outerPolicy, setOuterPolicy] = useState<"matched-only" | "preserve-left" | "preserve-both">("matched-only");
  const [outerScopes, setOuterScopes] = useState<OuterScope[]>([]);
  const [outerViews, setOuterViews] = useState<Record<string, OuterView>>({});

  useEffect(() => {
    let active = true;
    api<OuterScope[]>(`/integration/${plan.id}/outer-scopes`)
      .then((scopes) => {
        if (active) setOuterScopes(scopes || []);
      })
      .catch(() => {
        if (active) setOuterScopes([]);
      });
    return () => {
      active = false;
    };
  }, [plan.id]);

  useEffect(() => {
    let active = true;
    if (outerPolicy === "matched-only") return;
    const rels = [...new Set(plan.output.map((r) => r.relation))];
    Promise.all(
      rels.map(async (rel) => {
        try {
          const v = await api<OuterView>(
            `/integration/${plan.id}/outer-view?policy=${outerPolicy}&relation=${encodeURIComponent(rel)}`
          );
          return [rel, v] as const;
        } catch {
          return null;
        }
      })
    ).then((results) => {
      if (active) {
        const next: Record<string, OuterView> = {};
        for (const item of results) {
          if (item) next[item[0]] = item[1];
        }
        setOuterViews(next);
      }
    });
    return () => {
      active = false;
    };
  }, [plan.id, outerPolicy, plan.output]);

  const activeRows: DiffRow[] =
    diffMode && diff?.has_previous
      ? diff.rows.filter((r) => diffFilter === "all" || r.diff_status === diffFilter)
      : plan.output;

  const relations = [...new Set(activeRows.map((r) => r.relation))];

  const getCsvUrl = (rel?: string) => {
    if (csvHref) {
      return csvHref(rel, outerPolicy !== "matched-only" ? outerPolicy : undefined);
    }
    const params = new URLSearchParams();
    if (rel) params.set("relation", rel);
    if (outerPolicy !== "matched-only") params.set("policy", outerPolicy);
    const q = params.toString();
    return apiUrl(`/integration/${plan.id}/csv${q ? `?${q}` : ""}`);
  };
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
      <RelationshipSuggestions key={plan.id} plan={plan} resumeReview={resumeReview} onEvidence={onEvidence}
        onCombine={(labels, suggestion) => { setRemapModalSources(labels); setMergeSuggestion(suggestion); setRemapModalOpen(true); }} />
      <div className="integration-actions">
        <button
          aria-pressed={view === "table"}
          onClick={() => setView("table")}
        >
          Relationship Tables
        </button>
        <button
          aria-pressed={view === "decisions"}
          onClick={() => {
            setFocus("");
            setView("decisions");
          }}
        >
          Review Every Decision
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
            setMergeSuggestion(undefined);
            setRemapModalSources([]);
            setRemapModalOpen(true);
          }}
          title="Combine multiple relationships into one or rename relationship labels"
        >
          Combine / Rename Labels
        </button>
        {plan.materialized ? (
          <a
            href={getCsvUrl()}
            download
          >
            Download {outerPolicy === "matched-only" ? "joined" : outerPolicy === "preserve-left" ? "left-outer" : "full-outer"} CSV ↓
          </a>
        ) : (
          <button
            className="integration-primary"
            disabled={busy || (!plan.output.length && outerPolicy === "matched-only")}
            onClick={() => onMaterialize(outerPolicy)}
          >
            Materialize {outerPolicy === "matched-only" ? `${plan.output.length} joined rows` : `${outerPolicy} view`}
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
          <div className="outer-policy-toolbar" role="toolbar" aria-label="Join materialization policy">
            <span className="outer-policy-label">Retention Policy:</span>
            <div className="outer-policy-buttons">
              <button
                type="button"
                className={`outer-policy-btn ${outerPolicy === "matched-only" ? "active" : ""}`}
                aria-pressed={outerPolicy === "matched-only"}
                onClick={() => setOuterPolicy("matched-only")}
                title="Matched only: evidence-confirmed relationships only (Inner join)"
              >
                Matched Only (Inner)
              </button>
              <button
                type="button"
                className={`outer-policy-btn ${outerPolicy === "preserve-left" ? "active" : ""}`}
                aria-pressed={outerPolicy === "preserve-left"}
                onClick={() => setOuterPolicy("preserve-left")}
                title="Preserve left: retain all left source records, marking counterparts as [OUTER_NULL] (Left outer join)"
              >
                Preserve Left (Left Outer)
              </button>
              <button
                type="button"
                className={`outer-policy-btn ${outerPolicy === "preserve-both" ? "active" : ""}`}
                aria-pressed={outerPolicy === "preserve-both"}
                onClick={() => setOuterPolicy("preserve-both")}
                title="Preserve both: retain all left and right source records, marking counterparts as [OUTER_NULL] (Full outer join)"
              >
                Preserve Both (Full Outer)
              </button>
            </div>
          </div>
          <div
            className="semantic-relation-tabs"
            aria-label="Relationship tables"
          >
            <button
              aria-pressed={relation === "all"}
              onClick={() => setRelation("all")}
            >
              All Relationships ({activeRows.length})
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
              const isOuter = outerPolicy !== "matched-only";
              const outerView = isOuter ? outerViews[group] : undefined;
              const rows = outerView ? outerView.rows : activeRows.filter((r) => r.relation === group);
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
                        {rows.length} {isOuter ? "materialized rows" : "joined rows"} · Source records and
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
                          setMergeSuggestion(undefined); setRemapModalSources([group]);
                          setRemapModalOpen(true);
                        }}
                        title={`Rename or merge ${group}`}
                      >
                        Rename / Merge
                      </button>
                      {plan.materialized && (
                        <a
                          href={getCsvUrl(group)}
                          download
                        >
                          Download {label(group)} CSV ↓
                        </a>
                      )}
                    </div>
                  </header>
                  {outerView && (
                    <div className="outer-scope-card" role="region" aria-label="Outer join scope and provenance">
                      <div className="outer-scope-header">
                        <div className="outer-scope-title-wrap">
                          <span className="outer-scope-badge">
                            {outerPolicy === "preserve-left" ? "LEFT OUTER JOIN SCOPE" : "FULL OUTER JOIN SCOPE"}
                          </span>
                          <h4>Scope: {outerView.scope.left_table.name} ↔ {outerView.scope.right_table.name}</h4>
                        </div>
                        <div className="outer-scope-counts-summary">
                          <span><strong>{outerView.counts.total_rows}</strong> total rows</span>
                          <span className="outer-scope-counts-detail">
                            (<strong>{outerView.counts.matched_rows}</strong> matched, <strong>{outerView.counts.unmatched_left}</strong> unmatched left{outerPolicy === "preserve-both" ? `, <strong>${outerView.counts.unmatched_right}</strong> unmatched right` : ""})
                          </span>
                        </div>
                      </div>

                      <div className="outer-scope-tables-grid">
                        <div className="outer-scope-table-info">
                          <div className="scope-table-title">Left Table: <strong>{outerView.scope.left_table.name}</strong></div>
                          <small className="scope-table-meta">Version: {outerView.scope.left_table.version || "initial"} · {outerView.scope.left_table.total_rows} total rows ({outerView.scope.left_table.matched_rows} matched, {outerView.scope.left_table.unmatched_rows} unmatched)</small>
                        </div>
                        <div className="outer-scope-table-info">
                          <div className="scope-table-title">Right Table: <strong>{outerView.scope.right_table.name}</strong></div>
                          <small className="scope-table-meta">Version: {outerView.scope.right_table.version || "initial"} · {outerView.scope.right_table.total_rows} total rows ({outerView.scope.right_table.matched_rows} matched{outerPolicy === "preserve-both" ? `, ${outerView.scope.right_table.unmatched_rows} unmatched` : ""})</small>
                        </div>
                      </div>

                      {Object.keys(outerView.counts.reasons_breakdown || {}).length > 0 && (
                        <div className="outer-reasons-bar">
                          <span className="outer-reasons-label">Unmatched Retention Reasons:</span>
                          <div className="outer-reasons-pills">
                            {Object.entries(outerView.counts.reasons_breakdown).map(([reason, count]) => (
                              <span key={reason} className={`reason-pill reason-${reason}`}>
                                <code>{reason.replace("_", " ")}</code>: <strong>{count}</strong>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="outer-epistemic-notice">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <circle cx="12" cy="12" r="10" />
                          <line x1="12" y1="16" x2="12" y2="12" />
                          <line x1="12" y1="8" x2="12.01" y2="8" />
                        </svg>
                        <span>{outerView.notice}</span>
                      </div>
                    </div>
                  )}
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
                        {rows.map((r) => {
                          const isUnmatched = r.retention_type && r.retention_type !== "matched";
                          const rowKey = r.diff_key || `${r.candidate}/${r.relation}/${r.direction || ""}/${r.diff_status || ""}`;
                          return (
                            <tr
                              key={rowKey}
                              className={`semantic-row ${diffMode && r.diff_status ? `diff-row-${r.diff_status}` : ""} ${isUnmatched ? `outer-unmatched-row ${r.retention_type}` : ""}`}
                            >
                              <td>
                                <div className="pair-cell">
                                  <strong>{r.candidate}</strong>
                                  {isUnmatched ? (
                                    <div className="retention-badges">
                                      <span className={`retention-badge ${r.retention_type}`}>
                                        {r.retention_type === "unmatched_left" ? "Unmatched Left" : "Unmatched Right"}
                                      </span>
                                      {r.unestablished_reason && (
                                        <span className={`reason-badge reason-${r.unestablished_reason}`} title={`Unestablished reason: ${r.unestablished_reason}`}>
                                          {r.unestablished_reason.replace("_", " ")}
                                        </span>
                                      )}
                                    </div>
                                  ) : (
                                    <small>Cluster {r.cluster}</small>
                                  )}
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
                                leftCols.map((c, i) => {
                                  const val = r.left_columns?.[c.index] === c.name ? r.left_cells?.[c.index] : "—";
                                  return (
                                    <td key={i}>
                                      {val === "[OUTER_NULL]" || r.is_outer_left_null ? (
                                        <span className="outer-null-tag">[OUTER_NULL]</span>
                                      ) : (
                                        val || "—"
                                      )}
                                    </td>
                                  );
                                })
                              ) : (
                                <td>
                                  {r.is_outer_left_null || r.left_value === "[OUTER_NULL]" ? (
                                    <span className="outer-null-tag">[OUTER_NULL]</span>
                                  ) : (
                                    r.left_value
                                  )}
                                </td>
                              )}
                              <td>
                                {r.relation === "UNESTABLISHED" ? (
                                  <span className="semantic-relation unestablished" title="No relationship established for this unmatched row">
                                    UNESTABLISHED
                                  </span>
                                ) : (
                                  <span
                                    className={`semantic-relation ${r.relation}`}
                                    style={getPredicateStyle(r.relation)}
                                  >
                                    {label(r.relation)}
                                  </span>
                                )}
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
                                rightCols.map((c, i) => {
                                  const val = r.right_columns?.[c.index] === c.name ? r.right_cells?.[c.index] : "—";
                                  return (
                                    <td key={i}>
                                      {val === "[OUTER_NULL]" || r.is_outer_right_null ? (
                                        <span className="outer-null-tag">[OUTER_NULL]</span>
                                      ) : (
                                        val || "—"
                                      )}
                                    </td>
                                  );
                                })
                              ) : (
                                <>
                                  <td>
                                    {r.is_outer_right_null || r.right_value === "[OUTER_NULL]" ? (
                                      <span className="outer-null-tag">[OUTER_NULL]</span>
                                    ) : (
                                      r.right_value
                                    )}
                                  </td>
                                  <td>
                                    {r.is_outer_right_null ? (
                                      <span className="outer-null-tag">[OUTER_NULL]</span>
                                    ) : (
                                      (() => {
                                        if (isClinical) {
                                          const clinical = ["dosage", "unit", "route"]
                                            .map((c: string) => r.right_cells?.[r.right_columns?.findIndex((n: string) => n.toLowerCase() === c)])
                                            .filter(Boolean)
                                            .join(" · ");
                                          if (clinical) return clinical;
                                        }
                                        const others = (r.right_columns || [])
                                          .map((name: string, i: number) => ({ name, val: r.right_cells?.[i] }))
                                          .filter((c: { name: string; val: any }, i: number) => c.val && c.val !== r.right_value && c.val !== "[OUTER_NULL]" && i !== 0)
                                          .map((c: { name: string; val: any }) => `${c.name}: ${c.val}`)
                                          .join(" · ");
                                        return others || "—";
                                      })()
                                    )}
                                  </td>
                                </>
                              )}
                              <td>
                                {isUnmatched ? (
                                  <span className="outer-evidence-muted">{r.evidence_quote}</span>
                                ) : (
                                  <>
                                    <mark>{r.evidence_quote}</mark>
                                    <small>
                                      {r.evidence_count} supporting passage
                                      {r.evidence_count === 1 ? "" : "s"}
                                      {r.path_count
                                        ? ` · ${r.path_count} sentence paths`
                                        : ""}
                                    </small>
                                  </>
                                )}
                              </td>
                              <td>
                                {isUnmatched ? (
                                  <span className="trace-muted">—</span>
                                ) : (
                                  <button
                                    onClick={() =>
                                      onEvidence(r.left_link, r.right_link)
                                    }
                                  >
                                    Inspect evidence
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
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
        onClose={() => { setRemapModalOpen(false); if (mergeSuggestion) setResumeReview(old => ({panel: mergeSuggestion.kind === 'structural' ? 'pairs' : 'meanings', serial: (old?.serial || 0) + 1})); }}
        plan={plan}
        initialSources={remapModalSources}
        suggestion={mergeSuggestion}
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
