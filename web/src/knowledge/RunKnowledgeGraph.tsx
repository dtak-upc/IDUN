import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import cytoscape, { type Core } from "cytoscape";
import { api } from "../storage/api";
import { KnowledgeGraph as Preview } from "./KnowledgeGraph";
import { ConceptReview, type Mapping } from "./ConceptReview";
import "./knowledge.css";

type Schema = {
  id: string;
  label: string;
  columns?: string[];
  source?: string;
  target?: string;
  direction?: string;
  count?: number;
  members?: string[];
  property_id?: string;
  attributes?: { name: string; datatype: string }[];
};
type Snapshot = {
  id: string;
  run_id: string;
  revision: string;
  title: string;
  model: unknown;
  recorded_at: number;
  assertion_count: number;
  record_count: number;
  classes: Schema[];
  properties: Schema[];
  skipped_rows: number;
  excluded_decisions: number;
  update_available?: boolean;
  schema_review?: string;
};
type RecordNode = {
  id: string;
  source: string;
  row: number;
  label: string;
  concept_label?: string;
  columns: string[];
  cells: unknown[];
};
type Assertion = {
  id: string;
  relation: string;
  direction: string;
  review: string;
  endpoint_checks?: { reference: string; quote: string; status: string }[];
  subject: RecordNode;
  object: RecordNode;
  document: string;
  evidence: Array<{
    text?: string;
    context_text?: string;
    start?: number;
    end?: number;
    text_version?: string;
  }>;
};
type Overview = {
  runs: Array<{
    id: string;
    title: string;
    model: unknown;
    revision: string;
    supported: boolean;
  }>;
  snapshots: Snapshot[];
  current: string | null;
  job: null | { id: string; status: string; phase: string; snapshot?: string };
};
type Page = {
  snapshot: Snapshot;
  items: Assertion[];
  total: number;
  offset: number;
  limit: number;
};
const modelName = (v: unknown) =>
  typeof v === "string"
    ? v
    : v && typeof v === "object"
      ? String(
          (v as Record<string, unknown>).model ||
            (v as Record<string, unknown>).name ||
            "Saved model",
        )
      : "Saved model";

