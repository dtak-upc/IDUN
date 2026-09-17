import { savedDemo } from "../mode";
import { useEffect, useRef, useState } from "react";
import { api, post } from "../storage/api";
import "./live.css";
import { LiveLandscape } from "./LiveLandscape";
type Link = {
  id: string;
  table: string;
  table_name?: string;
  text_name?: string;
  text: string;
  row_index: number;
  record_id: string;
  row_version: string;
  text_version: string;
  context: string;
  start: number;
  end: number;
  score: number;
  row_preview: string;
  text_preview: string;
  one_sided: boolean;
  character_clipped: boolean;
};
type Bridge = {
  id: string;
  left: string;
  right: string;
  text: string;
  start: number;
  end: number;
  score: number;
};
type Result = {
  status: string;
  revision?: string;
  threshold?: number;
  sources?: { id: string; name: string }[];
  notice?: string;
  job?: { status: string; phase: string; completed: number; total: number };
  summary?: {
    contexts: number;
    links: number;
    bridges: number;
    one_sided: number;
    rows_without_links: number;
  };
  coverage?: {
    sampled_sources: number;
    split_contexts: number;
    eligible_links: number;
    bridge_group_links_omitted: number;
    bridges_omitted: number;
  };
  work?: {
    device?: string;
    reused_contexts: number;
    scored_contexts: number;
    peak_reserved_gib: number;
    seconds: number;
  };
};
type Page<T> = { revision?: string; total: number; offset: number; items: T[] };
export function LiveDiscovery({
  onOpenEvidence,
  onIntake,
}: {
  onOpenEvidence: (id: string, companion?: string) => void;
  onIntake: () => void;
}) {
  const epoch = useRef(0);
  const [result, setResult] = useState<Result>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [threshold, setThreshold] = useState(0.15);
  const [view, setView] = useState<"links" | "bridges">("links");
  const [source, setSource] = useState("");
  const [page, setPage] = useState(0);
  const [loadedPage, setLoadedPage] = useState<{
    key: string;
    data: Page<Link | Bridge>;
  }>();
  // Effects clear asynchronously: never render the previous query's record shape.
  const queryKey = JSON.stringify([
    result?.status,
    result?.revision,
    view,
    source,
    page,
  ]);
  const items = loadedPage?.key === queryKey ? loadedPage.data : undefined;
  useEffect(() => {
    let active = true;
    const controller=new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function refresh() {
      const requestEpoch=epoch.current;
      try {
        const r = await api<Result>("/discovery",{signal:controller.signal});
        if (active && requestEpoch===epoch.current) {setResult(r);setError("");}
      } catch (e) {
        if (active) setError(String(e));
      } finally {if(active) timer=setTimeout(refresh,2000);}
    }
    void refresh();
    return () => {
      active = false;
      clearTimeout(timer);controller.abort();
    };
  }, []);
  useEffect(() => {
    setPage(0);
    if(source && result?.sources && !result.sources.some(s=>s.id===source)) setSource("");
  }, [result?.revision]);
  useEffect(() => {
    let active=true;
    let timer: ReturnType<typeof setTimeout>;
    const controller=new AbortController();
    setLoadedPage(undefined);
    async function load() {
      try {
        const r=await api<Page<Link | Bridge>>(`/discovery/${view}?offset=${page*20}&source=${encodeURIComponent(source)}`,{signal:controller.signal});
        if(r.revision && r.revision!==result?.revision) throw Error('Discovery changed; refreshing results…');
        if(active){setLoadedPage({key:queryKey,data:r});setError("");}
      } catch(e){if(active){setError(String(e));timer=setTimeout(load,1500);}}
    }
    if(result?.status==='ready') void load();
    return ()=>{active=false;clearTimeout(timer);controller.abort();};
  }, [queryKey]);
  const running =
    busy ||
    ["queued", "running", "cancelling"].includes(result?.job?.status || "");
  const names = new Map(result?.sources?.map((s) => [s.id, s.name]) || []);
  async function run() {
    epoch.current++;
    setBusy(true);
    setError("");
    try {
      setResult(await post<Result>("/discovery", { threshold }));
      setPage(0);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="live-discovery" aria-label="Live LOKI discovery">
      <header>
        <div>
          <span className="live-kicker">YOUR SAVED LAKE · LOKI</span>
          <h1>Discover your lake</h1>
          <p>
            Contextual discovery across the indexed lake. No source pairs to
            choose.
          </p>
        </div>
        <button className="live-primary" disabled={running || savedDemo} onClick={run}>
          {running ? "LOKI is working…" : "Run LOKI discovery"}
        </button>
      </header>
      <details>
        <summary>Scoring policy</summary>
        <label>
          Minimum LOKI score{" "}
          <input
            aria-label="Minimum LOKI score"
            type="number"
            min={-1}
            max={1}
            step={0.01}
            value={threshold}
            disabled={running || savedDemo}
            onChange={(e) => setThreshold(Number(e.target.value))}
          />
        </label>
        <p>
          Checkpoint default: 0.15, uncalibrated for this raw lake. Keep bounded
          join candidates and their evidence. Scores are not probabilities.
        </p>
      </details>
      {error && <p role="alert">{error}</p>}
      {result?.job && (
        <div
          className={`live-job ${running ? "" : "live-job-idle"}`}
          role="status"
        >
          <span>
            {result.job.phase} · {result.job.completed}/{result.job.total}
          </span>
          {running && (
            <>
              <progress
                value={result.job.completed}
                max={Math.max(1, result.job.total)}
              />
              <button
                onClick={async () => {
                  try {
                    setResult(await post<Result>("/discovery/cancel"));
                  } catch (e) {
                    setError(String(e));
                  }
                }}
              >
                Cancel discovery
              </button>
            </>
          )}
        </div>
      )}
      {result?.status !== "ready" ? (
        <div className="live-empty">
          <h2>
            {result?.status === "stale"
              ? "The lake has changed"
              : "Ready to discover"}
          </h2>
          <p>
            Update the index in Data Lake, then run LOKI here. Unchanged contexts
            are reused; affected contexts are rescored. Earlier integration runs
            and their saved evidence remain available in Integration.
          </p>
          <button onClick={onIntake}>Go to Data Lake</button>
        </div>
      ) : (
        <>
          <LiveLandscape
            revision={result.revision}
            onOpenEvidence={onOpenEvidence}
            onBrowse={(id) => {
              setView("links");
              setSource(id);
              setPage(0);
              requestAnimationFrame(() =>
                document
                  .getElementById("live-evidence-browser")
                  ?.scrollIntoView({ block: "start", behavior: "smooth" }),
              );
            }}
          />
          <p className="live-muted">
            Last scoring device:{" "}
            {result.work?.device === "cuda"
              ? "GPU · CUDA"
              : result.work?.device || "unrecorded"}
            .{" "}
            {result.work?.scored_contexts === 0
              ? "This request reused cached evidence; no new GPU scoring."
              : "Runtime preferences are available in Settings."}
          </p>
          <h2 id="live-evidence-browser">Explore individual evidence</h2>
          <p className="live-muted">
            Follow any connection into its original rows and text. Scores rank
            model proposals.
          </p>
          <div className="live-metrics">
            <span>
              <b>{result.summary?.links}</b> row–text links
            </span>
            <span>
              <b>{result.summary?.bridges}</b> bridge candidates
            </span>
            <span>
              <b>{result.summary?.one_sided}</b> one-sided links
            </span>
            <span>
              <b>{result.summary?.contexts}</b> scored contexts
            </span>
          </div>
          <p>{result.notice}</p>
          <p className="live-muted">
            {result.coverage?.sampled_sources} sampled sources ·{" "}
            {result.coverage?.split_contexts} split contexts ·{" "}
            {result.work?.reused_contexts} contexts reused · active result
            threshold {result.threshold}. {result.summary?.rows_without_links}{" "}
            row contexts have no retained link.
          </p>
          <details>
            <summary>Coverage and execution</summary>
            <p>
              {result.coverage?.eligible_links} scores met the threshold before
              the per-row cap. Bridge budgets omitted{" "}
              {result.coverage?.bridge_group_links_omitted} group-link entries
              and {result.coverage?.bridges_omitted} bridge candidates. Text
              units retain Step 08's provisional segmentation and sampling.
              Links without cross-table support remain available for later
              augmentation.
            </p>
            <p>
              Last scoring work: {result.work?.scored_contexts} contexts ·{" "}
              {result.work?.peak_reserved_gib.toFixed(2)} GiB PyTorch peak
              reservation · {result.work?.seconds.toFixed(2)} seconds.
            </p>
          </details>
          <div className="live-tools">
            <button
              aria-pressed={view === "links"}
              onClick={() => {
                setView("links");
                setPage(0);
              }}
            >
              Row–text links
            </button>
            <button
              aria-pressed={view === "bridges"}
              onClick={() => {
                setView("bridges");
                setPage(0);
              }}
            >
              Shared-text bridges
            </button>
            {view === "links" && (
              <select
                aria-label="Filter discovery source"
                value={source}
                onChange={(e) => {
                  setSource(e.target.value);
                  setPage(0);
                }}
              >
                <option value="">All sources</option>
                {result.sources?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} · {s.id.slice(0, 6)}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="live-results" aria-busy={!items}>
            {!items && <p role="status">Loading evidence…</p>}
            {items?.items.map((item) =>
              view === "links" ? (
                <button
                  className="live-result"
                  key={item.id}
                  onClick={() => onOpenEvidence(item.id)}
                >
                  <span>
                    <strong>
                      {names.get((item as Link).table)} · row{" "}
                      {(item as Link).row_index}
                    </strong>
                    <small>
                      → {names.get((item as Link).text)} · offsets{" "}
                      {(item as Link).start}–{(item as Link).end}
                    </small>
                  </span>
                  <span className="live-score">{item.score.toFixed(3)}</span>
                  <p>
                    {(item as Link).row_preview.slice(0, 150)} →{" "}
                    {(item as Link).text_preview.slice(0, 180)}
                  </p>
                  <small>
                    {(item as Link).one_sided
                      ? "One-sided evidence in this context"
                      : "Shared-text support in this context"}{" "}
                    · Inspect evidence
                  </small>
                </button>
              ) : (
                <button
                  className="live-result"
                  key={item.id}
                  onClick={() =>
                    onOpenEvidence(
                      (item as Bridge).left,
                      (item as Bridge).right,
                    )
                  }
                >
                  <span>
                    <strong>Two rows share a text unit</strong>
                    <small>
                      {names.get(item.text)} · offsets {(item as Bridge).start}–
                      {(item as Bridge).end}
                    </small>
                  </span>
                  <span className="live-score">{item.score.toFixed(3)}</span>
                  <p>
                    Inspect both rows and their shared evidence. This is a join
                    candidate, not a materialized relation.
                  </p>
                </button>
              ),
            )}
            {items?.total === 0 && (
              <p>
                No retained evidence for this view. Check coverage and the
                scoring threshold.
              </p>
            )}
          </div>
          <div className="live-pages">
            <button disabled={page === 0} onClick={() => setPage(page - 1)}>
              Previous evidence
            </button>
            <span>
              {items?.total || 0} results · page {page + 1}
            </span>
            <button
              disabled={!items || (page + 1) * 20 >= items.total}
              onClick={() => setPage(page + 1)}
            >
              Next evidence
            </button>
          </div>
        </>
      )}
    </section>
  );
}
export { RealWorkbench as LiveEvidence } from "./RealWorkbench";
