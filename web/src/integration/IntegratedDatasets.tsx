import { useEffect, useState } from "react";
import { api, post } from "../storage/api";
import { SemanticResults, type SemanticPlan } from "./SemanticResults";
import "./integration.css";
import { publicDemo } from "../mode";
type Summary = {
  id: string;
  title: string;
  materialized: boolean;
  stale: boolean;
  counts: { include: number; abstain: number; conflict: number };
};
type State = {
  discovery_ready: boolean;
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
  const [state, setState] = useState<State>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [limit, setLimit] = useState(12);
  const [timeout, setTimeoutValue] = useState(120);
  const [selected, setSelected] = useState("");
  const [loaded, setLoaded] = useState<{ key: string; plan: SemanticPlan }>();
  useEffect(() => {
    let active = true;
    const poll = () =>
      void api<State>("/integration")
        .then((r) => {
          if (active) setState(r);
        })
        .catch((e) => {
          if (active) setError(String(e));
        });
    poll();
    const timer = setInterval(poll, 2000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);
  const summary =
    state?.plans.find((p) => p.id === selected) || state?.plans[0];
  const key =
    summary && !summary.stale ? `${summary.id}/${summary.materialized}` : "";
  useEffect(() => {
    let active = true;
    if (key && summary)
      void api<SemanticPlan>(`/integration/${summary.id}`)
        .then((plan) => {
          if (active) setLoaded({ key, plan });
        })
        .catch((e) => {
          if (active) setError(String(e));
        });
    return () => {
      active = false;
    };
  }, [key]);
  const plan = loaded?.key === key ? loaded.plan : undefined;
  const running =
    busy ||
    ["queued", "running", "cancelling"].includes(state?.job?.status || "");
  async function act(fn: () => Promise<void>) {
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
        {!publicDemo && <button onClick={onSettings}>LLM settings</button>}
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
          Row-pair budget
          <input
            aria-label="Integration candidate budget"
            type="number"
            min={1}
            max={100}
            value={limit}
            disabled={running}
            onChange={(e) => setLimit(Number(e.target.value))}
          />
        </label>
        <label>
          Timeout / request
          <select
            aria-label="Generation timeout"
            value={timeout}
            disabled={running}
            onChange={(e) => setTimeoutValue(Number(e.target.value))}
          >
            <option value={60}>60 seconds</option>
            <option value={120}>120 seconds</option>
            <option value={300}>300 seconds</option>
          </select>
        </label>
        <button
          className="integration-primary"
          disabled={running || !state?.discovery_ready}
          onClick={() =>
            act(async () => {
              setState(await post<State>("/integration", { limit, timeout }));
              setSelected("");
            })
          }
        >
          Propose with LLM
        </button>
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
            <button
              key={p.id}
              className={summary?.id === p.id ? "selected" : ""}
              onClick={() => setSelected(p.id)}
            >
              <strong>{p.title}</strong>
              <small>
                {p.stale
                  ? "Evidence changed"
                  : p.materialized
                    ? "Materialized"
                    : "Preview"}{" "}
                · {p.counts.include} supported pairs
              </small>
            </button>
          ))}
        </aside>
        <div className="integration-detail">
          {summary?.stale ? (
            <div className="integration-empty">
              <h2>Run again from current evidence</h2>
              <p>
                This proposal is stale or uses the retired concept-match
                operator.
              </p>
            </div>
          ) : plan ? (
            <SemanticResults
              key={plan.id}
              plan={plan}
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
    </section>
  );
}
