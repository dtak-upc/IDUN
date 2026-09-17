import { savedDemo } from "../mode";
import { useEffect, useState } from "react";
import { api } from "../storage/api";
import "./landscape.css";
type Evidence = {
  id: string;
  row_index: number;
  score: number;
  row_preview: string;
  text_preview: string;
};
type Member = { id: string; name: string; links: number; evidence: Evidence };
type Neighborhood = {
  id: string;
  name: string;
  links: number;
  tables: number;
  members: Member[];
};
type Landscape = {
  revision: string;
  total: number;
  neighborhoods: Neighborhood[];
  unlinked: { id: string; name: string }[];
};
export function LiveLandscape({
  revision,
  onOpenEvidence,
  onBrowse,
}: {
  revision?: string;
  onOpenEvidence: (id: string) => void;
  onBrowse: (source: string) => void;
}) {
  const [data, setData] = useState<Landscape>();
  const [error, setError] = useState("");
  const [selected, setSelected] = useState("");
  const [member, setMember] = useState("");
  const [view, setView] = useState<"landscape" | "unlinked">("landscape");
  useEffect(() => {
    let active=true;
    let timer: ReturnType<typeof setTimeout>;
    const controller=new AbortController();
    setData(undefined);setError("");
    async function load(){
      try {
        const r=await api<Landscape>("/discovery/landscape",{signal:controller.signal});
        if(r.revision!==revision) throw Error('Discovery changed; refreshing connections…');
        if(active){setData(r);setError("");}
      }catch(e){if(active){setError(String(e));timer=setTimeout(load,1500);}}
    }
    void load();
    return ()=>{active=false;clearTimeout(timer);controller.abort();};
  }, [revision]);
  const current = data?.revision === revision ? data : undefined;
  const group =
    current?.neighborhoods.find((n) => n.id === selected) ||
    current?.neighborhoods[0];
  const focus =
    group?.members.find((m) => m.id === member) || group?.members[0];
  return (
    <section className="lake-landscape" aria-label="Live source landscape">
      <div className="lake-landscape-title">
        <div>
          <span className="live-kicker">AN EMERGING PICTURE</span>
          <h2>
            Follow the connections.
            <br />
            <em>Find the possibilities.</em>
          </h2>
          <p>Explore the tables brought together by text in your lake.</p>
        </div>
        <span className="lake-live-badge">● {savedDemo ? "Saved discovery results" : "Live LOKI results"}</span>
      </div>
      <nav className="lake-landscape-tabs" aria-label="Landscape views">
        <button
          aria-pressed={view === "landscape"}
          onClick={() => setView("landscape")}
        >
          Source landscape
        </button>
        <button
          aria-pressed={view === "unlinked"}
          onClick={() => setView("unlinked")}
        >
          Without retained links <span>{current?.unlinked.length ?? "—"}</span>
        </button>
      </nav>
      {error ? (
        <p role="alert">{error}</p>
      ) : !current ? (
        <p role="status">Loading your lake’s connections…</p>
      ) : view === "unlinked" ? (
        <div className="lake-unlinked">
          <h3>Keep the unexplored in view</h3>
          <p>
            These sources have no retained LOKI link at the current coverage and
            threshold. This does not mean they are unrelated.
          </p>
          {current.unlinked.length ? (
            current.unlinked.map((s) => (
              <button key={s.id} onClick={() => onBrowse(s.id)}>
                {s.name}
                <small>{s.id.slice(0, 8)} · Browse evidence →</small>
              </button>
            ))
          ) : (
            <p>Every indexed source has at least one retained link.</p>
          )}
        </div>
      ) : !group ? (
        <p>
          No neighborhoods at this threshold. Review the scoring policy or
          explore sources without retained links.
        </p>
      ) : (
        <>
          <div className="lake-neighborhoods" aria-label="Text neighborhoods">
            {current.neighborhoods.map((n, i) => (
              <button
                key={n.id}
                aria-pressed={n.id === group.id}
                onClick={() => {
                  setSelected(n.id);
                  setMember("");
                }}
              >
                <span>{String(i + 1).padStart(2, "0")}</span>
                <strong>{n.name}</strong>
                <small>
                  {n.tables} {n.tables === 1 ? "table" : "tables"} ·{" "}
                  {n.links.toLocaleString()} links · {n.id.slice(0, 6)}
                </small>
              </button>
            ))}
          </div>
          <div className="lake-map-layout">
            <div className="lake-map">
              <div className="lake-map-caption">
                SELECT A TABLE TO TRACE ITS EVIDENCE
              </div>
              <div className="lake-map-scene">
                <svg
                  viewBox="0 0 600 340"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  {group.members.map((m, i) => {
                    const left = i % 2 === 0,
                      y = 55 + Math.floor(i / 2) * 110;
                    return (
                      <path
                        key={m.id}
                        className={m.id === focus?.id ? "selected" : ""}
                        d={`M300 170 C${left ? 210 : 390} 170 ${left ? 210 : 390} ${y} ${left ? 100 : 500} ${y}`}
                      />
                    );
                  })}
                </svg>
                <div className="lake-text-hub">
                  <span>TXT</span>
                  <strong>Shared text</strong>
                  <small>{group.tables} connected tables</small>
                </div>
                {group.members.map((m, i) => (
                  <button
                    className="lake-source-node"
                    key={m.id}
                    style={{
                      left: i % 2 === 0 ? "2%" : "70%",
                      top: `${3 + Math.floor(i / 2) * 32}%`,
                    }}
                    aria-pressed={m.id === focus?.id}
                    onClick={() => setMember(m.id)}
                  >
                    <span>CSV · {m.id.slice(0, 6)}</span>
                    <strong>{m.name}</strong>
                    <small>{m.links.toLocaleString()} retained links</small>
                  </button>
                ))}
              </div>
              <p className="lake-map-note">
                {group.name} · Showing {group.members.length} of {group.tables}{" "}
                tables. Connections summarize retained links, not validated
                joins.
              </p>
            </div>
            {focus && (
              <aside className="lake-focus" aria-label="Connection in focus">
                <span className="live-kicker">CONNECTION IN FOCUS</span>
                <h3>{focus.name}</h3>
                <p>
                  {focus.links.toLocaleString()} row–text links to{" "}
                  <strong>{group.name}</strong>.
                </p>
                <div className="lake-evidence-label">
                  HIGHEST-SCORING LINK <b>{focus.evidence.score.toFixed(3)}</b>
                </div>
                <blockquote>
                  <small>ROW {focus.evidence.row_index}</small>
                  {focus.evidence.row_preview.slice(0, 180)}
                </blockquote>
                <span className="lake-evidence-arrow">
                  ↓ linked through text
                </span>
                <blockquote className="lake-text-quote">
                  {focus.evidence.text_preview.slice(0, 220)}
                </blockquote>
                <button
                  className="live-primary"
                  onClick={() => onOpenEvidence(focus.evidence.id)}
                >
                  Trace source evidence →
                </button>
                <button onClick={() => onBrowse(focus.id)}>
                  Browse this table’s links
                </button>
              </aside>
            )}
          </div>
          <p className="live-muted">
            Showing {current.neighborhoods.length} of {current.total} text
            neighborhoods, ranked by connected table count, then highest score.
            Each map shows up to six tables. Multiple tables linked to a
            document need not share the same text unit; inspect Shared-text
            bridges below for that stronger candidate condition.
          </p>
        </>
      )}
    </section>
  );
}
