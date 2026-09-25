import { savedDemo } from "../mode";
import { useEffect, useRef, useState } from "react";
import { api, post } from "../storage/api";
import "./profiling.css";
type Source = {
  coverage?: {
    available_units: number;
    indexed_units: number;
    sampled: boolean;
    character_clipped_units?: number;
  };
  asset_id: string;
  name: string;
  kind: string;
  records: number;
  status: string;
  issues: string[];
  terms: { term: string; count: number }[];
  columns: {
    name: string;
    type: string;
    nonempty: number;
    missing: number;
    distinct_lower_bound: number;
    distinct_capped: boolean;
  }[];
  units: { start: number; end: number; preview: string; clipped: boolean }[];
  anchor?: { terms: string[]; candidate_count: number };
};
type Report = {
  status: string;
  revision?: string;
  job?: {
    status: string;
    phase: string;
    completed: number;
    total: number;
    reused?: number;
  };
  work?: {
    reused_sources: number;
    updated_sources: number;
    encoded_units: number;
    scored_passages: number;
    sampled_sources: number;
    expanded_queries: number;
    token_truncated_units: number;
  };
  sources?: Source[];
  concepts?: { term: string; sources: number }[];
  candidates?: {
    table: string;
    text: string;
    score: number;
    shared_terms: string[];
    channels?: string[];
    evidence?: {
      row_index?: number;
      start?: number;
      end?: number;
      preview: string;
    };
  }[];
  summary?: {
    sources: number;
    tables: number;
    texts: number;
    candidates: number;
    unresolved: number;
  };
  method?: string;
};
export function LakeProfile() {
  const epoch=useRef(0);
  const [report, setReport] = useState<Report>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState("");
  const [page, setPage] = useState(0);
  useEffect(() => {
    let active = true;
    const controller=new AbortController();
    let lastRevision: string | undefined;
    let timer: ReturnType<typeof setTimeout>;
    async function refresh() {
      const stamp=epoch.current;
      try {
        const state = await api<Report>("/profile/status",{signal:controller.signal});
        if (state.status === "ready" && state.revision !== lastRevision) {
          const r = await api<Report>("/profile",{signal:controller.signal});
          if (active && stamp===epoch.current) {
            setError("");
            setReport({ ...r, job: state.job });
            lastRevision = state.revision;
          }
        } else if (active && stamp===epoch.current) {
          setReport((previous) =>
            state.status === "ready" ? { ...previous, ...state } : state,
          );
          if (state.status !== "ready") lastRevision = undefined;
        }
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
  async function run() {
    epoch.current++;
    setBusy(true);
    setError("");
    try {
      const r = await post<Report>("/profile");
      setReport((previous) =>
        r.status === "ready" ? { ...previous, ...r } : r,
      );
      setSelected("");
      setPage(0);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  const running =
    busy ||
    ["queued", "running", "cancelling"].includes(report?.job?.status || "");
  const sources = report?.sources || [];
  const source = sources.find((s) => s.asset_id === selected) || sources[0];
  const candidates = (report?.candidates || [])
    .filter((c) => c.table === source?.asset_id || c.text === source?.asset_id)
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.table.localeCompare(b.table) ||
        a.text.localeCompare(b.text),
    );
  const names = new Map(sources.map((s) => [s.asset_id, s.name]));
  return (
    <section className="lake-profile" aria-label="Lake profile">
      <header>
        <div>
          <h2>Understand your lake</h2>
          <p>
            Explore its contents and possible connections. No source pairs to
            choose.
          </p>
        </div>
        <button onClick={run} disabled={running || savedDemo}>
          {running ? "Updating index…" : report?.status === "stale" ? "Update lake index" : "Profile saved lake"}
        </button>
      </header>
      {error && <p role="alert">{error}</p>}
      {report?.job && (
        <div role="status" className="profile-job">
          <p>
            {report.job.phase} · {report.job.completed}/{report.job.total}
          </p>
          {running && (
            <>
              <progress
                max={Math.max(1, report.job.total)}
                value={report.job.completed}
              />
              <button
                onClick={async () => {
                  try {
                    setReport(await post<Report>("/profile/cancel"));
                  } catch (e) {
                    setError(String(e));
                  }
                }}
              >
                Cancel indexing
              </button>
            </>
          )}
        </div>
      )}
      {report?.work && (
        <p>
          Reused {report.work.reused_sources} sources · Updated{" "}
          {report.work.updated_sources} · Encoded {report.work.encoded_units}{" "}
          units · Scored {report.work.scored_passages} shortlisted passages.{" "}
          {report.work.sampled_sources} sources use representative samples;{" "}
          {report.work.token_truncated_units} new units exceeded the encoder
          token budget.
        </p>
      )}
      {report?.status === "empty" && (
        <p>Save your files, then profile the lake to see what is inside.</p>
      )}
      {report?.status === "stale" && (
        <p role="status">
          Files have changed. Update the index to reuse unchanged embeddings and
          connect new files with existing sources.
        </p>
      )}
      {report?.status === "ready" && (
        <>
          <div className="profile-metrics">
            <span>
              <b>{report.summary?.sources}</b> sources
            </span>
            <span>
              <b>{report.summary?.tables}</b> tables
            </span>
            <span>
              <b>{report.summary?.texts}</b> texts
            </span>
            <span>
              <b>{report.summary?.candidates}</b> candidates
            </span>
            <span>
              <b>{report.summary?.unresolved}</b> need attention
            </span>
          </div>
          <p className="profile-method">{report.method}</p>
          <details>
            <summary>
              Provisional concepts · observed terms across sources
            </summary>
            <div className="profile-concepts">
              {report.concepts?.map((c) => (
                <span key={c.term}>
                  {c.term} <small>{c.sources} sources</small>
                </span>
              ))}
            </div>
          </details>
          <label>
            Inspect source{" "}
            <select
              aria-label="Profile source"
              value={source?.asset_id || ""}
              onChange={(e) => {
                setSelected(e.target.value);
                setPage(0);
              }}
            >
              {sources.map((s) => (
                <option key={s.asset_id} value={s.asset_id}>
                  {s.name} · {s.asset_id.slice(0, 6)}
                </option>
              ))}
            </select>
          </label>
          {source && (
            <div className="profile-detail">
              <h3>{source.name}</h3>
              <p>
                {source.records}{" "}
                {source.kind === "csv" ? "rows" : "provisional text units"} ·{" "}
                {source.status}
              </p>
              {source.coverage && (
                <p>
                  Indexed {source.coverage.indexed_units} representative units
                  from {source.coverage.available_units} observed units
                  {source.coverage.sampled ? " · Sampled coverage" : ""}.{" "}
                  {source.coverage.character_clipped_units || 0} indexed rows
                  use a bounded character prefix. Text preview shows up to 128
                  units.
                </p>
              )}
              {source.issues.map((i) => (
                <p className="profile-issue" key={i}>
                  {i}
                </p>
              ))}
              {source.columns.length > 0 && (
                <div className="profile-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Provisional column</th>
                        <th>Observed type</th>
                        <th>Missing</th>
                        <th>Distinct values</th>
                      </tr>
                    </thead>
                    <tbody>
                      {source.columns.map((c, i) => (
                        <tr key={i}>
                          <td>{c.name}</td>
                          <td>{c.type}</td>
                          <td>{c.missing}</td>
                          <td>
                            {c.distinct_lower_bound}
                            {c.distinct_capped ? "+" : ""}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {source.anchor && (
                <p>
                  Automatic anchor cues:{" "}
                  {source.anchor.terms.join(", ") || "none"}.{" "}
                  {source.anchor.candidate_count} text candidates.
                </p>
              )}
              {source.units.length > 0 && (
                <details>
                  <summary>Text units with original character offsets</summary>
                  {source.units.slice(page * 20, page * 20 + 20).map((u) => (
                    <p key={u.start}>
                      <small>
                        {u.start}–{u.end}
                      </small>{" "}
                      {u.preview}
                      {u.clipped ? "…" : ""}
                    </p>
                  ))}
                  <button disabled={!page} onClick={() => setPage(page - 1)}>
                    Previous units
                  </button>
                  <button
                    disabled={(page + 1) * 20 >= source.units.length}
                    onClick={() => setPage(page + 1)}
                  >
                    Next units
                  </button>
                </details>
              )}
              <h4>Candidate neighborhood · highest score first · unverified</h4>
              {candidates.length === 0 ? (
                <p>
                  No retained candidates. This does not prove that the source is
                  unrelated.
                </p>
              ) : (
                candidates.map((c) => (
                  <div className="profile-candidate" key={c.table + c.text}>
                    <button
                      onClick={() => {
                        setSelected(
                          source.asset_id === c.table ? c.text : c.table,
                        );
                        setPage(0);
                      }}
                    >
                      {names.get(
                        source.asset_id === c.table ? c.text : c.table,
                      )}
                    </button>
                    <span>Retrieval score {c.score.toFixed(3)}</span>
                    {c.evidence && (
                      <p>
                        Candidate cue: row {c.evidence.row_index} → text offsets{" "}
                        {c.evidence.start}–{c.evidence.end}.{" "}
                        {c.evidence.preview}
                      </p>
                    )}
                    <p>
                      Shared content:{" "}
                      {c.shared_terms.join(", ") ||
                        "semantic retrieval; no shared terms"}
                    </p>
                  </div>
                ))
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
