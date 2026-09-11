import { useState } from "react";
import {
  sources,
  changes,
  assess,
  sameSelection,
  type HistoryEvent,
  type Support,
} from "./model";
import "./review.css";
export function Augmentation({
  withdrawn,
  onApply,
  onHistory,
}: {
  withdrawn: string[];
  onApply: (ids: string[]) => void;
  onHistory: () => void;
}) {
  const [draft, setDraft] = useState(withdrawn);
  const [selected, setSelected] = useState("C1");
  const [selectedSpan, setSelectedSpan] = useState<Support>();
  const change = changes.find((c) => c.id === selected)!;
  const result = assess(change, draft);
  const applied = assess(change, withdrawn);
  const pending = !sameSelection(draft, withdrawn);
  const impacts = changes.flatMap((c) => {
    const before = assess(c, withdrawn);
    return assess(c, draft).values.map((v) => ({
      id: c.id,
      value: v.value,
      was: before.values.find((b) => b.value === v.value)!.active.length,
      now: v.active.length,
    }));
  });
  const lost = impacts.filter((i) => i.was > 0 && i.now === 0);
  const retained = impacts.filter((i) => i.was > i.now && i.now > 0);
  const anchor = selectedSpan ?? change.proposals[0].support[0];
  const document = sources.find((s) => s.id === anchor.source)!;
  function select(id: string) {
    setSelected(id);
    setSelectedSpan(undefined);
  }
  return (
    <div className="augmentation-workspace">
      <div className="example-banner">
        <div>
          <strong>Illustrative augmentation workspace</strong>
          <span>
            Synthetic records only · No THOR inference or real source
            withdrawal.
          </span>
        </div>
        <button className="text-button" onClick={onHistory}>
          View example history
        </button>
      </div>
      <div className="augmentation-heading">
        <div>
          <h2>Review augmentation</h2>
          <p>Inspect proposed values, then test how their support changes.</p>
        </div>
        <span className="session-badge">3 example changes</span>
      </div>
      <div className="augmentation-layout">
        <div className="change-review">
          <div
            className="change-table-wrap"
            role="region"
            aria-label="Augmentation changes"
            tabIndex={0}
          >
            <table className="change-table">
              <thead>
                <tr>
                  <th>Record / field</th>
                  <th>Original</th>
                  <th>Proposed</th>
                  <th>Support</th>
                </tr>
              </thead>
              <tbody>
                {changes.map((c) => (
                  <tr
                    key={c.id}
                    className={selected === c.id ? "active-change" : ""}
                  >
                    <th>
                      <button
                        aria-label={`Review change ${c.id}`}
                        onClick={() => select(c.id)}
                      >
                        {c.field}
                        <small>{c.record}</small>
                      </button>
                    </th>
                    <td>{c.original.join(", ") || <em>Empty</em>}</td>
                    <td>
                      {c.proposals.map((v) => (
                        <span className="proposed-value" key={v.value}>
                          {v.value}
                        </span>
                      ))}
                    </td>
                    <td>
                      <span
                        className={`support-status status-${assess(c, draft).state.toLowerCase().replaceAll(" ", "-")}`}
                      >
                        {assess(c, draft).state}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <section
            className="change-detail"
            aria-label="Selected change details"
          >
            <div className="change-detail-heading">
              <h3>{change.field}</h3>
              <span>
                {change.id} ·{" "}
                {pending ? "Withdrawal preview" : "Applied example"}
              </span>
            </div>
            <div className="before-after">
              <div>
                <small>Original value</small>
                <strong>{change.original.join(", ") || "Empty"}</strong>
              </div>
              <span aria-hidden="true">→</span>
              <div>
                <small>Supported review values</small>
                <strong data-testid="review-values">
                  {result.reviewValues.join(", ") || "No supported addition"}
                </strong>
              </div>
            </div>
            <p>{change.note}</p>
            <div className="value-support">
              {result.values.map((v) => (
                <div key={v.value}>
                  <strong>{v.value}</strong>
                  <span>
                    {v.active.length
                      ? `${v.active.length} supporting source${v.active.length === 1 ? "" : "s"}`
                      : "No active support"}
                  </span>
                  <div>
                    {v.support.map((s, i) => (
                      <button
                        key={i}
                        className={
                          draft.includes(s.source) ? "withdrawn-support" : ""
                        }
                        aria-label={`Inspect ${v.value} in ${s.source}`}
                        onClick={() => setSelectedSpan(s)}
                      >
                        {s.source}
                        {draft.includes(s.source) ? " · withdrawn" : ""}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {change.contrary.map((v) => (
                <div key={v.value}>
                  <strong>Contrary: {v.value}</strong>
                  <span>Separate claim</span>
                  <div>
                    {v.support.map((s, i) => (
                      <button
                        key={i}
                        aria-label={`Inspect contrary ${v.value} in ${s.source}`}
                        onClick={() => setSelectedSpan(s)}
                      >
                        {s.source}
                        {draft.includes(s.source) ? " · withdrawn" : ""}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="augmentation-source">
              <div>
                <strong>{document.name}</strong>
                <span>
                  {document.id} ·{" "}
                  {draft.includes(document.id)
                    ? "Withdrawn in preview; provenance retained"
                    : "Active in preview"}
                </span>
              </div>
              <p>
                {document.text.slice(0, anchor.start)}
                <mark>{document.text.slice(anchor.start, anchor.end)}</mark>
                {document.text.slice(anchor.end)}
              </p>
              <small>
                Exact source characters {anchor.start}–{anchor.end} (end
                exclusive)
              </small>
            </div>
            {pending && (
              <p className="draft-note">
                Applied state is still {applied.state.toLowerCase()}. This
                preview has not changed the example.
              </p>
            )}
          </section>
        </div>
        <aside
          className="withdrawal-panel"
          aria-label="Source withdrawal preview"
        >
          <h3>What if a source is removed?</h3>
          <p>
            Select sources to withhold from this example. Your uploaded files
            are unaffected.
          </p>
          <fieldset>
            <legend>Withdraw from example support</legend>
            {sources.map((s) => (
              <label key={s.id}>
                <input
                  type="checkbox"
                  checked={draft.includes(s.id)}
                  onChange={(e) =>
                    setDraft(
                      e.target.checked
                        ? [...draft, s.id]
                        : draft.filter((id) => id !== s.id),
                    )
                  }
                />
                <span>
                  <strong>
                    {s.id} · {s.name}
                  </strong>
                  <small>{s.text.length} characters · Synthetic</small>
                </span>
              </label>
            ))}
          </fieldset>
          <div className="impact-summary" role="status">
            <strong>{pending ? "Draft impact" : "No unapplied changes"}</strong>
            <p>
              {lost.length} {lost.length === 1 ? "value loses" : "values lose"}{" "}
              all support
            </p>
            {lost.map((i) => (
              <small key={i.id + i.value}>
                {i.value} · {i.id}
              </small>
            ))}
            <p>
              {retained.length}{" "}
              {retained.length === 1 ? "value retains" : "values retain"}{" "}
              independent support
            </p>
            {retained.map((i) => (
              <small key={i.id + i.value}>
                {i.value} · {i.id}
              </small>
            ))}
          </div>
          <button
            className="primary"
            disabled={!pending}
            onClick={() => onApply([...draft])}
          >
            Apply to example
          </button>
          <button
            className="secondary"
            disabled={!pending}
            onClick={() => setDraft([...withdrawn])}
          >
            Discard preview
          </button>
          <button
            className="text-button"
            disabled={!draft.length}
            onClick={() => setDraft([])}
          >
            Preview restoring all sources
          </button>
          <small className="withdrawal-note">
            Loss of support means “not established from active sources,” not
            “false.” Original values stay intact.
          </small>
        </aside>
      </div>
    </div>
  );
}
const stages = [
  [
    "Initial discovery",
    "Example source relationships established for interface review.",
  ],
  ["Augmentation", "Three candidate changes are available for review."],
  [
    "Discovery feedback",
    "Planned: use grounded additions as discovery cues. No feedback run has occurred.",
  ],
  [
    "Fresh re-evaluation",
    "Applying or restoring an example withdrawal recalculates fixture support only.",
  ],
];
export function History({
  events,
  onReview,
}: {
  events: HistoryEvent[];
  onReview: () => void;
}) {
  return (
    <section className="history-workspace">
      <div className="example-banner">
        <div>
          <strong>Illustrative history</strong>
          <span>
            These stages describe the example. Session events below are UI
            interactions, not model runs.
          </span>
        </div>
        <button className="text-button" onClick={onReview}>
          Review augmentation
        </button>
      </div>
      <div className="augmentation-heading">
        <div>
          <h2>Discovery & change history</h2>
          <p>Separate proposed stages from actions taken in this session.</p>
        </div>
      </div>
      <ol className="stage-history">
        {stages.map(([name, description], i) => (
          <li key={name}>
            <span>{i + 1}</span>
            <div>
              <h3>{name}</h3>
              <p>{description}</p>
            </div>
            <small>{i < 2 ? "Illustrative baseline" : "Not executed"}</small>
          </li>
        ))}
      </ol>
      <h3 className="session-history-title">Example session events</h3>
      {events.length ? (
        <ol className="session-events">
          {[...events].reverse().map((e) => (
            <li key={e.id}>
              <strong>{e.kind}</strong>
              <p>{e.message}</p>
              <small>
                Event {e.id} · Withdrawn sources:{" "}
                {e.withdrawn.join(", ") || "none"}
              </small>
            </li>
          ))}
        </ol>
      ) : (
        <p className="no-events">
          No source interventions yet. Preview a withdrawal in Integration to
          inspect its impact.
        </p>
      )}
    </section>
  );
}
