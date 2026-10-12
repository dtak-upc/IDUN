import { useEffect, useState } from "react";
import { api } from "../storage/api";
type Attribute = {
  column: number;
  name: string;
  datatype: string;
  included: boolean;
};
export type Mapping = {
  source_class: string;
  concept: string;
  label_column: number;
  reason: string;
  attributes: Attribute[];
};
type Group = {
  source_class: string;
  source: string;
  columns: string[];
  samples: unknown[][];
  evidence: string[];
  relationships: string[];
};
type Draft = {
  revision: string;
  origin: string;
  mappings: Mapping[];
  groups: Group[];
};
export function ConceptReview({
  lakeId,
  snapshot,
  parent,
  job,
  onPublished,
  onTask,
  onPreview,
}: {
  lakeId: string;
  snapshot: string;
  parent: string | null;
  job?: { id: string; status: string; phase?: string };
  onPublished: (id: string) => void;
  onTask: () => void;
  onPreview: (mappings: Mapping[]) => void;
}) {
  const [draft, setDraft] = useState<Draft>();
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [index, setIndex] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [mergeSameNames, setMergeSameNames] = useState(false);
  useEffect(() => {
    if (mappings.length) onPreview(mappings);
  }, [mappings, onPreview]);
  const url = `/knowledge/snapshots/${snapshot}`;
  useEffect(() => {
    let active = true;
    api<Draft>(url + "/schema", undefined, lakeId)
      .then((d) => {
        if (active) {
          setDraft(d);
          setMappings(d.mappings);
          setDirty(false);
        }
      })
      .catch((e) => {
        if (active) setError(String(e));
      });
    return () => {
      active = false;
    };
  }, [lakeId, snapshot, job?.id, job?.status]);
  const running = job?.status === "running";
  const mapping = mappings[index];
  const group = draft?.groups.find(
    (g) => g.source_class === mapping?.source_class,
  );
  const send = <T,>(operation: string, body: unknown) =>
    api<T>(
      url + "/" + operation,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
      lakeId,
    );
  async function perform(kind: "save" | "suggest" | "accept") {
    if (!draft) return;
    setBusy(true);
    setError("");
    try {
      const body = { revision: draft.revision, mappings };
      if (kind === "accept") {
        const result = await send<{ snapshot: string }>("schema-accept", {
          ...body,
          expected_parent: parent,
          merge_same_names: mergeSameNames,
        });
        onPublished(result.snapshot);
      } else {
        const saved = await send<Draft>("schema-save", body);
        setDraft(saved);
        setMappings(saved.mappings);
        setDirty(false);
        if (kind === "suggest") {
          await send("schema-suggest", { revision: saved.revision });
          onTask();
        }
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  function edit(value: Partial<Mapping>) {
    setMappings((all) =>
      all.map((m, i) => (i === index ? { ...m, ...value } : m)),
    );
    setDirty(true);
  }
  const concepts = new Map<string, { label: string; count: number }>();
  for (const m of mappings) {
    const key = m.concept.trim().toLowerCase();
    const c = concepts.get(key);
    if (c) c.count++;
    else concepts.set(key, { label: m.concept, count: 1 });
  }
  return (
    <section
      className="kg-concept-review kg-real-panel"
      aria-label="Review conceptual schema"
    >
      <header className="kg-canvas-toolbar">
        <div>
          <b>Review concepts & attributes</b>
          <span>
            Map the meaning of the records before publishing the schema.
          </span>
        </div>
        <div>
          <button
            disabled={busy || running || !draft}
            onClick={() => void perform("suggest")}
          >
            Suggest concepts with LLM
          </button>
          <button
            disabled={busy || running || !draft || !dirty}
            onClick={() => void perform("save")}
          >
            Save draft
          </button>
          <button
            className="kg-primary"
            disabled={busy || running || !mappings.length}
            onClick={() => void perform("accept")}
          >
            Accept schema & publish
          </button>
        </div>
      </header>
      <p>
        Source classes stay separate by default, even when concept names match.
        Attribute types are declarations; source values are never converted. LLM
        suggestions use at most 3 record and passage examples per source group.
      </p>
      <label>
        <input
          type="checkbox"
          checked={mergeSameNames}
          disabled={busy || running}
          onChange={(e) => setMergeSameNames(e.target.checked)}
        />
        I approve grouping source classes with the same concept name. Records
        remain distinct.
      </label>
      {running && (
        <p role="status">
          {job?.phase || "Preparing concept suggestions…"}{" "}
          <button
            onClick={async () => {
              await api(
                "/knowledge/cancel",
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: "{}",
                },
                lakeId,
              );
              onTask();
            }}
          >
            Cancel suggestions
          </button>
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      {!draft && <p role="status">Preparing source-column mappings…</p>}
      {draft && (
        <>
          <div className="kg-concept-preview">
            <b>{concepts.size} proposed concepts</b>
            {[...concepts.values()].map((c) => (
              <span key={c.label}>
                {c.label || "Unnamed"} · {c.count} source
                {c.count === 1 ? "" : "s"}
              </span>
            ))}
            <small>
              {draft.origin}
              {dirty ? " · Unsaved edits" : ""}
            </small>
          </div>
          <fieldset disabled={busy || running} className="kg-concept-fields">
            <div
              className="kg-concept-source-list"
              aria-label="Source mappings"
            >
              {mappings.map((m, i) => (
                <button
                  key={m.source_class}
                  aria-pressed={index === i}
                  onClick={() => setIndex(i)}
                >
                  <strong>{m.concept}</strong>
                  <small>
                    {
                      draft.groups.find(
                        (g) => g.source_class === m.source_class,
                      )?.source
                    }
                  </small>
                </button>
              ))}
            </div>
            {mapping && group && (
              <div className="kg-concept-detail">
                <div className="kg-concept-controls">
                  <label>
                    Concept name
                    <input
                      value={mapping.concept}
                      maxLength={100}
                      list="kg-concept-names"
                      onChange={(e) => edit({ concept: e.target.value })}
                    />
                    <datalist id="kg-concept-names">
                      {[...concepts.values()].map((c) => (
                        <option key={c.label} value={c.label} />
                      ))}
                    </datalist>
                  </label>
                  <label>
                    Instance label column
                    <select
                      value={mapping.label_column}
                      onChange={(e) =>
                        edit({ label_column: Number(e.target.value) })
                      }
                    >
                      {group.columns.map((c, i) => (
                        <option value={i} key={i}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <p>{mapping.reason}</p>
                <div className="kg-concept-attributes">
                  <div className="kg-attribute-head">
                    <b>Include</b>
                    <b>Attribute</b>
                    <b>Type</b>
                    <b>Example values</b>
                  </div>
                  {mapping.attributes.map((a, i) => (
                    <div key={a.column}>
                      <input
                        type="checkbox"
                        aria-label={`Include ${group.columns[a.column]}`}
                        checked={a.included}
                        onChange={(e) =>
                          edit({
                            attributes: mapping.attributes.map((v, j) =>
                              i === j
                                ? { ...v, included: e.target.checked }
                                : v,
                            ),
                          })
                        }
                      />
                      <label>
                        <small>{group.columns[a.column]}</small>
                        <input
                          aria-label={`Attribute name ${group.columns[a.column]}`}
                          value={a.name}
                          maxLength={100}
                          onChange={(e) =>
                            edit({
                              attributes: mapping.attributes.map((v, j) =>
                                i === j ? { ...v, name: e.target.value } : v,
                              ),
                            })
                          }
                        />
                      </label>
                      <select
                        aria-label={`Type ${group.columns[a.column]}`}
                        value={a.datatype}
                        onChange={(e) =>
                          edit({
                            attributes: mapping.attributes.map((v, j) =>
                              i === j ? { ...v, datatype: e.target.value } : v,
                            ),
                          })
                        }
                      >
                        {["string", "number", "boolean", "date", "unknown"].map(
                          (t) => (
                            <option key={t}>{t}</option>
                          ),
                        )}
                      </select>
                      <span>
                        {group.samples
                          .map((row) => String(row[a.column] ?? "Missing"))
                          .join(" · ")}
                      </span>
                    </div>
                  ))}
                </div>
                <details>
                  <summary>
                    Supporting context · {group.relationships.join(", ")}
                  </summary>
                  {group.evidence.map((e, i) => (
                    <blockquote key={i}>{e}</blockquote>
                  ))}
                </details>
              </div>
            )}
          </fieldset>
        </>
      )}
    </section>
  );
}
