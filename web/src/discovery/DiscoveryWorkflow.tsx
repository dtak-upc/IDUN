import { useEffect, useRef, useState } from "react";
import { api, post, selectedApiLake } from "../storage/api";
import { savedDemo, inferenceUnavailable } from "../mode";
import { PublishedEvidence } from "./LiveDiscovery";
import type { CommittedScope } from "../inference/ReviewScope";
import { DataJourneyButton } from "../journey/DataJourneyButton";
import {SavedJourney} from '../journey/SavedJourney';
import { DiscoveryJourney } from "../journey/DiscoveryJourney";
import "./workflow.css";
type Matrix = {
  generation: string;
  cells: number;
  contexts: number;
  rows: number;
  text_units: number;
  tables: number;
  documents: number;
  score_bytes: number;
  histogram: number[];
};
type State = {
  status: string;
  revision?: string;
  matrix?: Matrix;
  scope?: CommittedScope;
  sources?: { id: string; name: string }[];
  evidence_filter?: { bridge_cap?: number };
  coverage?: { bridges_omitted?: number; bridge_cap?: number };
  summary?: { links: number; bridges: number };
  work?: { device: string; seconds: number; scored_contexts: number };
  job?: { status: string; phase: string; completed: number; total: number };
};
type Score = {
  id: string;
  table_name: string;
  document_name: string;
  row_index: number;
  score: number;
  row_preview: string;
  text_preview: string;
  start: number;
  end: number;
};
type Query = {
  generation: string;
  total: number;
  offset: number;
  items: Score[];
  histogram: number[];
};
const explanations: Record<string, string> = {
  "Source pairs":
    "Table–document pairs admitted by the Data Lake scope. LOKI only examines these source combinations.",
  Tables: "Distinct tables in the selected scope or computed contexts.",
  Documents:
    "Distinct text documents in the selected scope or computed contexts.",
  "Indexed combinations":
    "Estimated indexed rows × text units over source pairs. Actual contextual work can differ because windows overlap and eligible rows may be prepared later.",
  "Score observations":
    "Every row × text-unit score in every eligible LOKI context, including negative scores. Repeated row/span pairs in overlapping contexts are separate observations. These are not unique links or probabilities.",
  "Table rows":
    "Unique source rows actually scored, identified by source and row index.",
  "Text units":
    "Unique source text spans actually scored. A unit can occur in multiple overlapping contexts.",
  "Context blocks":
    "Batches of table rows and document units scored together. A context is not a table–document pair; multiple pairs can share one context and one pair can span several contexts.",
  "Score storage":
    "Compressed float32 numerical scores only. Source mappings, contextual sentence vectors and published evidence take additional space.",
  "Matching observations":
    "Saved contextual scores passing the current range, source and per-row Top-K filters. Changing these filters never calls LOKI.",
  "Published atomic links":
    "Bounded evidence prepared for Integration. Per-context row limits and cross-table retention apply; this number is not the complete score count.",
  "Published join paths":
    "Retained pairs of rows with shared text evidence. These are candidate paths, not verified semantic relationships.",
  "Scoring time":
    "Time recorded for the original score computation, including orchestration. Filtering has separate work and makes no model calls.",
};
export function DiscoveryWorkflow({
  onOpenEvidence,
  onIntake,
  onIntegration,
}: {
  onOpenEvidence: (id: string, companion?: string) => void;
  onIntake: () => void;
  onIntegration?: () => void;
}) {
  const lake = selectedApiLake(),
    stepKey = `idun:discovery-step:${lake}`;
  const [committed] = useState<CommittedScope | undefined>(() => {
    try {
      return (
        JSON.parse(
          sessionStorage.getItem(`idun:discovery-scope:${lake}`) || "null",
        ) || undefined
      );
    } catch {
      return undefined;
    }
  });
  const [useScope, setUseScope] = useState(!!committed);
  const [step, setStep] = useState(() => {
    const saved = sessionStorage.getItem(stepKey);
    return saved && ["scope", "compute", "explore"].includes(saved)
      ? saved
      : "scope";
  });
  const [state, setState] = useState<State>();
  const [scope, setScope] = useState<CommittedScope>();
  const [scopeError, setScopeError] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [metric, setMetric] = useState("");
  const [low, setLow] = useState("-1");
  const [high, setHigh] = useState("1.01");
  const [topK, setTopK] = useState("0");
  const [bridgeCap, setBridgeCap] = useState("2000");
  const capGeneration = useRef("");
  const [source, setSource] = useState("");
  const [sort, setSort] = useState("desc");
  const [offset, setOffset] = useState(0);
  const [query, setQuery] = useState<Query>();
  const [loading, setLoading] = useState(false);
  const [showEvidence, setShowEvidence] = useState(false);
  const epoch = useRef(0);
  const running =
    busy ||
    ["queued", "running", "cancelling"].includes(state?.job?.status || "");
  const ready = state?.status === "ready";
  const matrix = ready ? state?.matrix : undefined;
  useEffect(() => {
    if (matrix && capGeneration.current !== matrix.generation) {
      capGeneration.current = matrix.generation;
      setBridgeCap(String(state?.evidence_filter?.bridge_cap ?? 2000));
    }
  }, [matrix?.generation, state?.evidence_filter]);
  const validBridgeCap =
    bridgeCap !== "" &&
    Number.isSafeInteger(Number(bridgeCap)) &&
    Number(bridgeCap) >= 0;
  useEffect(() => {
    sessionStorage.setItem(stepKey, step);
    setMetric("");
  }, [step, stepKey]);
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    async function poll() {
      const token = epoch.current;
      try {
        const r = await api<State>("/discovery", { signal: controller.signal });
        if (active && token === epoch.current) setState(r);
      } catch (e) {
        if (active) setError(String(e));
      } finally {
        if (active) timer = setTimeout(poll, 1800);
      }
    }
    void poll();
    return () => {
      active = false;
      controller.abort();
      clearTimeout(timer);
    };
  }, []);
  useEffect(() => {
    let active = true;
    setScope(undefined);
    setScopeError("");
    if (savedDemo) return;
    (async () => {
      if (useScope && committed) {
        const r = await post<CommittedScope>("/discovery/scope/describe", {
          id: committed.id,
        });
        if (active) setScope(r);
      } else {
        const g = await api<{ graph: { generation: string } }>(
          "/profile/graph",
        );
        const r = await post<CommittedScope>("/discovery/scope/preview", {
          generation: g.graph.generation,
          recipe: { mode: "all" },
        });
        if (active) setScope(r);
      }
    })().catch((e) => {
      if (active) setScopeError(String(e));
    });
    return () => {
      active = false;
    };
  }, [useScope, committed]);
  useEffect(() => {
    setOffset(0);
    setShowEvidence(false);
  }, [low, high, topK, source, sort, matrix?.generation]);
  const valid =
    low !== "" &&
    high !== "" &&
    Number.isFinite(Number(low)) &&
    Number.isFinite(Number(high)) &&
    Number(low) >= -1.01 &&
    Number(high) <= 1.01 &&
    Number(low) <= Number(high) &&
    Number.isInteger(Number(topK)) &&
    Number(topK) >= 0 &&
    Number(topK) <= 32;
  const body = {
    generation: matrix?.generation,
    min_score: Number(low),
    max_score: Number(high),
    top_k: Number(topK),
    source,
    sort,
  };
  useEffect(() => {
    let active = true;
    setQuery(undefined);
    if (!matrix || step !== "explore" || !valid) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const timer = setTimeout(() => {
      post<Query>("/discovery/scores/query", { ...body, offset })
        .then((r) => {
          if (active) {
            setQuery(r);
            setError("");
          }
        })
        .catch((e) => {
          if (active) setError(String(e));
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 220);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [matrix?.generation, step, low, high, topK, source, sort, offset, valid]);
  async function start(filter = false) {
    epoch.current++;
    setBusy(true);
    setError("");
    try {
      setState(
        await post<State>(
          filter ? "/discovery/filter" : "/discovery",
          filter
            ? { ...body, bridge_cap: Number(bridgeCap) }
            : useScope && committed
              ? { scope_id: committed.id }
              : {},
        ),
      );
      if (!filter) setStep("compute");
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (!metric) return;
    const outside = (e: PointerEvent) => {
      if (!(e.target as Element).closest(".dw-stat-wrap")) setMetric("");
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMetric("");
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [metric]);
  function card(label: string, value: unknown) {
    const id = `dw-help-${label.toLowerCase().replaceAll(" ", "-")}`;
    return (
      <div className="dw-stat-wrap">
        <button
          className="dw-stat"
          onClick={() => setMetric(metric === label ? "" : label)}
          aria-expanded={metric === label}
          aria-controls={id}
        >
          <span>
            {label}
            <i aria-hidden="true">ⓘ</i>
          </span>
          <strong>
            {typeof value === "number"
              ? value.toLocaleString()
              : String(value ?? "—")}
          </strong>
        </button>
        {metric === label && (
          <aside
            id={id}
            className="dw-metric-popover dw-definition"
            role="dialog"
            aria-label={`${label} explained`}
          >
            <div>
              <strong>{label}</strong>
              <button
                aria-label="Close explanation"
                onClick={() => setMetric("")}
              >
                ×
              </button>
            </div>
            <p>{explanations[label]}</p>
            <small>Click outside or press Escape to dismiss</small>
          </aside>
        )}
      </div>
    );
  }
  return (
    <section className="dw" aria-label="Live LOKI discovery">
      <header className="dw-heading journey-workspace-heading">
        <div>
          <span className="dw-kicker">LOKI / DISCOVERY</span>
          <h1>From Sources to Evidence</h1>
          <p>
            Compute once. Explore the scores. Choose the evidence worth
            connecting.
          </p>
        </div>
        <div className="journey-header-actions">
        {(matrix || ready) && <span className="dw-pill">
          {matrix
            ? "Complete scores saved"
            : "Earlier evidence available"}
        </span>}
        <DataJourneyButton stage="Discovery">{savedDemo?<SavedJourney lakeId={lake} discovery/>:<DiscoveryJourney scope={scope} scopeError={scopeError} initialTab={step==='scope'?'scope':'evidence'} lakeId={lake} refreshKey={`${state?.status}/${state?.revision}`} onEvidence={onOpenEvidence}
          preview={matrix?{policy:{...body,bridge_cap:Number(bridgeCap)},matching:query?.total,loading,valid:valid&&validBridgeCap,generation:matrix.generation}:undefined}/>}</DataJourneyButton>
        </div>
      </header>
      <nav
        className="dw-steps"
        role="tablist"
        aria-label="Discovery steps"
        onKeyDown={(e) => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key))
            return;
          const tabs = [
            ...e.currentTarget.querySelectorAll<HTMLButtonElement>(
              "button:not(:disabled)",
            ),
          ];
          const i = tabs.indexOf(document.activeElement as HTMLButtonElement);
          const next =
            e.key === "Home"
              ? 0
              : e.key === "End"
                ? tabs.length - 1
                : (i + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) %
                  tabs.length;
          e.preventDefault();
          tabs[next]?.focus();
          tabs[next]?.click();
        }}
      >
        {[
          ["scope", "01", "Scope Overview"],
          ["compute", "02", "Compute Scores"],
          ["explore", "03", "Explore Results"],
        ].map(([id, n, label]) => (
          <button
            key={id}
            role="tab"
            tabIndex={step === id ? 0 : -1}
            id={`discovery-${id}-tab`}
            aria-controls={`discovery-${id}-panel`}
            aria-selected={step === id}
            disabled={id === "explore" && !ready}
            onClick={() => {
              setStep(id);
              setMetric("");
            }}
          >
            <b>
              {(id === "scope" && scope && step !== "scope") ||
              (id === "compute" && matrix && step !== "compute")
                ? "✓"
                : n}
            </b>
            <span>
              {label}
              <small>
                {id === "scope"
                  ? "Understand the Input"
                  : id === "compute"
                    ? "Save All Contextual Scores"
                    : "Filter Without Rescoring"}
              </small>
            </span>
          </button>
        ))}
        <span
          className="dw-step-track"
          aria-hidden="true"
          style={{
            transform: `translateX(${["scope", "compute", "explore"].indexOf(step) * 100}%)`,
          }}
        />
      </nav>
      {error && (
        <p role="alert" className="dw-alert">
          {error}
        </p>
      )}
      {step === "scope" && (
        <div
          className="dw-stage"
          role="tabpanel"
          id="discovery-scope-panel"
          aria-labelledby="discovery-scope-tab"
        >
          <div className="dw-section-heading">
            <div>
              <h2>Your starting scope</h2>
              <p>The boundary carried forward from Data Lake.</p>
            </div>
            <button onClick={onIntake}>Review in Data Lake →</button>
          </div>
          {!savedDemo && (
            <label className="dw-input">
              Discovery input
              <select
                disabled={running}
                value={useScope ? "scope" : "all"}
                onChange={(e) => setUseScope(e.target.value === "scope")}
              >
                <option value="all">Whole profiled candidate graph</option>
                {committed && (
                  <option value="scope">
                    Committed selection · {committed.counts.pairs} pairs
                  </option>
                )}
              </select>
            </label>
          )}
          {scopeError && <p role="alert">{scopeError}</p>}
          {!savedDemo && scope ? <div className="journey-review-summary"><strong>{scope.counts.pairs.toLocaleString()} source pairs selected</strong><span>{scope.counts.tables} tables · {scope.counts.documents} documents</span></div> : <div className="dw-stats">
            {card("Source pairs", scope?.counts.pairs)}
            {card("Tables", scope?.counts.tables)}
            {card("Documents", scope?.counts.documents)}
            {card("Indexed combinations", scope?.indexed_pair_scores)}
          </div>}
          <p className="dw-hint">
            {!savedDemo && scope
              ? 'Use Data Journey at the top to inspect included and outside-scope pairs. Source-pair selection stays fixed during computation.'
              : 'Click a statistic to see what it measures. Source-pair selection stays fixed during computation.'}
          </p>
          <button
            className="dw-primary"
            disabled={!savedDemo && !scope}
            onClick={() => setStep("compute")}
          >
            Continue to Compute Scores →
          </button>
        </div>
      )}
      {step === "compute" && (
        <div
          className="dw-stage"
          role="tabpanel"
          id="discovery-compute-panel"
          aria-labelledby="discovery-compute-tab"
        >
          <div className="dw-compute">
            <span className="dw-orbit" aria-hidden="true">
              ⌘
            </span>
            <div>
              <h2>One computation. Every score.</h2>
              <p>
                LOKI scores all row–text combinations in the eligible scoped
                contexts. Negative and low scores are saved too. Choose
                thresholds afterward.
              </p>
              <button
                className="dw-primary"
                disabled={running || inferenceUnavailable || !scope}
                onClick={() => start()}
              >
                {running ? "LOKI is working…" : "Run LOKI discovery"}
              </button>
            </div>
          </div>
          {state?.job && (
            <div className="dw-progress" role="status">
              <strong>{state.job.phase}</strong>
              <span>
                {state.job.completed} / {state.job.total} context blocks
              </span>
              <progress
                value={state.job.completed}
                max={Math.max(1, state.job.total)}
              />
              {running && (
                <button
                  onClick={async () => {
                    try {
                      setState(await post<State>("/discovery/cancel"));
                    } catch (e) {
                      setError(String(e));
                    }
                  }}
                >
                  Cancel
                </button>
              )}
            </div>
          )}
          {matrix && (
            <>
              <div className="dw-stats">
                {card("Score observations", matrix.cells)}
                {card("Table rows", matrix.rows)}
                {card("Text units", matrix.text_units)}
                {card("Context blocks", matrix.contexts)}
                {card(
                  "Score storage",
                  `${(matrix.score_bytes / 1024 / 1024).toFixed(2)} MiB`,
                )}
                {card(
                  "Scoring time",
                  `${state?.work?.seconds?.toFixed(1) ?? "—"} s`,
                )}
              </div>
              <p className="dw-hint">
                Device: {state?.work?.device || "unrecorded"} · Scope:{" "}
                {state?.scope
                  ? `${state.scope.counts.pairs} source pairs`
                  : "whole profiled candidate graph"}
                . Context overlaps count separately; projection and configured
                row limits still apply.
              </p>
              <button className="dw-primary" onClick={() => setStep("explore")}>
                Explore Saved Scores →
              </button>
            </>
          )}
          {ready && !matrix && (
            <p>
              These earlier results contain retained evidence only. Compute
              again to enable complete-score exploration.
            </p>
          )}
        </div>
      )}
      {step === "explore" && !ready && (
        <p role="status">
          Discovery results are loading or stale. Review the scope and compute
          current scores.
        </p>
      )}
      {step === "explore" && ready && (
        <div
          className="dw-stage"
          role="tabpanel"
          id="discovery-explore-panel"
          aria-labelledby="discovery-explore-tab"
        >
          <div className="dw-section-heading">
            <div>
              <h2>Find the signal in your scores</h2>
              <p>Filters read saved scores. No LOKI or LLM calls.</p>
            </div>
            <span className="dw-pill">
              {matrix ? "Saved matrix" : "Earlier evidence"}
            </span>
          </div>
          {matrix && (
            <>
              <div className="dw-filters">
                <label>
                  Minimum score
                  <input
                    type="number"
                    min={-1.01}
                    max={1.01}
                    step=".05"
                    value={low}
                    onChange={(e) => setLow(e.target.value)}
                  />
                </label>
                <label>
                  Maximum score
                  <input
                    type="number"
                    min={-1.01}
                    max={1.01}
                    step=".05"
                    value={high}
                    onChange={(e) => setHigh(e.target.value)}
                  />
                </label>
                <label>
                  Top-K per row / context
                  <select
                    value={topK}
                    onChange={(e) => setTopK(e.target.value)}
                  >
                    {[0, 1, 3, 5, 10, 20, 32].map((k) => (
                      <option key={k} value={k}>
                        {k || "All"}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Source
                  <select
                    aria-label="Source"
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                  >
                    <option value="">All scoped sources</option>
                    {state?.sources?.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Score order
                  <select
                    value={sort}
                    onChange={(e) => setSort(e.target.value)}
                  >
                    <option value="desc">Highest first</option>
                    <option value="asc">Lowest first</option>
                  </select>
                </label>
              </div>
              {!valid && (
                <p role="alert">
                  Enter a valid score range from −1.01 to 1.01.
                </p>
              )}
              {savedDemo && <div className="dw-stats">
                {card("Score observations", matrix.cells)}
                {card("Matching observations", loading ? "Updating…" : query?.total)}
                {card("Published atomic links", state?.summary?.links)}
                {card("Published join paths", state?.summary?.bridges)}
              </div>}
              <div className="dw-distribution">
                <div>
                  <h3>Score distribution</h3>
                  <span>
                    All computed observations · select a range to focus; other
                    ranges stay visible
                  </span>
                </div>
                <div className="dw-bars">
                  {matrix.histogram.map((n, i, all) => {
                    const start = Number((-1 + i * 0.1).toFixed(2));
                    const end = Number((-0.9 + i * 0.1).toFixed(2));
                    const focused =
                      valid &&
                      (Number(high) > start ||
                        (Number(low) === Number(high) &&
                          Number(high) === start)) &&
                      (Number(low) < end || (i === 19 && Number(low) <= end));
                    return (
                      <button
                        key={i}
                        className={valid && !focused ? "is-muted" : ""}
                        aria-pressed={focused}
                        title={`${(-1 + i * 0.1).toFixed(1)} to ${(-0.9 + i * 0.1).toFixed(1)}: ${n} observations`}
                        aria-label={`Score bucket ${i + 1}: ${n} observations`}
                        onClick={() => {
                          setLow((-1 + i * 0.1).toFixed(2));
                          setHigh(
                            i === 19 ? "1.01" : (-0.9 + i * 0.1).toFixed(2),
                          );
                        }}
                      >
                        <span
                          style={{
                            height: `${n ? Math.max(3, (100 * n) / Math.max(1, ...all)) : 0}%`,
                          }}
                        />
                      </button>
                    );
                  })}
                </div>
                <footer>
                  <span>−1 · lower similarity</span>
                  <span>0</span>
                  <span>+1 · higher similarity</span>
                </footer>
              </div>
              <details className="dw-score-details">
                <summary>
                  Inspect individual row–text scores{" "}
                  {query ? `(${query.total.toLocaleString()})` : ""}
                </summary>
                {loading && <p role="status">Reading saved scores…</p>}
                {query?.items.map((s) => (
                  <article key={s.id}>
                    <header>
                      <strong>
                        {s.table_name} · row {s.row_index}
                      </strong>
                      <b>{s.score.toFixed(3)}</b>
                    </header>
                    <p>{s.row_preview}</p>
                    <small>
                      {s.document_name} · characters {s.start}–{s.end}
                    </small>
                    <blockquote>{s.text_preview}</blockquote>
                  </article>
                ))}
                {query?.total === 0 && (
                  <p>No observations match these filters.</p>
                )}
                <div className="dw-pages">
                  <button
                    disabled={!offset || loading}
                    onClick={() => setOffset((n) => Math.max(0, n - 20))}
                  >
                    Previous scores
                  </button>
                  <span>
                    {query?.total ? offset + 1 : 0}–
                    {offset + (query?.items.length || 0)} of {query?.total || 0}
                  </span>
                  <button
                    disabled={
                      loading ||
                      !query ||
                      offset + 20 >= query.total ||
                      offset >= 10000
                    }
                    onClick={() => setOffset((n) => n + 20)}
                  >
                    Next scores
                  </button>
                </div>
                {offset >= 10000 && (
                  <p>Narrow the source or score filters to browse further.</p>
                )}
              </details>
              {!savedDemo && <div className="dw-handoff journey-prepare-inline">
                <div><h3>Prepare evidence for Integration</h3><p>Uses saved scores · no LOKI or LLM call. Inspect the input and prepared output in Data Journey.</p></div>
                <div className="journey-cap-control">
                  <label>
                    Shared-text join-path cap (0 = all eligible)
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={bridgeCap}
                      disabled={running || inferenceUnavailable}
                      onChange={(e) => setBridgeCap(e.target.value)}
                    />
                  </label>
                  {!validBridgeCap && (
                    <p role="alert">Enter a whole number of 0 or more.</p>
                  )}
                </div>
                <div className="journey-prepare-actions">
                <button
                  className="dw-primary"
                  disabled={
                    running ||
                    !valid ||
                    !validBridgeCap ||
                    loading ||
                    !query?.total ||
                    inferenceUnavailable
                  }
                  onClick={() => start(true)}
                >
                  Prepare filtered evidence
                </button>
                {state?.evidence_filter && onIntegration && <button disabled={running} onClick={onIntegration}>Continue to Integration →</button>}
                </div>
              </div>}
              {running && (
                <p role="status">
                  {state?.job?.phase || "Preparing…"} ·{" "}
                  {state?.job?.completed || 0}/{state?.job?.total || 0}
                </p>
              )}
            </>
          )}
          {(state?.evidence_filter || (ready && !matrix)) && (
            <>
              <button onClick={() => setShowEvidence((v) => !v)}>
                {showEvidence ? "Hide" : "Open"} prepared evidence & join paths
              </button>
              {showEvidence && (
                <PublishedEvidence
                  onOpenEvidence={onOpenEvidence}
                  onIntake={onIntake}
                />
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
