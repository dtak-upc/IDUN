import { useState } from "react";
import { concepts, connections, sources, proposals, activity } from "./example";
import type { Proposal } from "./example";
import "./discovery.css";
export function Discovery({
  example,
  onExampleChange,
  fileCount,
  onIntake,
  onOpenEvidence,
}: {
  example: boolean;
  onExampleChange: (value: boolean) => void;
  fileCount: number;
  onIntake: () => void;
  onOpenEvidence: (id: string) => void;
}) {
  const [zoom, setZoom] = useState(1);
  const [selected, setSelected] = useState("conditions");
  const [connection, setConnection] = useState<string>();
  const [proposal, setProposal] = useState<string>();
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"concepts" | "unresolved">("concepts");
  const concept = concepts.find((c) => c.id === selected)!;
  const visible = concepts.filter((c) =>
    `${c.name} ${c.description}`.toLowerCase().includes(query.toLowerCase()),
  );
  const edge = connections.find((c) => c.id === connection);
  const plan = proposals.find((p) => p.id === proposal);
  function reveal(selector: string) {
    requestAnimationFrame(() =>
      document.querySelector(selector)?.scrollIntoView({ block: "nearest" }),
    );
  }
  function selectConcept(id: string) {
    setSelected(id);
    setConnection(undefined);
    setTab("concepts");
    setProposal(undefined);
  }
  if (!example)
    return (
      <section className="discovery-welcome">
        <div className="discovery-emblem" aria-hidden="true">
          ⌘
        </div>
        <span className="eyebrow">
          From unfamiliar sources to useful possibilities
        </span>
        <h2>
          See what your lake
          <br />
          can become.
        </h2>
        <p>
          IDUN will surface concepts, connect related evidence and propose
          useful datasets. You won’t need to know which sources to choose.
        </p>
        <div className="discovery-readiness">
          <span>
            {fileCount
              ? `${fileCount} ${fileCount === 1 ? "file" : "files"} in your intake session`
              : "Start with raw tables and text"}
          </span>
          <p>
            Discovery inference is not connected yet. The interface example
            below is independent of your uploaded files.
          </p>
        </div>
        <div className="welcome-actions">
          <button className="primary" onClick={() => onExampleChange(true)}>
            Explore interface example <span aria-hidden="true">→</span>
          </button>
          <button className="secondary" onClick={onIntake}>
            {fileCount ? "Review your files" : "Add your data lake"}
          </button>
        </div>
        <small>Illustrative content only · No model output</small>
      </section>
    );
  return (
    <div className="discovery-workspace">
      <div className="example-banner">
        <div>
          <strong>Illustrative example</strong>
          <span>
            A synthetic interface scenario, independent of your files. No
            inference has run.
          </span>
        </div>
        <button className="text-button" onClick={() => onExampleChange(false)}>
          Exit example
        </button>
      </div>
      <section className="discovery-intro">
        <div>
          <span className="eyebrow">An emerging picture</span>
          <h2>
            Follow the connections.
            <br />
            <span>Find the possibilities.</span>
          </h2>
          <p>
            Explore a concept or start with a proposed dataset.
            <br />
            Every connection has a route back to its sources.
          </p>
        </div>
        <dl className="discovery-counts">
          <div>
            <dt>Concepts</dt>
            <dd>{concepts.length}</dd>
          </div>
          <div>
            <dt>Connections</dt>
            <dd>{connections.length}</dd>
          </div>
          <div>
            <dt>Example sources</dt>
            <dd>{sources.length}</dd>
          </div>
        </dl>
      </section>
      <nav className="discovery-tabs" aria-label="Discovery views">
        <button
          aria-pressed={tab === "concepts"}
          onClick={() => setTab("concepts")}
        >
          Concept landscape
        </button>
        <button
          aria-pressed={tab === "unresolved"}
          onClick={() => setTab("unresolved")}
        >
          Unresolved sources{" "}
          <span>{sources.filter((s) => s.unresolved).length}</span>
        </button>
      </nav>
      {tab === "concepts" ? (
        <section className="landscape-section" aria-label="Concept landscape">
          <div className="landscape-toolbar">
            <span className="eyebrow">Provisional concepts · Example</span>
            <label>
              <span className="sr-only">Find a concept</span>
              <input
                type="search"
                placeholder="Find a concept…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
          </div>
          <div className="atlas-controls" aria-label="Concept canvas controls">
            <span>
              CONCEPT ATLAS <b> / </b> SELECT A NODE TO TRACE ITS SOURCES
            </span>
            <div>
              <button
                aria-label="Zoom out concept canvas"
                disabled={zoom <= 0.8}
                onClick={() =>
                  setZoom((z) => Math.max(0.8, +(z - 0.2).toFixed(1)))
                }
              >
                −
              </button>
              <output aria-label="Concept canvas zoom">
                {Math.round(zoom * 100)}%
              </output>
              <button
                aria-label="Zoom in concept canvas"
                disabled={zoom >= 1.6}
                onClick={() =>
                  setZoom((z) => Math.min(1.6, +(z + 0.2).toFixed(1)))
                }
              >
                +
              </button>
              <button onClick={() => setZoom(1)}>Reset view</button>
            </div>
          </div>
          <div className="landscape-layout">
            <div className="concept-map" aria-label="Concept map">
              <div
                className="map-space"
                style={{ transform: `scale(${zoom})` }}
              >
                {!visible.length ? (
                  <div className="concept-no-results">
                    <h3>No matching concepts</h3>
                    <p>Try another term from this example.</p>
                    <button className="secondary" onClick={() => setQuery("")}>
                      Reset concept search
                    </button>
                  </div>
                ) : (
                  <>
                    <svg
                      viewBox="0 0 600 330"
                      preserveAspectRatio="none"
                      aria-hidden="true"
                    >
                      <path
                        className={
                          connection === "treatment" ? "edge-selected" : ""
                        }
                        d="M120 89 H456"
                      />
                      <path
                        className={
                          connection === "progress" ? "edge-selected" : ""
                        }
                        d="M120 89 V248"
                      />
                      <path
                        className={
                          connection === "continuity" ? "edge-selected" : ""
                        }
                        d="M120 248 H456"
                      />
                    </svg>
                    {concepts.map((c) => (
                      <button
                        key={c.id}
                        className={`concept-node ${c.id === selected ? "selected-concept" : ""} ${!visible.some((v) => v.id === c.id) ? "muted-concept" : ""}`}
                        disabled={!visible.some((v) => v.id === c.id)}
                        style={{ left: `${c.x}%`, top: `${c.y}%` }}
                        onClick={() => selectConcept(c.id)}
                        aria-pressed={c.id === selected}
                      >
                        <span className="concept-symbol" aria-hidden="true">
                          {c.id === "conditions"
                            ? "◇"
                            : c.id === "medications"
                              ? "＋"
                              : c.id === "course"
                                ? "≋"
                                : "↗"}
                        </span>
                        <strong>{c.name}</strong>
                        <small>
                          {c.sources.length}{" "}
                          {c.sources.length === 1 ? "source" : "sources"}
                        </small>
                      </button>
                    ))}
                    <span className="map-caption">
                      Select a concept to inspect its sources and candidate
                      connections.
                    </span>
                  </>
                )}
              </div>
            </div>
            <aside className="concept-detail">
              <span className="eyebrow">Concept in focus</span>
              <h3>{concept.name}</h3>
              <p>{concept.description}</p>
              <span className="detail-label">Sources in this example</span>
              <SourceList ids={concept.sources} />
              <span className="detail-label">Related connections</span>
              <div className="connection-list">
                {connections
                  .filter((e) => e.from === selected || e.to === selected)
                  .map((e) => (
                    <button
                      key={e.id}
                      className={connection === e.id ? "active-connection" : ""}
                      onClick={() =>
                        setConnection(connection === e.id ? undefined : e.id)
                      }
                      aria-expanded={connection === e.id}
                    >
                      {e.label}
                      <span aria-hidden="true">↗</span>
                    </button>
                  ))}
              </div>
            </aside>
          </div>
          {edge && (
            <div
              className="connection-summary"
              role="region"
              aria-label="Connection summary"
            >
              <div>
                <span className="eyebrow">Candidate connection · Example</span>
                <h3>{edge.label}</h3>
                <p>{edge.evidence}</p>
                <p className="connection-caveat">{edge.caveat}</p>
              </div>
              <div>
                <SourceList ids={edge.sourceIds} />
                <small>
                  Linked record and text-span inspection is planned for the
                  evidence workbench.
                </small>
              </div>
            </div>
          )}
        </section>
      ) : (
        <section className="unresolved-section" aria-label="Unresolved sources">
          <div>
            <span className="eyebrow">Keep uncertainty visible</span>
            <h3>Not every source belongs to a connection.</h3>
            <p>
              These example sources remain available without forcing an
              association.
            </p>
          </div>
          {sources
            .filter((s) => s.unresolved)
            .map((s) => (
              <article key={s.id}>
                <span className="source-kind">{s.kind}</span>
                <div>
                  <h4>{s.title}</h4>
                  <p>{s.unresolved}</p>
                  <small>
                    {s.id} · {s.description}
                  </small>
                </div>
              </article>
            ))}
        </section>
      )}
      <section className="proposal-section" aria-labelledby="proposals-title">
        <div className="section-title">
          <div>
            <span className="eyebrow">From discovery to something useful</span>
            <h3 id="proposals-title">Datasets worth exploring</h3>
          </div>
          <span className="proposal-qualifier">
            Example proposals · Not materialized
          </span>
        </div>
        <div className="proposal-grid">
          {proposals.map((p, i) => (
            <article
              className={`proposal-card ${proposal === p.id ? "selected-proposal" : ""}`}
              key={p.id}
            >
              <span className="proposal-index">0{i + 1}</span>
              <h4>{p.title}</h4>
              <p>{p.subtitle}</p>
              <div className="proposal-tags">
                {p.concepts.map((id) => (
                  <span key={id}>
                    {concepts.find((c) => c.id === id)!.name}
                  </span>
                ))}
              </div>
              <div className="proposal-footer">
                <span>
                  {p.sourceIds.length} sources · {p.fields.length} fields
                </span>
                <button
                  aria-label={`Inspect ${p.title} proposal`}
                  aria-expanded={proposal === p.id}
                  onClick={() => {
                    setProposal(proposal === p.id ? undefined : p.id);
                    if (proposal !== p.id) reveal(".proposal-details");
                  }}
                >
                  Inspect plan <span aria-hidden="true">→</span>
                </button>
              </div>
            </article>
          ))}
        </div>
        {plan && (
          <ProposalDetails
            proposal={plan}
            onClose={() => setProposal(undefined)}
            onOpenEvidence={() => onOpenEvidence(plan.id)}
          />
        )}
      </section>
      <section className="discovery-feed">
        <div>
          <span className="eyebrow">A traceable process</span>
          <h3>How this picture came together</h3>
          <p>An illustrative sequence, not a live run log.</p>
        </div>
        <ol>
          {activity.map((event, index) => (
            <li key={event.id}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <button
                onClick={() => {
                  if (event.kind === "concept") selectConcept(event.target);
                  else if (event.kind === "connection") {
                    setTab("concepts");
                    setConnection(event.target);
                  } else if (event.kind === "proposal")
                    setProposal(event.target);
                  else setTab("unresolved");
                  reveal(
                    event.kind === "proposal"
                      ? ".proposal-details"
                      : event.kind === "unresolved"
                        ? ".unresolved-section"
                        : ".landscape-section",
                  );
                }}
              >
                <strong>{event.label}</strong>
                <small>{event.detail}</small>
              </button>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
function SourceList({ ids }: { ids: string[] }) {
  return (
    <ul className="concept-sources">
      {ids.map((id) => {
        const source = sources.find((s) => s.id === id)!;
        return (
          <li key={id}>
            <span className="source-kind">{source.kind}</span>
            <div>
              <strong>{source.title}</strong>
              <small>{id} · Example source</small>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
function ProposalDetails({
  proposal: p,
  onClose,
  onOpenEvidence,
}: {
  proposal: Proposal;
  onClose: () => void;
  onOpenEvidence: () => void;
}) {
  return (
    <section
      className="proposal-details"
      aria-label={`${p.title} construction plan`}
    >
      <div className="section-title">
        <div>
          <span className="eyebrow">Proposed construction · Example</span>
          <h3>{p.title}</h3>
        </div>
        <button className="text-button" onClick={onClose}>
          Close plan
        </button>
      </div>
      <div className="plan-layout">
        <div>
          <span className="detail-label">Row grain</span>
          <p>{p.grain}</p>
          <span className="detail-label">Proposed fields</span>
          <div className="field-list">
            {p.fields.map((f) => (
              <span key={f}>{f}</span>
            ))}
          </div>
          <span className="detail-label">Construction steps</span>
          <ol>
            {p.steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        </div>
        <div>
          <span className="detail-label">Source coverage</span>
          <SourceList ids={p.sourceIds} />
          <span className="detail-label">Before this can become a dataset</span>
          <ul className="open-questions">
            {p.openQuestions.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
        </div>
      </div>
      <button className="primary" onClick={onOpenEvidence}>
        Open evidence workbench →
      </button>
      <div className="plan-note">
        No dataset has been created. Live discovery, validation and
        materialization will execute this workflow when the engines are
        connected.
      </div>
    </section>
  );
}