export function KnowledgeGraph({
  lakeId,
  lakeName,
}: {
  lakeId: string;
  lakeName: string;
}) {
  const [overview, setOverview] = useState<Overview>();
  const [error, setError] = useState("");
  const [run, setRun] = useState("");
  const chosenRun = useRef("");
  const [snapshot, setSnapshot] = useState(
    () => sessionStorage.getItem(`idun.kg.real.${lakeId}`) || "",
  );
  const [page, setPage] = useState<Page>();
  const [offset, setOffset] = useState(0);
  const [edge, setEdge] = useState("");
  const [selected, setSelected] = useState<Assertion>();
  const [step, setStep] = useState(() =>
    sessionStorage.getItem(`idun.kg.real.step.${lakeId}`) === "Schema"
      ? "Schema"
      : "Layers",
  );
  useEffect(() => {
    sessionStorage.setItem(`idun.kg.real.step.${lakeId}`, step);
  }, [lakeId, step]);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(false);
  const [provenance, setProvenance] = useState(false);
  const [reviewSchema, setReviewSchema] = useState(false);
  const [conceptFocus, setConceptFocus] = useState("");
  const [expandedConcepts, setExpandedConcepts] = useState<string[]>([]);
  const [draftPreview, setDraftPreview] = useState<{
    snapshot: string;
    mappings: Mapping[];
  }>();
  const previewMappings = useCallback(
    (mappings: Mapping[]) => setDraftPreview({ snapshot, mappings }),
    [snapshot],
  );
  const [refresh, setRefresh] = useState(0);
  const followBuild = useRef(false);
  const host = useRef<HTMLDivElement>(null);
  const graph = useRef<Core | undefined>(undefined);
  const send = <T,>(path: string, body: unknown = {}) =>
    api<T>(
      path,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
      lakeId,
    );
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const data = await api<Overview>("/knowledge", undefined, lakeId);
        if (!active) return;
        setOverview(data);
        if (!data.runs.some((r) => r.id === chosenRun.current))
          chosenRun.current =
            data.snapshots.find((s) => s.id === snapshot)?.run_id ||
            data.runs[0]?.id ||
            "";
        setRun(chosenRun.current);
        if (
          followBuild.current &&
          data.job?.status === "completed" &&
          data.job.snapshot
        ) {
          setSnapshot(data.job.snapshot);
          setOffset(0);
          setEdge("");
          setStep("Schema");
          followBuild.current = false;
        } else
          setSnapshot((v) =>
            data.snapshots.some(
              (s) => s.id === v && s.run_id === chosenRun.current,
            )
              ? v
              : data.snapshots.find((s) => s.run_id === chosenRun.current)
                  ?.id || "",
          );
        if (data.job?.status === "running") timer = setTimeout(poll, 750);
      } catch (e) {
        if (active) setError(String(e));
      }
    };
    void poll();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [lakeId, refresh]);
  useEffect(() => {
    sessionStorage.setItem(`idun.kg.real.${lakeId}`, snapshot);
    setPage(undefined);
    setSelected(undefined);
    let active = true;
    if (snapshot)
      api<Page>(
        `/knowledge/snapshots/${snapshot}?offset=${offset}&edge=${encodeURIComponent(edge)}`,
        undefined,
        lakeId,
      )
        .then((p) => {
          if (active) setPage(p);
        })
        .catch((e) => {
          if (active) setError(String(e));
        });
    return () => {
      active = false;
    };
  }, [lakeId, snapshot, offset, edge, refresh]);
  const schema =
    page?.snapshot || overview?.snapshots.find((s) => s.id === snapshot);
  const conceptual = schema?.schema_review === "accepted";
  useEffect(() => {
    let active = true;
    if (snapshot && !conceptual)
      api<{ mappings: Mapping[] }>(
        `/knowledge/snapshots/${snapshot}/schema`,
        undefined,
        lakeId,
      )
        .then((d) => {
          if (active) setDraftPreview({ snapshot, mappings: d.mappings });
        })
        .catch((e) => {
          if (active) setError(String(e));
        });
    return () => {
      active = false;
    };
  }, [snapshot, conceptual, lakeId]);
  const graphSchema = useMemo(() => {
    if (!schema || conceptual || provenance) return schema;
    if (draftPreview?.snapshot !== snapshot) return undefined;
    const mappings = new Map(
      draftPreview.mappings.map((m) => [m.source_class, m]),
    );
    const classes = schema.classes.map((c) => {
      const m = mappings.get(c.id);
      return {
        ...c,
        label: m?.concept || "Unclassified concept",
        attributes: m?.attributes
          .filter((a) => a.included)
          .map((a) => ({ name: a.name, datatype: a.datatype })),
      };
    });
    return { ...schema, classes };
  }, [schema, conceptual, provenance, draftPreview, snapshot]);
  const graphContent = JSON.stringify(graphSchema?.classes);
  const showGraph = Boolean(graphSchema);
  useEffect(() => {
    if (!host.current || !graphSchema || preview || !showGraph) return;
    const schema = graphSchema;
    const dark = document.documentElement.getAttribute("data-theme") === "dark";
    let positions: Record<string, { x: number; y: number }> = {};
    try {
      positions = JSON.parse(
        sessionStorage.getItem(`idun.kg.positions.${lakeId}.${schema.id}`) ||
          "{}",
      );
    } catch {
      /* optional layout */
    }
    const cy = cytoscape({
      container: host.current,
      elements: [
        ...schema.classes.map((c, i) => ({
          data: {
            id: c.id,
            label:
              c.label +
              (schema.classes.filter((other) => other.label === c.label)
                .length > 1
                ? `\nSource group ${i + 1}`
                : ""),
            height: 65,
            kind: "concept",
          },
          position: positions[c.id] || {
            x: 140 + (i % 3) * 400,
            y: 120 + Math.floor(i / 3) * 240,
          },
        })),
        ...schema.properties.map((p) => {
          const loops = schema.properties.filter(
            (e) => e.source === p.source && e.target === p.source,
          );
          return {
            data: {
              ...p,
              loopAngle: `${
                -90 +
                (Math.max(
                  0,
                  loops.findIndex((e) => e.id === p.id),
                ) *
                  360) /
                  Math.max(1, loops.length)
              }deg`,
            },
          };
        }),
      ],
      layout: { name: "preset" },
      style: [
        {
          selector: "node",
          style: {
            label: "data(label)",
            "background-color": dark ? "#283855" : "#edf1ff",
            "border-color": "#829de3",
            "border-width": 1.5,
            color: dark ? "#e0e7ff" : "#263c69",
            "font-size": 12,
            "text-wrap": "wrap",
            "text-max-width": "180px",
            width: 200,
            height: "data(height)",
            shape: "round-rectangle",
            "text-valign": "center",
          },
        },
        {
          selector: "edge",
          style: {
            label: "data(label)",
            width: 2,
            "line-color": "#aa86b5",
            "target-arrow-color": "#aa86b5",
            "target-arrow-shape": "triangle",
            "curve-style": "bezier",
            "control-point-step-size": 85,
            "loop-direction": "data(loopAngle)",
            "loop-sweep": "50deg",
            "text-wrap": "wrap",
            "text-max-width": "140px",
            "font-size": 10,
            color: dark ? "#eee" : "#68496e",
            "text-background-color": dark ? "#111c2e" : "#fff",
            "text-background-opacity": 0.9,
            "text-background-padding": "3px",
          },
        },
        {
          selector: 'edge[direction="unspecified"]',
          style: { "target-arrow-shape": "none", "line-style": "dashed" },
        },
        {
          selector: 'edge[direction="bidirectional"]',
          style: {
            "source-arrow-shape": "triangle",
            "source-arrow-color": "#aa86b5",
          },
        },
        { selector: ".muted", style: { opacity: 0.18 } },
        {
          selector: 'node[kind="attribute"]',
          style: {
            shape: "ellipse",
            width: 135,
            height: 48,
            "font-size": 11,
            "border-color": "#b1bc82",
            "background-color": dark ? "#334032" : "#f3f6e8",
            "text-max-width": "120px",
          },
        },
        {
          selector: 'edge[kind="attribute"]',
          style: {
            label: "",
            "target-arrow-shape": "none",
            "line-style": "dashed",
            "line-color": "#a3ad81",
            width: 1,
          },
        },
        {
          selector: ":selected",
          style: {
            "border-color": "#4868ef",
            "border-width": 3,
            "line-color": "#4868ef",
          },
        },
      ],
    });
    graph.current = cy;
    setExpandedConcepts([]);
    cy.on("dragfree", "node", () => {
      const saved = Object.fromEntries(
        cy.nodes().map((n) => [n.id(), n.position()]),
      );
      sessionStorage.setItem(
        `idun.kg.positions.${lakeId}.${schema.id}`,
        JSON.stringify(saved),
      );
    });
    const theme = new MutationObserver(() => {
      const isDark = document.documentElement.dataset.theme === "dark";
      cy.style()
        .selector("node")
        .style({
          "background-color": isDark ? "#283855" : "#edf1ff",
          color: isDark ? "#e0e7ff" : "#263c69",
        })
        .selector("edge")
        .style({
          color: isDark ? "#eee" : "#68496e",
          "text-background-color": isDark ? "#111c2e" : "#fff",
        })
        .update();
    });
    theme.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    cy.on("tap", "edge", (e) => {
      if (e.target.data("kind") === "attribute") return;
      setOffset(0);
      setEdge((e.target.data("members") || [e.target.id()]).join(","));
    });
    cy.on("tap", "node", (e) => {
      if (e.target.data("kind") === "attribute") return;
      setConceptFocus(e.target.id());
      const concept = schema.classes.find((c) => c.id === e.target.id());
      const children = cy
        .nodes()
        .filter((n) => n.data("owner") === e.target.id());
      if (children.length) children.remove();
      else {
        const center = e.target.position();
        const attributes = concept?.attributes || [];
        attributes.forEach((a, i) => {
          const angle =
            -Math.PI / 2 + (2 * Math.PI * i) / Math.max(1, attributes.length);
          const radius = Math.max(
            190,
            (attributes.length * 155) / (2 * Math.PI),
          );
          const id = `attribute:${concept!.id}:${i}`;
          cy.add([
            {
              group: "nodes",
              data: {
                id,
                label: `${a.name}\n${a.datatype}`,
                height: 48,
                kind: "attribute",
                owner: concept!.id,
              },
              position: {
                x: center.x + Math.cos(angle) * radius,
                y: center.y + Math.sin(angle) * radius,
              },
            },
            {
              group: "edges",
              data: {
                id: id + ":edge",
                source: concept!.id,
                target: id,
                kind: "attribute",
              },
            },
          ]);
        });
      }
      cy.elements().removeClass("muted");
      cy.elements().difference(e.target.closedNeighborhood()).addClass("muted");
      setExpandedConcepts(
        cy
          .nodes()
          .filter((n) => n.data("kind") === "attribute")
          .map((n) => n.data("owner")),
      );
      if (!children.length) {
        cy.fit(undefined, 45);
        if (cy.zoom() > 1.2) cy.zoom(1.2);
      }
    });
    const resize = new ResizeObserver(() => cy.resize());
    resize.observe(host.current);
    cy.fit(undefined, 45);
    if (cy.zoom() > 1.2) cy.zoom(1.2);
    return () => {
      resize.disconnect();
      theme.disconnect();
      cy.destroy();
      graph.current = undefined;
    };
  }, [schema?.id, preview, showGraph, graphContent]);
  useEffect(() => {
    const cy = graph.current;
    if (!cy) return;
    cy.elements().removeClass("muted");
    if (edge) {
      const member = edge.split(",")[0];
      const focus = cy.getElementById(member);
      cy.elements()
        .difference(focus.union(focus.connectedNodes()))
        .addClass("muted");
    }
  }, [edge, page]);
  async function action(path: string, body: unknown = {}) {
    setBusy(true);
    setError("");
    try {
      await send(path, body);
      if (path === "/knowledge/build") followBuild.current = true;
      setRefresh((v) => v + 1);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  const running = overview?.job?.status === "running";
  if (preview)
    return (
      <>
        <button onClick={() => setPreview(false)}>
          Back to saved run graphs
        </button>
        <Preview lakeId={lakeId} lakeName={lakeName} />
      </>
    );
  return (
    <section className="kg">
      <header className="kg-heading">
        <div>
          <span className="kg-eyebrow">KNOWLEDGE GRAPH · {lakeName}</span>
          <h1>
            From integrated records. <em>To connected knowledge.</em>
          </h1>
          <p>
            Build a schema view from a saved Integration run, then follow each
            relationship to its records and evidence.
          </p>
        </div>
        <button onClick={() => setPreview(true)}>
          Explore synthetic preview
        </button>
      </header>
      <nav className="kg-steps kg-run-steps" aria-label="Knowledge Graph steps">
        {["Layers", "Schema"].map((s, i) => (
          <button
            key={s}
            aria-current={step === s ? "step" : undefined}
            aria-selected={step === s}
            disabled={i > 1}
            onClick={() => setStep(s)}
          >
            <span>0{i + 1}</span>
            <div>
              {i === 0 ? "Choose a run" : "Review & publish"}
              <small>
                {
                  [
                    "Select Integration results and prepare the graph",
                    "Explore concepts, review mappings, then publish",
                    "Reviewed mappings · upcoming",
                    "Graph traversal · upcoming",
                  ][i]
                }
              </small>
            </div>
          </button>
        ))}
      </nav>
      <p className="kg-flow-guide">
        {conceptual
          ? "Published graph. Click a concept to expand its attributes; select a relationship to inspect the supporting records."
          : "Choose an Integration run → Prepare graph → Review concepts & publish. Click any concept to show or hide its attribute nodes."}
      </p>
      {error && (
        <div role="alert" className="kg-real-notice">
          {error}
          <button
            onClick={() => {
              setError("");
              setRefresh((v) => v + 1);
            }}
          >
            Retry
          </button>
        </div>
      )}
      {!overview && !error && (
        <p role="status">Loading saved Integration runs…</p>
      )}
      <div className="kg-layout">
        <aside className="kg-real-panel">
          <h3>{step === "Layers" ? "01 / Build a run layer" : "Run layer"}</h3>
          <label>
            Integration run
            <select
              aria-label="Integration run"
              value={run}
              onChange={(e) => {
                chosenRun.current = e.target.value;
                setRun(e.target.value);
                setSnapshot(
                  overview?.snapshots.find((s) => s.run_id === e.target.value)
                    ?.id || "",
                );
                setEdge("");
                setOffset(0);
                setConceptFocus("");
              }}
            >
              <option value="">Choose a run</option>
              {overview?.runs.map((r) => (
                <option key={r.id} value={r.id} disabled={!r.supported}>
                  {r.title}
                  {r.supported ? "" : " · unsupported version"}
                </option>
              ))}
            </select>
          </label>
          <p>{modelName(overview?.runs.find((r) => r.id === run)?.model)}</p>
          {!overview?.runs.length && (
            <p>
              Save an Integration run first. Graph construction uses its
              recorded output without rerunning inference.
            </p>
          )}
          <button
            className="kg-primary"
            disabled={!run || busy || running}
            onClick={() => {
              const r = overview?.runs.find((r) => r.id === run);
              if (r)
                void action("/knowledge/build", {
                  run_id: r.id,
                  revision: r.revision,
                  expected_parent: overview?.current,
                });
            }}
          >
            Prepare graph
          </button>
          {overview?.job && <p role="status">{overview.job.phase}</p>}
          {running && (
            <button onClick={() => void action("/knowledge/cancel")}>
              Cancel build
            </button>
          )}
          <h3>Published snapshots</h3>
          {overview?.snapshots.map((s) => (
            <div className="kg-real-snapshot" key={s.id}>
              <button
                aria-pressed={snapshot === s.id}
                onClick={() => {
                  chosenRun.current = s.run_id;
                  setRun(s.run_id);
                  setSnapshot(s.id);
                  setOffset(0);
                  setEdge("");
                  setError("");
                }}
              >
                {s.title}
                <small>
                  {modelName(s.model)} ·{" "}
                  {new Date(s.recorded_at * 1000).toLocaleString()}
                </small>
              </button>
              {s.update_available && (
                <p>
                  Source run changed or unavailable. This snapshot stays pinned.
                </p>
              )}
              <button
                disabled={running || busy}
                aria-label={`Remove snapshot ${s.title}`}
                onClick={() => {
                  if (
                    window.confirm(
                      "Remove this graph snapshot? Source data and Integration runs are kept.",
                    )
                  )
                    void action(`/knowledge/snapshots/${s.id}/remove`);
                }}
              >
                Remove
              </button>
            </div>
          ))}
        </aside>
        <section className="kg-canvas-panel">
          <div className="kg-canvas-toolbar">
            <div>
              <b>
                {conceptual
                  ? "Conceptual schema"
                  : provenance
                    ? "Source provenance"
                    : "Conceptual schema"}
              </b>
              <span>
                {conceptual
                  ? "Reviewed concepts & attributes · saved relationships"
                  : provenance
                    ? "Source tables · provenance only"
                    : "Draft concept graph · review before publishing"}
              </span>
              {schema && (
                <span>
                  Run: {schema.title} ·{" "}
                  {new Set(schema.properties.map((p) => p.label)).size}{" "}
                  relationship types · {graphSchema?.properties.length || 0}{" "}
                  schema connections
                </span>
              )}
            </div>
            <div>
              <button
                aria-label="Zoom in"
                onClick={() => graph.current?.zoom(graph.current.zoom() * 1.25)}
              >
                +
              </button>
              <button
                aria-label="Zoom out"
                onClick={() => graph.current?.zoom(graph.current.zoom() / 1.25)}
              >
                −
              </button>
              <button onClick={() => graph.current?.fit(undefined, 45)}>
                Fit
              </button>
              <button
                onClick={() => {
                  setEdge("");
                  setOffset(0);
                  graph.current?.elements().removeClass("muted");
                }}
              >
                Clear focus
              </button>
            </div>
          </div>
          {schema && showGraph ? (
            <>
              <div
                ref={host}
                className="kg-real-canvas"
                aria-label="Integration schema graph"
              />
              <div className="kg-real-edges">
                {!conceptual && !provenance && (
                  <p>
                    Repeated names are separate source classes until you
                    explicitly approve grouping in the schema review.
                  </p>
                )}
                {graphSchema?.properties.some((p) => p.source === p.target) && (
                  <p>
                    Same-concept relationships are present. Select their edges
                    to check the saved records and evidence; concept grouping
                    does not correct Integration results.
                  </p>
                )}
                {graphSchema?.classes.map((c) => (
                  <button
                    key={c.id}
                    aria-label={`Expand attributes for ${c.label}`}
                    aria-expanded={expandedConcepts.includes(c.id)}
                    onClick={() =>
                      graph.current?.getElementById(c.id).emit("tap")
                    }
                  >
                    {c.label} · {c.attributes?.length || 0} attributes
                  </button>
                ))}
              </div>
              <section
                className="kg-relationship-inventory"
                aria-label="All run relationships"
              >
                <header>
                  <strong>
                    All relationships · {graphSchema?.properties.length || 0}{" "}
                    connections
                  </strong>
                  <button
                    onClick={() => {
                      setEdge("");
                      setOffset(0);
                      setConceptFocus("");
                      graph.current?.elements().removeClass("muted");
                      graph.current?.fit(undefined, 45);
                    }}
                  >
                    Show all relationships
                  </button>
                </header>
                <p>
                  {edge
                    ? "Evidence is filtered to the selected connection. The full relationship list remains below."
                    : "Every connection in this snapshot is listed below, including same-concept links."}
                </p>
                <div className="kg-relationship-items">
                  {graphSchema?.properties.map((p) => (
                    <button
                      key={p.id}
                      aria-pressed={edge === (p.members || [p.id]).join(",")}
                      onClick={() => {
                        setEdge((p.members || [p.id]).join(","));
                        setOffset(0);
                        const connection = graph.current?.getElementById(p.id);
                        if (connection?.length)
                          graph.current?.fit(
                            connection.union(connection.connectedNodes()),
                            80,
                          );
                      }}
                    >
                      <strong>
                        {p.label} · {p.count}
                      </strong>
                      <small>
                        {
                          graphSchema.classes.find((c) => c.id === p.source)
                            ?.label
                        }{" "}
                        {p.direction === "directed"
                          ? "→"
                          : p.direction === "bidirectional"
                            ? "↔"
                            : "—"}{" "}
                        {
                          graphSchema.classes.find((c) => c.id === p.target)
                            ?.label
                        }
                      </small>
                    </button>
                  ))}
                </div>
              </section>
            </>
          ) : (
            <div className="kg-real-empty">
              <h2>
                {schema
                  ? "Give the connected records a shared vocabulary."
                  : "Your integrated graph starts here."}
              </h2>
              <p>
                {schema
                  ? "Review concept names, attribute mappings and example values before publishing the conceptual schema."
                  : "Select an Integration run and build its first snapshot."}
              </p>
              {schema && (
                <button
                  className="kg-primary"
                  onClick={() => {
                    setStep("Schema");
                    setReviewSchema(true);
                  }}
                >
                  Review concepts & attributes
                </button>
              )}
            </div>
          )}
        </section>
        <aside className="kg-real-panel">
          <h3>Snapshot at a glance</h3>
          {schema ? (
            <>
              <div className="kg-real-metrics">
                <b>
                  {graphSchema?.classes.length || schema.classes.length}
                  <small>
                    {conceptual ? "Reviewed concepts" : "Draft concepts"}
                  </small>
                </b>
                <b>
                  {schema.record_count}
                  <small>Distinct source records</small>
                </b>
                <b>
                  {schema.assertion_count}
                  <small>Proposed assertions</small>
                </b>
              </div>
              <p>
                {schema.excluded_decisions} excluded decisions ·{" "}
                {schema.skipped_rows} rows without two valid record references.
              </p>
              <p>
                Arrows preserve the saved direction. Dashed edges have
                unspecified direction.
              </p>
              <p>
                Recorded {new Date(schema.recorded_at * 1000).toLocaleString()}.
                Source-valid dates are unknown; run dates are not fact dates.
              </p>
              <button
                onClick={() => {
                  setStep("Schema");
                  setReviewSchema(true);
                }}
              >
                Review concepts & publish
              </button>
              {conceptual && (
                <button
                  onClick={() => {
                    setStep("Schema");
                    setReviewSchema((v) => !v);
                  }}
                >
                  {reviewSchema
                    ? "Close mapping editor"
                    : "Edit concept mappings"}
                </button>
              )}
              {!conceptual && (
                <button onClick={() => setProvenance((v) => !v)}>
                  {provenance
                    ? "Hide source provenance"
                    : "Show source provenance"}
                </button>
              )}
              {graphSchema?.classes
                .filter((c) => c.id === conceptFocus)
                .map((c) => (
                  <section key={c.id}>
                    <h3>{c.label}</h3>
                    {c.attributes?.map((a, i) => (
                      <p key={i}>
                        <strong>{a.name}</strong> · {a.datatype}
                      </p>
                    ))}
                  </section>
                ))}
            </>
          ) : (
            <p>Statistics appear after an explicit build.</p>
          )}
        </aside>
      </div>
      {schema && step === "Schema" && reviewSchema && (
        <ConceptReview
          key={snapshot}
          onPreview={previewMappings}
          lakeId={lakeId}
          snapshot={snapshot}
          parent={overview?.current || null}
          job={overview?.job || undefined}
          onTask={() => setRefresh((v) => v + 1)}
          onPublished={(id) => {
            setSnapshot(id);
            setEdge("");
            setOffset(0);
            setReviewSchema(false);
            setProvenance(false);
            setRefresh((v) => v + 1);
          }}
        />
      )}
      {snapshot && (
        <section className="kg-real-panel kg-real-results">
          <div className="kg-canvas-toolbar">
            <div>
              <b>Relationships & evidence</b>
              <span>
                {page
                  ? `${page.total} assertions · Page ${Math.floor(offset / 25) + 1} of ${Math.max(1, Math.ceil(page.total / 25))}`
                  : "Loading snapshot…"}
              </span>
            </div>
            <div>
              <button
                disabled={!offset}
                onClick={() => setOffset((v) => Math.max(0, v - 25))}
              >
                Previous
              </button>
              <button
                disabled={!page || offset + 25 >= page.total}
                onClick={() => setOffset((v) => v + 25)}
              >
                Next
              </button>
            </div>
          </div>
          {page && !page.items.length && (
            <p>No supported binary relationships in this scope.</p>
          )}
          <div className="kg-real-list">
            {page?.items.map((a) => (
              <button
                key={a.id}
                aria-pressed={selected?.id === a.id}
                onClick={() => setSelected(a)}
              >
                <strong>
                  {a.subject.concept_label ||
                    a.subject.label ||
                    `Row ${a.subject.row}`}
                </strong>
                <span>
                  {a.relation} · {a.direction}
                </span>
                <strong>
                  {a.object.concept_label ||
                    a.object.label ||
                    `Row ${a.object.row}`}
                </strong>
                <small>
                  {a.document} · {a.review}
                  {a.endpoint_checks?.some((c) => c.status === "needs_review")
                    ? " · Check endpoint evidence"
                    : ""}
                </small>
              </button>
            ))}
          </div>
          {selected && (
            <article className="kg-real-evidence">
              <h3>
                {selected.relation}{" "}
                <button onClick={() => setSelected(undefined)}>
                  Close evidence
                </button>
              </h3>
              <div className="kg-real-records">
                {[selected.subject, selected.object].map((r, i) => (
                  <div key={i}>
                    <h4>
                      {r.source} · Row {r.row}
                    </h4>
                    <dl>
                      {r.columns.map((c, j) => (
                        <div key={j}>
                          <dt>{c}</dt>
                          <dd>{String(r.cells[j] ?? "Missing")}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                ))}
              </div>
              {!!selected.endpoint_checks?.length && (
                <section className="kg-real-notice">
                  <h4>Endpoint evidence check</h4>
                  <p>
                    This lexical check only flags quotes without a word match in
                    the corresponding projected record. Aliases may differ;
                    inspect the actual evidence before deciding.
                  </p>
                  {selected.endpoint_checks.map((c, i) => {
                    const record = [selected.subject, selected.object].find(
                      (r) =>
                        (r as RecordNode & { reference?: string }).reference ===
                        c.reference,
                    );
                    return (
                      <p key={i}>
                        <strong>
                          {record
                            ? `${record.source} · Row ${record.row}`
                            : "Source record"}
                        </strong>{" "}
                        — “{c.quote}” ·{" "}
                        {c.status === "needs_review"
                          ? "Needs review: no lexical overlap"
                          : "Lexical overlap found; not semantic validation"}
                      </p>
                    );
                  })}
                </section>
              )}
              <h4>Saved text evidence · {selected.document}</h4>
              {selected.evidence.map((e, i) => (
                <blockquote key={i}>
                  <small>
                    {e.text_version
                      ? "Versioned passage"
                      : "Source version unavailable"}{" "}
                    ·{" "}
                    {e.start === undefined
                      ? "Offsets unavailable"
                      : `Characters ${e.start}–${e.end} (end exclusive)`}
                  </small>
                  <p>{e.context_text || e.text || "Passage unavailable"}</p>
                </blockquote>
              ))}
              <p>
                {selected.review}. Records and passages are pinned to the saved
                Integration revision.
              </p>
            </article>
          )}
        </section>
      )}
    </section>
  );
}
