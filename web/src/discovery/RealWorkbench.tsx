import { useEffect, useRef, useState } from "react";
import { api } from "../storage/api";
import "./real-workbench.css";
type Link = {
  id: string;
  table: string;
  text: string;
  row_index: number;
  score: number;
  start: number;
  end: number;
};
type Snapshot = {
  status: string;
  revision?: string;
  sources?: { id: string; name: string }[];
};
type Ranking = {
  revision: string;
  kind: string;
  total: number;
  candidates: { id: string; name: string; score: number; links: number }[];
};
type Links = { revision: string; total: number; items: Link[] };
type Context = {
  revision: string;
  links: Link[];
  tables: {
    id: string;
    name: string;
    columns: string[];
    selected: number;
    total: number;
    excluded_columns: number;
    rows: { index: number; record_id: string; cells: string[] }[];
  }[];
  document: {
    id: string;
    name: string;
    text: string;
    start: number;
    end: number;
    highlight_start: number;
    highlight_end: number;
    version: string;
  };
};
function useResource<T>(url?: string) {
  const [loaded, setLoaded] = useState<{
    url: string;
    value?: T;
    error?: string;
  }>();
  useEffect(() => {
    let active=true;
    let timer: ReturnType<typeof setTimeout>;
    const controller=new AbortController();
    async function load(){
      if(!url)return;
      try {const value=await api<T>(url,{signal:controller.signal});if(active)setLoaded({url,value});}
      catch(e){if(active){setLoaded({url,error:String(e)});timer=setTimeout(load,1500);}}
    }
    void load();
    return ()=>{active=false;clearTimeout(timer);controller.abort();};
  }, [url]);
  return loaded?.url === url ? loaded : undefined;
}
export function RealWorkbench({
  linkId,
  companionId,
  onBack,
}: {
  linkId?: string;
  companionId?: string;
  onBack: () => void;
}) {
  const [snapshot, setSnapshot] = useState<Snapshot>();
  const [statusError, setStatusError] = useState("");
  useEffect(() => {
    let active=true;
    const controller=new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function refresh(){
      try {const s=await api<Snapshot>("/discovery",{signal:controller.signal});if(active){setSnapshot(s);setStatusError("");}}
      catch(e){if(active)setStatusError(String(e));}
      finally{if(active)timer=setTimeout(refresh,2000);}
    }
    void refresh();
    return ()=>{active=false;clearTimeout(timer);controller.abort();};
  }, []);
  const revision = snapshot?.status === "ready" ? snapshot.revision : undefined;
  const seed = useResource<Link>(
    linkId
      ? `/discovery/links/${linkId}?revision=${revision || "historical"}`
      : undefined,
  );
  const [chosenSource, setChosenSource] = useState("");
  const [k, setK] = useState(5);
  const [chosenCandidate, setChosenCandidate] = useState("");
  const [offset, setOffset] = useState(0);
  const source =
    chosenSource ||
    seed?.value?.table ||
    (!linkId ? snapshot?.sources?.[0]?.id : "") ||
    "";
  const rank = useResource<Ranking>(
    revision && source
      ? `/discovery/workbench?source=${source}&k=${k}&revision=${revision}`
      : undefined,
  );
  const candidates = rank?.value?.candidates || [];
  const candidate =
    candidates.find((c) => c.id === chosenCandidate) ||
    candidates.find((c) => c.id === seed?.value?.text) ||
    candidates[0];
  const pair = `${revision}/${source}/${candidate?.id}`;
  const page = useResource<Links>(
    revision && candidate
      ? `/discovery/workbench-links?source=${source}&candidate=${candidate.id}&offset=${offset}&revision=${revision}`
      : undefined,
  );
  const [chosenLink, setChosenLink] = useState<{ pair: string; id: string }>();
  const seedMatches =
    seed?.value &&
    ((source === seed.value.table && candidate?.id === seed.value.text) ||
      (source === seed.value.text && candidate?.id === seed.value.table));
  const selected =
    chosenLink?.pair === pair
      ? chosenLink.id
      : seedMatches && offset === 0
        ? seed?.value?.id
        : page?.value?.items[0]?.id;
  const evidenceId=selected || (!revision ? linkId : undefined);
  const companion = evidenceId === linkId ? companionId : undefined;
  const context = useResource<Context>(
    evidenceId
      ? `/discovery/evidence/${evidenceId}?revision=${revision || "historical"}${companion ? `&companion=${companion}` : ""}`
      : undefined,
  );
  const detail =
    context?.value && ((!revision && linkId) || context.value.revision === revision) ? context.value : undefined;
  const panels = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (detail) {
      panels.current
        ?.querySelectorAll(".rw-selected, mark")
        .forEach((el) =>
          el.scrollIntoView({ block: "nearest", inline: "nearest" }),
        );
    }
  }, [detail]);
  const error =
    statusError || seed?.error || rank?.error || page?.error || context?.error;
  const points = detail ? Array.from(detail.document.text) : [];
  const start = detail
      ? detail.document.highlight_start - detail.document.start
      : 0,
    end = detail ? detail.document.highlight_end - detail.document.start : 0;
  function chooseSource(id: string) {
    setChosenSource(id);
    setChosenCandidate("");
    setChosenLink(undefined);
    setOffset(0);
  }
  return (
    <section className="real-workbench" aria-label="Live evidence workbench">
      <div className="rw-heading">
        <div>
          <span className="live-kicker">LIVE DISCOVERY · SOURCE EVIDENCE</span>
          <h1>Evidence workbench</h1>
        </div>
        <button onClick={onBack}>← Live discovery</button>
      </div>
      <p className="rw-intro">
        Choose a source. Explore its strongest cross-modal candidates, then
        follow a row into the highlighted text.
      </p>
      {error && <p role="alert">{error}</p>}
      {!revision && !detail ? (
        <p role="status">
          {snapshot?.status === "stale"
            ? "The lake has changed. Refresh indexing and discovery before inspecting evidence."
            : "Run discovery to explore saved source evidence here."}
        </p>
      ) : (
        <>
          {!revision && <p>Saved evidence from an earlier integration run. Update discovery to browse current candidates.</p>}
          {revision && <>
          <div className="rw-controls">
            <label>
              Source table or document
              <select
                aria-label="Evidence source"
                value={source}
                onChange={(e) => chooseSource(e.target.value)}
              >
                {!source && <option value="">Loading source…</option>}
                {snapshot?.sources?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} · {s.id.slice(0, 6)}
                  </option>
                ))}
              </select>
            </label>
            <label className="rw-topk">
              Top <output>{k}</output> candidates
              <input
                aria-label="Top K candidates"
                type="range"
                min="1"
                max="20"
                value={k}
                onChange={(e) => {
                  setK(Number(e.target.value));
                  setOffset(0);
                }}
              />
            </label>
            <span>
              {rank?.value
                ? `${Math.min(k, rank.value.total)} of ${rank.value.total} ${rank.value.kind === "csv" ? "documents" : "tables"}`
                : "Loading candidates…"}
            </span>
          </div>
          <section className="rw-candidates">
            <header>
              <strong>
                01 <span>Ranked candidate sources</span>
              </strong>
              <small>Highest retained LOKI link · Select a source</small>
            </header>
            <div className="rw-candidate-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>
                      {rank?.value?.kind === "txt" ? "Table" : "Document"}
                    </th>
                    <th>LOKI score</th>
                    <th>Retained atomic links</th>
                    <th>Evidence state</th>
                  </tr>
                </thead>
                <tbody>
                  {candidates.map((c, i) => (
                    <tr
                      key={c.id}
                      className={
                        c.id === candidate?.id ? "rw-active-candidate" : ""
                      }
                    >
                      <td>{i + 1}</td>
                      <td>
                        <button
                          aria-pressed={c.id === candidate?.id}
                          onClick={() => {
                            setChosenCandidate(c.id);
                            setChosenLink(undefined);
                            setOffset(0);
                          }}
                        >
                          {c.name}
                          <small>{c.id.slice(0, 8)}</small>
                        </button>
                      </td>
                      <td>{c.score.toFixed(3)}</td>
                      <td>{c.links.toLocaleString()}</td>
                      <td>
                        <span className="rw-proposed">Model-proposed</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rank?.value && !candidates.length && (
                <p>
                  No retained cross-modal candidates for this source at the
                  current threshold.
                </p>
              )}
            </div>
          </section>
          <div className="rw-link-controls">
            <label>
              Evidence atomic link
              <select
                aria-label="Evidence atomic link"
                value={
                  page?.value?.items.some((l) => l.id === selected)
                    ? selected
                    : ""
                }
                onChange={(e) => setChosenLink({ pair, id: e.target.value })}
              >
                {!page?.value?.items.some((l) => l.id === selected) && (
                  <option value="">
                    {selected ? "Opened evidence link" : "Select evidence…"}
                  </option>
                )}
                {page?.value?.items.map((l, i) => (
                  <option value={l.id} key={l.id}>
                    {offset + i + 1}. Row {l.row_index} ↔ text {l.start}–{l.end}{" "}
                    · {l.score.toFixed(3)}
                  </option>
                ))}
              </select>
            </label>
            <div>
              <button
                disabled={!offset}
                onClick={() => {
                  setOffset(Math.max(0, offset - 20));
                  setChosenLink(undefined);
                }}
              >
                Previous links
              </button>
              <span>{page?.value?.total ?? 0} atomic links</span>
              <button
                disabled={!page?.value || offset + 20 >= page.value.total}
                onClick={() => {
                  setOffset(offset + 20);
                  setChosenLink(undefined);
                }}
              >
                Next links
              </button>
            </div>
          </div>
          </>}
          {candidate && !detail && !context?.error && (
            <p role="status">Loading source rows and text…</p>
          )}
          {detail && (
            <>
              <div className="rw-selection">
                <strong>
                  {companion ? "Join-path candidate" : "Row-sentence atomic link"}
                </strong>
                <span>
                  Row {detail.links[0].row_index} · score{" "}
                  {detail.links[0].score.toFixed(3)} · text{" "}
                  {detail.document.highlight_start}–
                  {detail.document.highlight_end}
                </span>
              </div>
              <div className="rw-panels" ref={panels}>
                <section className="rw-records">
                  <header>
                    <strong>
                      02 <span>Source records</span>
                    </strong>
                    <small>Identifiers excluded</small>
                  </header>
                  <div className="rw-record-stack">
                    {detail.tables.map((t, i) => (
                      <article key={t.id} className={`rw-table rw-table-${i}`}>
                        <h2>
                          {String.fromCharCode(65 + i)} / {t.name}
                          <span>CSV</span>
                        </h2>
                        <div className="rw-table-scroll">
                          <table>
                            <thead>
                              <tr>
                                <th>Row</th>
                                {t.columns.map((c, i) => (
                                  <th key={i}>{c}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {t.rows.map((r) => {
                                const linked = page?.value?.items.find(
                                  (l) =>
                                    l.table === t.id && l.row_index === r.index,
                                );
                                return (
                                  <tr
                                    key={r.record_id}
                                    className={
                                      r.index === t.selected
                                        ? "rw-selected"
                                        : ""
                                    }
                                  >
                                    <td>
                                      {linked ? (
                                        <button
                                          aria-label={`Inspect row ${r.index}`}
                                          onClick={() =>
                                            setChosenLink({
                                              pair,
                                              id: linked.id,
                                            })
                                          }
                                        >
                                          {r.index}
                                        </button>
                                      ) : (
                                        r.index
                                      )}
                                    </td>
                                    {r.cells.map((c, i) => (
                                      <td key={i}>{c || <em>Empty</em>}</td>
                                    ))}
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                        <small>
                          Showing {t.rows.length} surrounding rows of {t.total}.{" "}
                          {t.excluded_columns} identifier columns excluded.
                        </small>
                      </article>
                    ))}
                  </div>
                </section>
                <section className="rw-document">
                  <header>
                    <strong>
                      03 <span>Text evidence</span>
                    </strong>
                    <small>TXT</small>
                  </header>
                  <div className="rw-document-body">
                    <h2>{detail.document.name}</h2>
                    <p>
                      Highlighted model text unit · Unicode offsets{" "}
                      {detail.document.highlight_start}–
                      {detail.document.highlight_end} (end exclusive)
                    </p>
                    <div className="rw-text-context">
                      {points.slice(0, start).join("")}
                      <mark>{points.slice(start, end).join("")}</mark>
                      {points.slice(end).join("")}
                    </div>
                    <small>
                      Source excerpt {detail.document.start}–
                      {detail.document.end}. Text units use provisional
                      segmentation; they may be sentence fragments.
                    </small>
                    <details>
                      <summary>Source references and scoring limits</summary>
                      <p>{detail.links.map((l) => l.id).join(" · ")}</p>
                      <p>
                        Source version: {detail.document.version}. Ranking uses
                        maximum retained link score, not a calibrated
                        probability. These links do not yet form a materialized
                        dataset.
                      </p>
                    </details>
                  </div>
                </section>
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}
