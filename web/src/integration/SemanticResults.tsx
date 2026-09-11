import { useState } from "react";
export type SemanticPlan = {
  id: string;
  title: string;
  description: string;
  materialized: boolean;
  model: string;
  seconds: number;
  scope: string;
  counts: { include: number; abstain: number; conflict: number };
  coverage: {
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
  name: string;
  columns: string[];
  record: { cells: string[] };
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
  }[];
};
type JoinedRow = {
  candidate: string;
  left_value: string;
  right_value: string;
  relation: string;
  cluster: number;
  evidence_quote: string;
  evidence_count: number;
  path_count?: number;
  left_columns: string[];
  right_columns: string[];
  left_cells: string[];
  right_cells: string[];
  left_link: string;
  right_link: string;
};
const label = (s: string) => s.replaceAll("_", " ").toLowerCase();
export function SemanticResults({
  plan,
  busy,
  onMaterialize,
  onEvidence,
  csvHref,
}: {
  plan: SemanticPlan;
  busy: boolean;
  onMaterialize: () => void;
  onEvidence: (l: string, r: string) => void;
  csvHref?: (relation?: string) => string;
}) {
  const [view, setView] = useState("table");
  const [relation, setRelation] = useState("all");
  const [allFields, setAllFields] = useState(false);
  const [focus, setFocus] = useState("");
  const relations = [...new Set(plan.output.map((r) => r.relation))];
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
  const extent = (axis: number) => {
    const vs = plan.cases.map((c) => c.point?.[axis] || 0);
    return [Math.min(...vs), Math.max(...vs)];
  };
  const bounds = [extent(0), extent(1)];
  const position = (c: Case, axis: number) => {
    const [lo, hi] = bounds[axis];
    return hi === lo
      ? 50
      : 5 + (90 * ((c.point?.[axis] || 0) - lo)) / (hi - lo);
  };
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
          {plan.coverage.reviewed} of {plan.coverage.available_pairs} row pairs
          reviewed
        </small>
      </div>
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
        <div>
          <span className="live-kicker">RELATIONSHIP SPACE</span>
          <p>
            LOKI contextual evidence → HDBSCAN → clinical relation refinement
          </p>
          <div className="semantic-map" aria-label="Contextual pair projection">
            {plan.cases.map((c) => {
              const d = plan.decisions.find((d) => d.candidate === c.candidate);
              return (
                <button
                  key={c.candidate}
                  className={`semantic-dot ${d?.status || ""} ${focus === c.candidate ? "selected" : ""}`}
                  style={{
                    left: `${position(c, 0)}%`,
                    bottom: `${position(c, 1)}%`,
                  }}
                  title={`${c.candidate} · cluster ${c.cluster}${c.noise ? " · singleton/noise" : ""} · ${d?.relations.join(", ") || d?.status}`}
                  aria-label={`Review pair ${c.candidate}`}
                  onClick={() => {
                    setFocus(c.candidate);
                    setView("decisions");
                  }}
                />
              );
            })}
          </div>
          <small>
            Each point is a row pair. Position is a 2D projection, not a
            relation score. Select a point to review it.
          </small>
        </div>
        <div className="semantic-summary">
          <h3>Full records, connected through evidence</h3>
          <p>
            Diagnosis and medication fields stay attached to each relationship.
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
      <div className="integration-actions">
        <button
          aria-pressed={view === "table"}
          onClick={() => setView("table")}
        >
          Relationship tables
        </button>
        <button
          aria-pressed={view === "decisions"}
          onClick={() => {
            setFocus("");
            setView("decisions");
          }}
        >
          Review every decision
        </button>
        {plan.materialized ? (
          <a
            href={csvHref ? csvHref() : `/api/v1/integration/${plan.id}/csv`}
            download
          >
            Download joined CSV ↓
          </a>
        ) : (
          <button
            className="integration-primary"
            disabled={busy || !plan.output.length}
            onClick={onMaterialize}
          >
            Materialize {plan.output.length} joined rows
          </button>
        )}
      </div>
      {view === "table" ? (
        <>
          <div
            className="semantic-relation-tabs"
            aria-label="Relationship tables"
          >
            <button
              aria-pressed={relation === "all"}
              onClick={() => setRelation("all")}
            >
              All relationships ({plan.output.length})
            </button>
            {relations.map((r) => (
              <button
                key={r}
                aria-pressed={relation === r}
                onClick={() => setRelation(r)}
              >
                {label(r)} ({plan.output.filter((o) => o.relation === r).length}
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
              const rows = plan.output.filter((r) => r.relation === group);
              const leftCols = cols(rows, "left"),
                rightCols = cols(rows, "right");
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
                        {rows.length} joined rows · Source records and
                        supporting evidence
                      </p>
                    </div>
                    {plan.materialized && (
                      <a
                        href={
                          csvHref
                            ? csvHref(group)
                            : `/api/v1/integration/${plan.id}/csv?relation=${encodeURIComponent(group)}`
                        }
                        download
                      >
                        Download {label(group)} CSV ↓
                      </a>
                    )}
                  </header>
                  <div className="integration-table semantic-table">
                    <table aria-label={`${label(group)} joined records`}>
                      <thead>
                        <tr>
                          <th>Pair</th>
                          {allFields ? (
                            leftCols.map((c, i) => (
                              <th key={i}>Diagnosis · {c.name}</th>
                            ))
                          ) : (
                            <th>Diagnosis</th>
                          )}
                          <th>Clinical relationship</th>
                          {allFields ? (
                            rightCols.map((c, i) => (
                              <th key={i}>Medication · {c.name}</th>
                            ))
                          ) : (
                            <>
                              <th>Medication</th>
                              <th>Dose / route</th>
                            </>
                          )}
                          <th>Evidence</th>
                          <th>Trace</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r) => (
                          <tr key={`${r.candidate}/${r.relation}`}>
                            <td>
                              {r.candidate}
                              <small>Cluster {r.cluster}</small>
                            </td>
                            {allFields ? (
                              leftCols.map((c, i) => (
                                <td key={i}>
                                  {r.left_columns[c.index] === c.name
                                    ? r.left_cells[c.index] || "—"
                                    : "—"}
                                </td>
                              ))
                            ) : (
                              <td>{r.left_value}</td>
                            )}
                            <td>
                              <span
                                className={`semantic-relation ${r.relation}`}
                              >
                                {label(r.relation)}
                              </span>
                            </td>
                            {allFields ? (
                              rightCols.map((c, i) => (
                                <td key={i}>
                                  {r.right_columns[c.index] === c.name
                                    ? r.right_cells[c.index] || "—"
                                    : "—"}
                                </td>
                              ))
                            ) : (
                              <>
                                <td>{r.right_value}</td>
                                <td>
                                  {["dosage", "unit", "route"]
                                    .map(
                                      (c) =>
                                        r.right_cells[
                                          r.right_columns.findIndex(
                                            (n) => n.toLowerCase() === c,
                                          )
                                        ],
                                    )
                                    .filter(Boolean)
                                    .join(" · ") || "—"}
                                </td>
                              </>
                            )}
                            <td>
                              <mark>{r.evidence_quote}</mark>
                              <small>
                                {r.evidence_count} supporting passage
                                {r.evidence_count === 1 ? "" : "s"}
                                {r.path_count
                                  ? ` · ${r.path_count} sentence paths`
                                  : ""}
                              </small>
                            </td>
                            <td>
                              <button
                                onClick={() =>
                                  onEvidence(r.left_link, r.right_link)
                                }
                              >
                                Inspect evidence
                              </button>
                            </td>
                          </tr>
                        ))}
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
            Clinical relation labels are model proposals. Matching a clinical
            relationship does not establish patient or admission identity. CSV
            includes every projected source column and evidence provenance.
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
                    return (
                      <section className="semantic-path" key={i}>
                        <strong>
                          {label(v.relationship)} · {label(v.basis)}
                        </strong>
                        <p>{v.reason}</p>
                        <blockquote>{p.context_text || p.text}</blockquote>
                        {(v.diagnosis_quote || v.medication_quote) && (
                          <p>
                            Diagnosis evidence:{" "}
                            {v.diagnosis_quote || "Not established"}
                            <br />
                            Medication evidence:{" "}
                            {v.medication_quote || "Not established"}
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
    </>
  );
}
