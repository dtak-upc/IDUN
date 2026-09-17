import { publicFile } from "../showcase/paths";
import { useEffect, useRef, useState } from "react";
import { api, post } from "../storage/api";
import { SemanticResults, type SemanticPlan, type DiffData } from "./SemanticResults";
import { RelationshipSchemaStudio, type SchemaConfig, DEFAULT_LABELS } from "./RelationshipSchemaStudio";
import "./integration.css";
import "../storage/lakes.css";
import { publicDemo, savedDemo } from "../mode";
type Summary = {
  id: string;
  title: string;
  model?: string;
  created?: number;
  materialized: boolean;
  stale: boolean;
  counts: { include: number; abstain: number; conflict: number };
};
type State = {
  discovery_ready: boolean;
  resume?: {budget:number;total:number;completed:number} | null;
  job?: { status: string; phase: string; completed: number; total: number };
  plans: Summary[];
};
export function IntegratedDatasets({
  onEvidence,
  onSettings,
  onDiscovery,
}: {
  onEvidence: (l: string, r: string) => void;
  onSettings: () => void;
  onDiscovery: () => void;
}) {
  const epoch=useRef(0);
  const [state, setState] = useState<State>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [limit, setLimit] = useState(12);
  const [timeout, setTimeoutValue] = useState(120);
  useEffect(() => {
    if (publicDemo) return;
    let active = true;
    api<{settings: {llm: {timeout_seconds: number}}}>("/settings").then(r => {
      if (active) setTimeoutValue(r.settings.llm.timeout_seconds);
    }).catch(() => {});
    return () => {active = false;};
  }, []);
  const [renaming, setRenaming] = useState("");
  const [runName, setRunName] = useState("");
  const [removing, setRemoving] = useState<Summary>();
  const [selected, setSelected] = useState("");
  const [menuOpenRunId, setMenuOpenRunId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<{ key: string; plan: SemanticPlan }>();
  const [diffData, setDiffData] = useState<DiffData | null>(null);
  const [schemaStudioOpen, setSchemaStudioOpen] = useState(false);
  const [schemaConfig, setSchemaConfig] = useState<SchemaConfig>({
    mode: "strict",
    labels: [...DEFAULT_LABELS],
    definitions: {},
  });
  const [hfLoaded, setHfLoaded] = useState<{ loaded: boolean; repo_id: string; vram_mb: number } | null>(null);
  const [unloading, setUnloading] = useState(false);

  useEffect(() => {
    if (!menuOpenRunId) return;
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest(".run-card-action-wrap")) {
        setMenuOpenRunId(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpenRunId]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (schemaStudioOpen) setSchemaStudioOpen(false);
        if (menuOpenRunId) setMenuOpenRunId(null);
        if (renaming) setRenaming("");
        if (removing) setRemoving(undefined);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [schemaStudioOpen, menuOpenRunId, renaming, removing]);
  useEffect(() => {
    let active=true;
    let timer:ReturnType<typeof setTimeout>;
    const controller=new AbortController();
    async function poll(){
      const stamp=epoch.current;
      try{
        const r=await api<State>("/integration",{signal:controller.signal});
        if(active && stamp===epoch.current)setState(r);
        const hf = await api<{ loaded: boolean; repo_id: string; vram_mb: number }>("/settings/hf/loaded", { signal: controller.signal }).catch(() => null);
        if (active && stamp === epoch.current && hf) setHfLoaded(hf);
      }
      catch(e){if(active && stamp===epoch.current)setError(String(e));}
      finally{if(active)timer=setTimeout(poll,2000);}
    }
    void poll();
    return()=>{active=false;clearTimeout(timer);controller.abort();};
  }, []);
  const summary =
    state?.plans.find((p) => p.id === selected) || state?.plans[0];
  const key =
    summary ? `${summary.id}/${summary.materialized}/${summary.title}/${summary.stale}` : "";
  useEffect(() => {
    let active = true;
    if (key && summary) {
      setDiffData(null);
      void Promise.all([
        api<SemanticPlan>(`/integration/${summary.id}`),
        api<DiffData>(`/integration/${summary.id}/diff`).catch(() => null),
      ])
        .then(([plan, diff]) => {
          if (active) {
            setLoaded({ key, plan });
            setDiffData(diff);
          }
        })
        .catch((e) => {
          if (active) setError(String(e));
        });
    }
    return () => {
      active = false;
    };
  }, [key]);
  const plan = loaded?.key === key ? loaded.plan : undefined;
  const running =
    busy ||
    ["queued", "running", "cancelling"].includes(state?.job?.status || "");
  async function act(fn: () => Promise<void>) {
    epoch.current++;
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleUnloadHf() {
    setUnloading(true);
    try {
      await post("/settings/hf/unload");
      setHfLoaded({ loaded: false, repo_id: "", vram_mb: 0 });
    } catch (e) {
      setError(String(e));
    } finally {
      setUnloading(false);
    }
  }

  return (
    <section
      className="integrated-datasets"
      aria-label="Live semantic integration"
    >
      <div className="integration-heading">
        <div>
          <span className="live-kicker">
            FROM DISCOVERED PATHS TO JOINED TABLES
          </span>
          <h1>Connect records through their clinical meaning.</h1>
          <p>
            LOKI proposes row pairs. Narrative evidence determines the
            relationship.
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          {hfLoaded?.loaded && (
            <button
              type="button"
              className="integration-unload-vram-btn"
              title={`Active in VRAM: ${hfLoaded.repo_id} (~${hfLoaded.vram_mb} MB). Click to unload.`}
              onClick={handleUnloadHf}
              disabled={unloading || running}
            >
              {unloading ? "Unloading…" : `⚡ Unload LLM (${hfLoaded.repo_id.split("/").pop()})`}
            </button>
          )}
          {!publicDemo && <button onClick={onSettings}>LLM settings</button>}
        </div>
      </div>
      <div className="integration-start">
        <div>
          <strong>Build a semantic integration</strong>
          <p>
            Automatically rank complementary row pairs, cluster their evidence
            and infer clinical relationships.
          </p>
        </div>
        <label>
          New/changed row-pair budget
          <input
            aria-label="Integration candidate budget"
            type="number"
            min={1}
            max={100}
            value={limit}
            disabled={savedDemo || running}
            onChange={(e) => setLimit(Number(e.target.value))}
          />
        </label>
        <label>
          Timeout / request
          <input
            aria-label="Generation timeout"
            type="number"
            min={0}
            step={1}
            value={timeout}
            disabled={savedDemo || running}
            onChange={(e) => setTimeoutValue(Number(e.target.value))}
          />
          <small>Seconds · 0 = no timeout</small>
        </label>
        <div className="schema-pill-trigger-wrap">
          <label>
            Schema & Predicates
            <button
              type="button"
              className="schema-config-trigger-btn"
              disabled={running}
              onClick={() => setSchemaStudioOpen(true)}
              aria-haspopup="dialog"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
              <span>{schemaConfig.labels.length} relations ({schemaConfig.mode})</span>
            </button>
          </label>
        </div>
        <button
          className="integration-primary"
          disabled={savedDemo || running || !state?.discovery_ready}
          onClick={() =>
            act(async () => {
              setState(await post<State>("/integration", {
                limit: state?.resume?.budget ?? limit,
                timeout,
                schema_config: schemaConfig,
              }));
              setSelected("");
            })
          }
        >
          {state?.resume ? `Resume original batch (${state.resume.completed}/${state.resume.total})` : "Propose with LLM"}
        </button>
        {state?.resume && <button disabled={running || savedDemo} onClick={()=>act(async()=>{
          setState(await post<State>("/integration",{limit,timeout,new_batch:true,schema_config:schemaConfig}));setSelected("");
        })}>Start a new batch instead</button>}
      </div>
      <p className="integration-muted">
        Clinical profile: diagnosis and medication roles are detected from
        projected columns. Identifiers, filenames and folder relationships are
        not model inputs. Requests use the provider selected in Settings.
      </p>
      {!state?.discovery_ready && (
        <p>
          Run current LOKI discovery to prepare semantic integration.{" "}
          <button onClick={onDiscovery}>Open Discover</button>
        </p>
      )}
      {error && (
        <p role="alert" className="integration-error">
          {error}
        </p>
      )}
      {state?.job && (
        <div role="status" className="integration-job">
          <span>
            {state.job.phase}{" "}
            {state.job.total > 0 &&
              `· ${state.job.completed}/${state.job.total}`}
          </span>
          {running && (
            <button
              onClick={() =>
                act(async () =>
                  setState(await post<State>("/integration/cancel")),
                )
              }
            >
              Cancel integration
            </button>
          )}
        </div>
      )}
      <div className="integration-layout">
        <aside className="integration-library">
          <span className="live-kicker">INTEGRATION RUNS</span>
          {!state?.plans.length && (
            <p>Your joined tables and reviewable proposals will appear here.</p>
          )}
          {state?.plans.map((p) => (
            <div
              key={p.id}
              className={`integration-run-card ${summary?.id === p.id ? "selected" : ""} ${menuOpenRunId === p.id ? "menu-open" : ""}`}
              onClick={() => setSelected(p.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSelected(p.id);
                }
              }}
            >
              <div className="run-card-info">
                <strong title={p.title}>{p.title} · {p.id.slice(0, 8)}</strong>
                <small className="run-model">{p.model || "Model not recorded"}</small>
                {p.created && <small>{new Date(p.created * 1000).toLocaleString()}</small>}
                <small className="run-summary-line">
                  {p.stale
                    ? "Earlier snapshot"
                    : p.materialized
                      ? "Materialized"
                      : "Preview"}{" "}
                  · {p.counts.include} supported pairs
                </small>
              </div>

              {!savedDemo && (
                <div className="run-card-action-wrap">
                  <button
                    type="button"
                    className={`run-card-menu-btn ${menuOpenRunId === p.id ? "active" : ""}`}
                    aria-label={`Edit ${p.title}`}
                    aria-haspopup="true"
                    aria-expanded={menuOpenRunId === p.id}
                    title="Edit run (Rename, Remove)"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpenRunId((curr) => (curr === p.id ? null : p.id));
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M8 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      <line x1="9" y1="12" x2="12" y2="15" />
                      <line x1="16.5" y1="4.5" x2="19.5" y2="7.5" />
                    </svg>
                  </button>

                  {menuOpenRunId === p.id && (
                    <div className="lake-dropdown-menu run-dropdown-menu" role="menu" onClick={(e) => e.stopPropagation()}>
                      <div className="lake-dropdown-header">
                        <span className="lake-dropdown-kicker">INTEGRATION RUN</span>
                        <span className="lake-dropdown-current" title={p.title}>{p.title}</span>
                      </div>
                      <button
                        type="button"
                        role="menuitem"
                        className="lake-dropdown-item"
                        disabled={running}
                        onClick={() => {
                          setRunName(p.title);
                          setRenaming(p.id);
                          setMenuOpenRunId(null);
                        }}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                          <path d="m15 5 4 4" />
                        </svg>
                        <span>Rename run</span>
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        className="lake-dropdown-item lake-dropdown-danger"
                        disabled={running}
                        onClick={() => {
                          setRemoving(p);
                          setMenuOpenRunId(null);
                        }}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                          <line x1="10" y1="11" x2="10" y2="17" />
                          <line x1="14" y1="11" x2="14" y2="17" />
                        </svg>
                        <span>Remove run</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </aside>
        <div className="integration-detail">
          {summary?.stale && <p>This run preserves earlier evidence. Update discovery and integration to include appended files.</p>}
          {plan ? (
            <SemanticResults
              key={plan.id}
              csvHref={savedDemo ? (relation) => publicFile(`demo/${relation || "all"}.csv`) : undefined}
              plan={plan}
              diff={diffData || undefined}
              busy={running}
              onEvidence={onEvidence}
              onMaterialize={() =>
                act(async () => {
                  await post(`/integration/${plan.id}/materialize`);
                  setState(await api<State>("/integration"));
                })
              }
            />
          ) : (
            <div className="integration-empty">
              <h2>Diagnosis + medication + evidence → a joined table</h2>
              <p>
                Review treatment, adverse-effect, discontinuation and
                contraindication relationships. Unsupported pairs stay visible
                in the decision review.
              </p>
              <p>No source-pair selection or annotation files are required.</p>
            </div>
          )}
        </div>
      </div>

      {/* Rename run modal */}
      {renaming && (
        <div className="lake-modal-overlay" role="presentation" onClick={() => !running && setRenaming("")}>
          <div className="lake-modal-card" role="dialog" aria-modal="true" aria-labelledby="rename-run-modal-title" onClick={(e) => e.stopPropagation()}>
            <div className="lake-modal-header">
              <h3 id="rename-run-modal-title">Rename integration run</h3>
              <p className="lake-modal-desc">Give this semantic integration run a descriptive title.</p>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void act(async () => {
                  await post(`/integration/${renaming}/rename`, { title: runName });
                  setRenaming("");
                  setState(await api<State>("/integration"));
                });
              }}
            >
              <div className="lake-modal-body">
                <label htmlFor="integration-run-name-input">Integration run name:</label>
                <input
                  id="integration-run-name-input"
                  aria-label="Integration run name"
                  value={runName}
                  maxLength={120}
                  required
                  autoFocus
                  placeholder="e.g. Diagnosis–medication integration"
                  onChange={(e) => setRunName(e.target.value)}
                />
              </div>
              <div className="lake-modal-footer">
                <button type="button" className="lake-modal-btn-cancel" disabled={running} onClick={() => setRenaming("")}>
                  Cancel
                </button>
                <button type="submit" className="lake-modal-btn-primary" disabled={running || !runName.trim()}>
                  Save name
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Remove run confirmation modal */}
      {removing && (
        <div className="lake-modal-overlay" role="presentation" onClick={() => !running && setRemoving(undefined)}>
          <div className="lake-modal-card lake-modal-card-danger" role="alertdialog" aria-modal="true" aria-labelledby="remove-run-modal-title" onClick={(e) => e.stopPropagation()}>
            <div className="lake-modal-header">
              <div className="lake-danger-icon" aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
              <h3 id="remove-run-modal-title">Remove integration run?</h3>
              <p className="lake-modal-desc">
                Remove <strong>{removing.title}</strong> (<code>{removing.id.slice(0, 8)}</code>) and its materialized tables? Source files and discovery evidence are kept.
              </p>
            </div>
            <div className="lake-modal-footer">
              <button type="button" className="lake-modal-btn-cancel" disabled={running} onClick={() => setRemoving(undefined)}>
                Keep run
              </button>
              <button
                type="button"
                className="lake-modal-btn-danger"
                disabled={running}
                onClick={() =>
                  act(async () => {
                    await post(`/integration/${removing.id}/remove`);
                    setLoaded(undefined);
                    setSelected("");
                    setRemoving(undefined);
                    setState(await api<State>("/integration"));
                  })
                }
              >
                Confirm removal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Relationship Schema Studio modal */}
      <RelationshipSchemaStudio
        isOpen={schemaStudioOpen}
        onClose={() => setSchemaStudioOpen(false)}
        config={schemaConfig}
        onSave={(newCfg) => setSchemaConfig(newCfg)}
        disabled={savedDemo || running}
      />
    </section>
  );
}
