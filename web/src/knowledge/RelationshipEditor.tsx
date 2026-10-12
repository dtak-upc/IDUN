import { useEffect, useState, type ReactNode } from "react";

export type RelationshipEditSeed = {
  operation: string;
  edges: string[];
  source?: string;
  target?: string;
};
type Graph = {
  revision: string;
  concepts: { id: string; label: string }[];
  relationships: {
    id: string;
    label: string;
    source: string;
    target: string;
    count: number;
    declared?: boolean;
  }[];
};
type Preview = {
  token: string;
  rows: number;
  notice: string;
  counts: { run: string; title: string; rows: number }[];
  examples: {
    run_title: string;
    relationship: string;
    left: { label: string; source: string; row: number };
    right: { label: string; source: string; row: number };
    evidence: { text?: string; context_text?: string }[];
  }[];
};
type Post = <T>(path: string, body: unknown) => Promise<T>;

export function RelationshipEditor({
  graph,
  runs,
  post,
  disabled,
  onChanged,
  seed,
  graphView,
}: {
  graph: Graph;
  runs: string[];
  post: Post;
  disabled: boolean;
  onChanged: () => void;
  seed?: RelationshipEditSeed;
  graphView?: (controlsHost: HTMLElement | null, onEditingChange:(enabled:boolean)=>void) => ReactNode;
}) {
  const [operation, setOperation] = useState("rename"),
    [edges, setEdges] = useState<string[]>([]),
    [label, setLabel] = useState(""),
    [definition, setDefinition] = useState(""),
    [source, setSource] = useState(""),
    [target, setTarget] = useState(""),
    [search, setSearch] = useState(""),
    [preview, setPreview] = useState<Preview>(),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  const [editingEnabled,setEditingEnabled]=useState(false);
  const [controlsHost,setControlsHost]=useState<HTMLDivElement|null>(null);
  const scope = JSON.stringify(runs);
  useEffect(() => {
    setPreview(undefined);
    setEdges([]);
    setError("");
  }, [graph.revision, scope]);
  useEffect(() => {
    if (!seed) return;
    setOperation(seed.operation);
    setEdges(seed.edges);
    setSource(seed.source || "");
    setTarget(seed.target || "");
    setLabel(
      graph.relationships.find((e) => e.id === seed.edges[0])?.label || "",
    );
    setPreview(undefined);
    setError("");
    setNotice("");
  }, [seed]);
  function change(fn: () => void) {
    fn();
    setPreview(undefined);
    setError("");
    setNotice("");
  }
  const locked = disabled || busy;
  const name = (id: string) =>
    graph.concepts.find((c) => c.id === id)?.label || id;
  const body = {
    runs,
    revision: graph.revision,
    operation,
    edges,
    label,
    definition,
    source,
    target,
  };
  const ready =
    operation === "add"
      ? !!source && !!target && !!label
      : edges.length >= (operation === "merge" ? 2 : 1) &&
        (operation === "remove" || !!label);
  async function action(apply = false) {
    setBusy(true);
    setError("");
    try {
      if (!apply)
        setPreview(await post<Preview>("preview-relationship-edit", body));
      else {
        const result = await post<{ rows: number }>("apply-relationship-edit", {
          ...body,
          preview_token: preview?.token,
        });
        setPreview(undefined);
        setNotice(
          operation === "add"
            ? "Schema relationship added. No instance connections were created."
            : `${result.rows} Integration row contributions updated; the graph is synchronized.`,
        );
        onChanged();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="kg-relationship-editor">
      <div className={"kg-relationship-edit-grid"+(graphView?" kg-schema-edit-layout":"")}>
        <div className="kg-relationship-edit-form" aria-label="Relationship editing panel">
      <header>
        <h3>Edit relationships</h3>
        <p>
          Pick a connection on the graph or choose it below. Edits sync with
          Integration, preserving records and evidence.
        </p>
      </header>
          {graphView&&<div ref={setControlsHost} className="kg-graph-edit-controls"/>}
          <div hidden={!!graphView&&!editingEnabled}>
      <nav className="kg-task-tabs" aria-label="Relationship editing actions">
        {[
          ["rename", "Rename / reclassify"],
          ["merge", "Merge"],
          ["add", "Add type"],
          ["remove", "Remove"],
        ].map(([id, text]) => (
          <button
            key={id}
            aria-pressed={operation === id}
            disabled={locked}
            onClick={() =>
              change(() => {
                setOperation(id);
                setEdges([]);
                setLabel("");
                setDefinition("");
              })
            }
          >
            {text}
          </button>
        ))}
      </nav>
          {operation !== "add" ? (
            <>
              <label>
                Find a connection
                <input
                  aria-label="Find schema relationship"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Relationship or concept name"
                  disabled={locked}
                />
              </label>
              <label>
                {operation === "merge"
                  ? "Add a relationship to merge"
                  : "Schema connection"}
                <select
                  aria-label="Schema relationship to edit"
                  value={operation === "merge" ? "" : edges[0] || ""}
                  disabled={locked}
                  onChange={(e) =>
                    change(() => {
                      const id = e.target.value;
                      setEdges(
                        operation === "merge"
                          ? Array.from(new Set([...edges, id].filter(Boolean)))
                          : id
                            ? [id]
                            : [],
                      );
                      const edge = graph.relationships.find((e) => e.id === id);
                      if (operation === "rename") setLabel(edge?.label || "");
                    })
                  }
                >
                  <option value="">Choose relationship and concepts</option>
                  {graph.relationships
                    .filter(
                      (e) =>
                        !search ||
                        `${e.label} ${name(e.source)} ${name(e.target)}`
                          .toLowerCase()
                          .includes(search.toLowerCase()),
                    )
                    .map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.label} · {name(e.source)} / {name(e.target)} ·{" "}
                        {e.count} instances
                      </option>
                    ))}
                </select>
              </label>
              <div className="kg-relationship-edit-picks">
                {edges.map((id) => {
                  const e = graph.relationships.find((e) => e.id === id);
                  return (
                    e && (
                      <button
                        key={id}
                        disabled={locked}
                        title="Remove from selection"
                        onClick={() =>
                          change(() => setEdges(edges.filter((e) => e !== id)))
                        }
                      >
                        {e.label} · {name(e.source)} / {name(e.target)} ×
                      </button>
                    )
                  );
                })}
              </div>
            </>
          ) : (
            <div className="kg-relationship-edit-concepts">
              {[
                [source, setSource, "First concept"],
                [target, setTarget, "Second concept"],
              ].map(([value, setter, title]) => (
                <label key={title as string}>
                  {title as string}
                  <select
                    aria-label={title as string}
                    value={value as string}
                    disabled={locked}
                    onChange={(e) =>
                      change(() =>
                        (setter as (s: string) => void)(e.target.value),
                      )
                    }
                  >
                    <option value="">Choose concept</option>
                    {graph.concepts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          )}
          {operation !== "remove" && (
            <>
              <label>
                {operation === "add"
                  ? "New relationship name"
                  : "Resulting relationship name"}
                <input
                  aria-label="Resulting relationship name"
                  value={label}
                  maxLength={64}
                  disabled={locked}
                  placeholder="UPPER_SNAKE_CASE"
                  onChange={(e) =>
                    change(() =>
                      setLabel(
                        e.target.value.toUpperCase().replace(/\s+/g, "_"),
                      ),
                    )
                  }
                />
              </label>
              <label>
                Meaning / definition
                <textarea
                  aria-label="Relationship definition"
                  maxLength={1200}
                  value={definition}
                  disabled={locked}
                  placeholder="Describe the relationship between these concepts"
                  onChange={(e) => change(() => setDefinition(e.target.value))}
                />
              </label>
            </>
          )}
          <p className="kg-visual-preview-hint">
            {operation === "remove"
              ? "Remove excludes these connections from current Integration outputs and KG queries. Original inference and evidence remain stored."
              : operation === "merge"
                ? "Merge connections between the same concept pair. Other concept pairs using these labels remain unchanged."
                : operation === "add"
                  ? "Add an undirected schema type and make its vocabulary available to Integration. No records or evidence are invented."
                  : "Rename this concept-pair connection or reclassify it with an evidence-supported label. Other connections using the original label stay unchanged."}
          </p>
          <button
            className="kg-primary"
            disabled={locked || !ready}
            onClick={() => void action()}
          >
            Preview relationship edit
          </button>
          {notice && <p role="status">{notice}</p>}
          {error && <p role="alert">{error}</p>}
          </div>
          {graphView&&!editingEnabled&&<p className="kg-visual-preview-hint">Explore the schema freely. Enable graph editing to rename, merge, add or remove relationships.</p>}
        </div>
        {graphView&&<div className="kg-schema-edit-center">{graphView(controlsHost,enabled=>{setEditingEnabled(enabled);if(!enabled)setPreview(undefined);})}</div>}
        <div className="kg-relationship-edit-impact" aria-label="Relationship impact preview">
          {preview ? (
            <>
              <h4>{preview.rows} row contributions affected</h4>
              <p>{preview.notice}</p>
              {preview.counts.map((c) => (
                <div className="kg-history-item" key={c.run}>
                  <strong>{c.title}</strong>
                  <span>{c.rows} rows</span>
                </div>
              ))}
              {preview.examples.map((e, i) => (
                <article key={i}>
                  <strong>
                    {e.left.label} — {e.relationship} — {e.right.label}
                  </strong>
                  <small>
                    {e.run_title} · {e.left.source} / {e.right.source}
                  </small>
                  {e.evidence.slice(0, 2).map((p, j) => (
                    <blockquote key={j}>
                      {p.context_text || p.text || "Evidence unavailable"}
                    </blockquote>
                  ))}
                </article>
              ))}
              <button
                className="kg-primary"
                disabled={locked}
                onClick={() => void action(true)}
              >
                Apply to Integration &amp; KG
              </button>
            </>
          ) : (
            <>
              <h4>Review the impact first</h4>
              <p>
                Preview lists the affected runs, row counts and original
                evidence. Nothing changes until you apply the edit.
              </p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
