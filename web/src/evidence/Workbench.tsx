import { useEffect, useRef, useState } from "react";
import {
  assertions,
  documents,
  evidence,
  sourceTables,
  viewTitles,
  highlightFor,
  type WorkbenchView,
} from "./example";
import "./workbench.css";
export function Workbench({
  view,
  onViewChange,
  onDiscover,
}: {
  view: WorkbenchView;
  onViewChange: (v: WorkbenchView) => void;
  onDiscover: () => void;
}) {
  const [selectedId, setSelectedId] = useState("R1");
  const [field, setField] = useState("values");
  const [selectedValue, setSelectedValue] = useState<string>();
  const [evidenceId, setEvidenceId] = useState<string>();
  const [split, setSplit] = useState(43);
  const rows = assertions.filter((a) => a.view === view);
  const selected = rows.find((a) => a.id === selectedId) ?? rows[0];
  const supports = evidence.filter((e) => selected.evidenceIds.includes(e.id));
  const active = supports.find((e) => e.id === evidenceId) ?? supports[0];
  const document = documents.find((d) => d.id === active?.documentId);
  const range = active ? highlightFor(active, selectedValue) : undefined;
  function choose(id: string, key = "values", value?: string) {
    setSelectedId(id);
    setField(key);
    setSelectedValue(value);
    setEvidenceId(undefined);
  }
  function changeView(v: WorkbenchView) {
    onViewChange(v);
    choose(assertions.find((a) => a.view === v)!.id);
  }
  const textPane = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const p = textPane.current;
    const m = p?.querySelector("mark");
    if (p && m)
      p.scrollTop +=
        m.getBoundingClientRect().top - p.getBoundingClientRect().top - 70;
  }, [active?.id, selectedValue]);
  function resize(e: React.PointerEvent<HTMLDivElement>) {
    if (e.type === "pointerdown")
      e.currentTarget.setPointerCapture(e.pointerId);
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    const r = e.currentTarget.parentElement!.getBoundingClientRect();
    setSplit(
      Math.round(
        Math.min(65, Math.max(30, (100 * (e.clientX - r.left)) / r.width)),
      ),
    );
  }
  return (
    <div className="evidence-workbench">
      <div className="example-banner">
        <div>
          <strong>Illustrative evidence workspace</strong>
          <span>
            Synthetic records and narratives · No model inference or
            materialization has run.
          </span>
        </div>
        <button className="text-button" onClick={onDiscover}>
          Back to discovery
        </button>
      </div>
      <div className="workbench-heading">
        <div>
          <span className="eyebrow">THE EVIDENCE ROOM</span>
          <h2>Evidence workbench</h2>
        </div>
        <label>
          Example view
          <select
            aria-label="Example view"
            value={view}
            onChange={(e) => changeView(e.target.value as WorkbenchView)}
          >
            {Object.entries(viewTitles).map(([id, title]) => (
              <option key={id} value={id}>
                {title}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="evidence-lens" aria-label="Selected evidence overview">
        <div className="lens-orbit" aria-hidden="true">
          <span>{selected.sourceRows[0]}</span>
          <i />
          <b>{active ? active.documentId : "∅"}</b>
          <i />
          <span>{selected.sourceRows[1] ?? "Value"}</span>
        </div>
        <div>
          <span className="scene-kicker">
            {selected.state.toUpperCase()} / {selected.id}
          </span>
          <h3>{selected.values.join(" + ") || "An open question."}</h3>
          <p>
            {selected.context} <span>↔</span> {selected.target}
          </p>
        </div>
        <div className="lens-counter">
          <strong>{String(supports.length).padStart(2, "0")}</strong>
          <span>linked passages</span>
        </div>
      </div>
      <section className="output-panel" aria-labelledby="output-title">
        <div className="panel-bar blue-bar">
          <h3 id="output-title">
            01 <span>Proposed output</span>
          </h3>
          <span>{rows.length} example records · Select any cell</span>
        </div>
        <div
          className="output-table-scroll"
          tabIndex={0}
          role="region"
          aria-label="Proposed output table"
        >
          <table className="output-table">
            <thead>
              <tr>
                {[
                  "Record",
                  "Context",
                  "Target",
                  "Relation / attribute",
                  "Value",
                  "Evidence state",
                ].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className={selected.id === row.id ? "current-output" : ""}
                >
                  <th scope="row">
                    <button
                      aria-label={`Select ${row.id}`}
                      onClick={() => choose(row.id)}
                    >
                      {row.id}
                    </button>
                  </th>
                  {(["context", "target", "attribute"] as const).map((key) => (
                    <td key={key}>
                      <button
                        className={
                          selected.id === row.id && field === key
                            ? "selected-cell"
                            : ""
                        }
                        onClick={() => choose(row.id, key, row[key])}
                      >
                        {row[key]}
                      </button>
                    </td>
                  ))}
                  <td>
                    <div className="output-values">
                      {row.values.length ? (
                        row.values.map((value) => (
                          <button
                            key={value}
                            aria-label={`Inspect ${value} in ${row.id}`}
                            className={
                              selected.id === row.id &&
                              field === "values" &&
                              (!selectedValue || selectedValue === value)
                                ? "selected-cell"
                                : ""
                            }
                            onClick={() => choose(row.id, "values", value)}
                          >
                            {value}
                          </button>
                        ))
                      ) : (
                        <button
                          aria-label={`Inspect unresolved ${row.id}`}
                          onClick={() => choose(row.id)}
                        >
                          Not established
                        </button>
                      )}
                    </div>
                  </td>
                  <td>
                    <button
                      className={`evidence-state state-${row.state.toLowerCase()}`}
                      onClick={() => choose(row.id)}
                    >
                      {row.state}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <div className="selection-summary" role="status">
        <strong>
          {selected.id} / {selected.attribute}
        </strong>
        <span>{selected.values.join(" · ") || "No asserted value"}</span>
        <span>
          {supports.length} evidence passage{supports.length === 1 ? "" : "s"}
        </span>
      </div>
      <div
        className="evidence-panes"
        style={{
          gridTemplateColumns: `minmax(0,${split}fr) 10px minmax(0,${100 - split}fr)`,
        }}
      >
        <section
          className="source-record-panel"
          aria-labelledby="records-title"
        >
          <div className="panel-bar">
            <h3 id="records-title">
              02 <span>Source records</span>
            </h3>
            <span>Raw fields · Opaque row references</span>
          </div>
          {sourceTables.map((table) => (
            <div
              className={`source-table-block source-${table.id.toLowerCase()}`}
              key={table.id}
            >
              <div className="source-table-title">
                <strong>
                  {table.id} / {table.title}
                </strong>
                <span>CSV</span>
              </div>
              <div
                className="source-grid-scroll"
                tabIndex={0}
                role="region"
                aria-label={table.title}
              >
                <table className="source-grid">
                  <thead>
                    <tr>
                      <th>Ref</th>
                      {table.headers.map((h) => (
                        <th key={h}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {table.rows.map((row) => (
                      <tr
                        key={row.id}
                        className={`${selected.sourceRows.includes(row.id) ? "linked-source-row" : ""} ${selected.seedRows?.includes(row.id) ? "seed-source-row" : ""}`}
                      >
                        <th scope="row">
                          <button
                            disabled={
                              !rows.some((a) => a.sourceRows.includes(row.id))
                            }
                            aria-label={`Inspect source row ${row.id}`}
                            onClick={() => {
                              if (!selected.sourceRows.includes(row.id)) {
                                const a = rows.find((a) =>
                                  a.sourceRows.includes(row.id),
                                );
                                if (a) choose(a.id);
                              }
                            }}
                          >
                            {row.id}
                          </button>
                        </th>
                        {row.cells.map((cell, i) => (
                          <td key={i}>
                            {cell || <span className="blank-value">Empty</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
          <p className="source-contract">
            Patient/admission identifiers are not present in these model-facing
            example records. Opaque references link evidence to original
            sources.
          </p>
          {selected.seedRows && (
            <p className="seed-note">
              Seed examples: {selected.seedRows.join(", ")}. The target row and
              observed seed row remain distinct.
            </p>
          )}
        </section>
        <div
          className="pane-resizer"
          role="separator"
          aria-label="Resize source and text panels"
          aria-orientation="vertical"
          aria-valuemin={30}
          aria-valuemax={65}
          aria-valuenow={split}
          tabIndex={0}
          onPointerDown={resize}
          onPointerMove={resize}
          onPointerUp={(e) => {
            if (e.currentTarget.hasPointerCapture(e.pointerId))
              e.currentTarget.releasePointerCapture(e.pointerId);
          }}
          onKeyDown={(e) => {
            if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) {
              e.preventDefault();
              setSplit((v) =>
                e.key === "Home"
                  ? 30
                  : e.key === "End"
                    ? 65
                    : Math.min(
                        65,
                        Math.max(30, v + (e.key === "ArrowLeft" ? -5 : 5)),
                      ),
              );
            }
          }}
        />
        <section className="document-panel" aria-labelledby="document-title">
          <div className="panel-bar mint-bar">
            <h3 id="document-title">
              03 <span>Text evidence</span>
            </h3>
            <span>{active?.documentId ?? "No linked document"}</span>
          </div>
          {supports.length ? (
            <>
              <div className="evidence-switcher" aria-label="Evidence passages">
                {supports.map((item) => (
                  <button
                    key={item.id}
                    aria-pressed={active?.id === item.id}
                    className={
                      item.stance === "Competing" ? "competing-passage" : ""
                    }
                    onClick={() => setEvidenceId(item.id)}
                  >
                    {item.stance} / {item.documentId}
                  </button>
                ))}
              </div>
              <div className="document-heading">
                <strong>{document!.title}</strong>
                <span>
                  {active!.stance} passage · Characters {range!.start}–
                  {range!.end} (end exclusive)
                </span>
              </div>
              <div
                ref={textPane}
                className="document-text"
                tabIndex={0}
                role="region"
                aria-label="Clinical text with highlighted evidence"
              >
                <span>{document!.text.slice(0, range!.start)}</span>
                <mark
                  className={
                    active!.stance === "Competing" ? "competing-highlight" : ""
                  }
                >
                  {document!.text.slice(range!.start, range!.end)}
                </mark>
                <span>{document!.text.slice(range!.end)}</span>
              </div>
              <div className="evidence-quote">
                <span className="detail-label">Full passage context</span>
                <p>{active!.quote}</p>
              </div>
            </>
          ) : (
            <div className="missing-evidence">
              <span className="unlinked-symbol" aria-hidden="true">
                ∅
              </span>
              <h3>No linking passage</h3>
              <p>
                These records have no supporting statement in the example. Their
                presence together does not establish a relationship.
              </p>
              <strong>No relation has been asserted.</strong>
            </div>
          )}
        </section>
      </div>
      <details
        className="derivation-panel"
        open={selected.state === "Conflicting"}
      >
        <summary className="panel-bar">
          <h3 id="derivation-title">
            04 <span>Why this result?</span>
          </h3>
          <span>
            {selected.state} · {selected.id}
          </span>
        </summary>
        <div className="derivation-body">
          <div
            className="derivation-path"
            aria-label="Evidence derivation path"
          >
            <div className="path-node path-table">
              <small>
                {selected.seedRows ? "Observed seeds" : "Source record"}
              </small>
              <strong>
                {selected.seedRows?.join(" + ") || selected.sourceRows[0]}
              </strong>
            </div>
            <span className="path-arrow" aria-hidden="true">
              →
            </span>
            <div
              className={`path-node path-text ${!active ? "path-missing" : ""}`}
            >
              <small>{active ? "Mediating passage" : "Missing evidence"}</small>
              <strong>
                {active ? `${active.documentId} / ${active.id}` : "No span"}
              </strong>
            </div>
            <span className="path-arrow" aria-hidden="true">
              →
            </span>
            <div className="path-node path-result">
              <small>
                {selected.sourceRows.length > 1
                  ? "Related record"
                  : "Target cell"}
              </small>
              <strong>
                {selected.sourceRows.length > 1
                  ? selected.sourceRows[1]
                  : `${selected.sourceRows[0]} / ${selected.attribute}`}
              </strong>
            </div>
          </div>
          <p>{selected.explanation}</p>
          {selected.state === "Conflicting" && (
            <p className="conflict-note">
              Competing interpretations are retained. Selecting one passage does
              not resolve the conflict.
            </p>
          )}
        </div>
      </details>
    </div>
  );
}
