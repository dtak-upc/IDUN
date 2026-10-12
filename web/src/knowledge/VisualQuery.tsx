import { ValiditySummary, type Validity } from "./ValidityReview";
import {
  VisualQueryLibrary,
  downloadAnswers,
  type QueryRecipe,
} from "./VisualQueryLibrary";
import {
  CompareAttributes,
  comparisonFamily,
  type Comparison,
} from "./CompareAttributes";
import { GraphNavigation } from "./GraphNavigation";
import {
  insidePolygon,
  selectedChain,
  type PickedSchema,
} from "./schemaSelection";
import { useEffect, useRef, useState, type ReactNode } from "react";
import cytoscape, { type Core } from "cytoscape";
import type { PathAttribute } from "./PathStepCondition";
import {
  VisualConditions,
  conditionList,
  packConditions,
  type VisualCondition,
} from "./VisualConditions";
import {
  AttributeMatchExplanation,
  type AttributeCondition,
  type AttributeMatch,
} from "./AttributeQueryFilter";
type Edge = {
  id: string;
  label: string;
  source: string;
  target: string;
  direction: string;
};
export type Graph = {
  revision: string;
  concepts: { id: string; label: string }[];
  relationships: Edge[];
  attributes?: PathAttribute[];
};
type Step = {
  kind?: "assertion" | "identity";
  optional?: boolean;
  alternatives?: string[];
  parent?: number;
  target_binding?: number;
  relationship: string;
  direction: "outgoing" | "incoming";
  target: string;
  condition?: VisualCondition;
};
type Node = {
  id: string;
  concept_id: string;
  label: string;
  source: string;
  row: number;
};
type Preview = {
  token: string;
  start: string;
  branching?: boolean;
  constraints?: boolean;
  comparisons?: { left: string; right: string; operator: string }[];
  summary: {
    relationship: string;
    direction: string;
    target: string;
    parent?: number;
    target_binding?: number;
    source?: string;
  }[];
};
export type Witness = {
  shared_intervals?: { start: string; end: string }[];
  start: Node;
  record: Node;
  records?: Node[];
  start_attribute_matches?: AttributeMatch[];
  comparison_matches?: {
    index: number;
    operator: string;
    left: AttributeMatch & { record: string; role: string };
    right: AttributeMatch & { record: string; role: string };
  }[];
  steps: {
    source?: Node;
    parent?: number;
    target_binding?: number;
    id: string;
    edge?: string;
    relation: string;
    original_relationship?: string;
    pattern_direction?: string;
    direction?: string;
    relationship_mappings?: {
      id: string;
      kind: string;
      source_label: string;
      target_label: string;
    }[];
    target: Node;
    attribute_matches?: AttributeMatch[];
    kind?: string;
    explanation?: string;
    reviewed_key?: { attributes?: string[] };
    contributions?: {
      validity?: Validity;
      run_title: string;
      evidence: { text?: string; context_text?: string }[];
    }[];
  }[];
};
type Result = {
  items: Witness[];
  returned: number;
  examined: number;
  starts_scanned: number;
  starts_matched: number;
  truncated: boolean;
  stop: string | null;
  semantics: string;
  branching?: boolean;
  constraints?: boolean;
};
type Post = <T>(path: string, body: unknown) => Promise<T>;

function QueryCanvas({
  graph,
  start,
  steps,
  position,
  startAttributes,
  comparisonAttributes,
  witness,
  locked,
  onConcept,
  onEdge,
  onAttribute,
  onSelection,
  onPick,
  onReset,
}: {
  graph: Graph;
  start: string;
  steps: Step[];
  position: number;
  startAttributes?: string[];
  comparisonAttributes?: string[];
  witness?: Witness;
  locked: boolean;
  onConcept: (id: string) => void;
  onEdge: (id: string) => void;
  onAttribute: (id: string) => void;
  onSelection: (picked: PickedSchema, preferred: string) => boolean;
  onPick: (picks: PickedSchema) => void;
  onReset: () => void;
}) {
  const host = useRef<HTMLDivElement>(null),
    cy = useRef<Core | undefined>(undefined),
    panel = useRef<HTMLElement>(null),
    expandButton = useRef<HTMLButtonElement>(null),
    [wide, setWide] = useState(false);
  const [pickMode, setPickMode] = useState("Navigate"),
    [pickStart, setPickStart] = useState(""),
    [addPicks, setAddPicks] = useState(true),
    [picked, setPicked] = useState<PickedSchema>({
      concepts: [],
      relationships: [],
    }),
    [draw, setDraw] = useState<{ x: number; y: number }[]>([]);
  const drawing = useRef<{ x: number; y: number }[]>([]);
  function finishPick(points: { x: number; y: number }[]) {
    const g = cy.current;
    if (!g || points.length < 3) return;
    const concepts = g
      .nodes('[kind="concept"]')
      .filter((n) => insidePolygon(n.renderedPosition(), points))
      .map((n) => n.id());
    const nodes = new Set(concepts);
    const relationships = g
      .edges('[kind="relationship"]')
      .filter(
        (e) =>
          insidePolygon(e.renderedMidpoint(), points) ||
          (nodes.has(e.data("source")) && nodes.has(e.data("target"))),
      )
      .map((e) => e.id());
    const next = {
      concepts: [
        ...new Set([...(addPicks ? picked.concepts : []), ...concepts]),
      ],
      relationships: [
        ...new Set([
          ...(addPicks ? picked.relationships : []),
          ...relationships,
        ]),
      ],
    };
    setPicked(next);
    setPickStart("");
    onPick(next);
  }

  const picksRef = useRef(picked);
  picksRef.current = picked;
  function togglePick(field: "concepts" | "relationships", id: string) {
    const old = picksRef.current;
    const next = {
      ...old,
      explicitEdges: true,
      [field]: old[field].includes(id)
        ? old[field].filter((value) => value !== id)
        : [...old[field], id],
    };
    picksRef.current = next;
    setPicked(next);
    setPickStart("");
    onPick(next);
  }
  const callbacks = useRef({
    onConcept,
    onEdge,
    onAttribute,
    locked,
    pickMode,
    togglePick,
  });
  callbacks.current = {
    onConcept,
    onEdge,
    onAttribute,
    locked,
    pickMode,
    togglePick,
  };
  const focus = position < 0 ? start : steps[position]?.target,
    tip = steps.at(-1)?.target || start;
  useEffect(() => {
    if (!host.current) return;
    const g = cytoscape({
      container: host.current,
      elements: [
        ...graph.concepts.map((c, i) => ({
          data: { ...c, kind: "concept" },
          position: {
            x: 160 + (i % 3) * 320,
            y: 100 + Math.floor(i / 3) * 340,
          },
        })),
        ...graph.relationships.map((e, index) => {
          const sourceIndex = graph.concepts.findIndex(
            (c) => c.id === e.source,
          );
          const targetIndex = graph.concepts.findIndex(
            (c) => c.id === e.target,
          );
          // Route long horizontal connections around intervening concept nodes.
          const bend =
            Math.floor(sourceIndex / 3) === Math.floor(targetIndex / 3) &&
            Math.abs(sourceIndex - targetIndex) > 1;
          return {
            data: {
              ...e,
              kind: "relationship",
              ...(bend
                ? {
                    bend:
                      (sourceIndex < targetIndex ? 1 : -1) *
                      (110 +
                        55 *
                          graph.relationships
                            .slice(0, index)
                            .filter(
                              (other) =>
                                (other.source === e.source &&
                                  other.target === e.target) ||
                                (other.source === e.target &&
                                  other.target === e.source),
                            ).length),
                  }
                : {}),
            },
          };
        }),
      ],
      layout: { name: "preset" },
      minZoom: 0.15,
      maxZoom: 3,
      style: [
        {
          selector: "node",
          style: {
            label: "data(label)",
            shape: "round-rectangle",
            width: 150,
            height: 54,
            "background-color": "#4358d8",
            "border-color": "#263ea5",
            "border-width": 2,
            color: "#fff",
            "font-size": 14,
            "font-weight": 600,
            "text-valign": "center",
            "text-wrap": "wrap",
            "text-max-width": "140px",
          },
        },
        {
          selector: "edge",
          style: {
            label: "data(label)",
            "curve-style": "bezier",
            "control-point-step-size": 55,
            "line-color": "#8b5cf6",
            "target-arrow-color": "#8b5cf6",
            "target-arrow-shape": "none",
            "line-style": "dashed",
            width: 2,
            color: "#592caf",
            "font-size": 12,
            "text-background-color": "#fff",
            "text-background-opacity": 1,
            "text-background-padding": "4px",
            "text-events": "yes",
          },
        },
        {
          selector: "edge[bend]",
          style: {
            "curve-style": "unbundled-bezier",
            "control-point-distances": "data(bend)",
            "control-point-weights": 0.5,
          },
        },
        {
          selector: 'edge[direction="directed"]',
          style: { "target-arrow-shape": "triangle", "line-style": "solid" },
        },
        {
          selector: 'edge[direction="bidirectional"]',
          style: {
            "target-arrow-shape": "triangle",
            "source-arrow-shape": "triangle",
            "source-arrow-color": "#8b5cf6",
          },
        },
        { selector: ".muted", style: { opacity: 0.23 } },
        {
          selector: "edge.available",
          style: { width: 3, "line-color": "#7144df" },
        },
        {
          selector: "edge.chosen",
          style: {
            width: 4,
            "line-color": "#2563eb",
            "target-arrow-color": "#2563eb",
            color: "#1e40af",
          },
        },
        {
          selector: "node.chosen",
          style: { "border-color": "#f59e0b", "border-width": 4 },
        },
        {
          selector: "node.focus",
          style: {
            "background-color": "#2037b4",
            "border-color": "#22d3ee",
            "border-width": 4,
          },
        },
        {
          selector: 'node[kind="attribute"]',
          style: {
            shape: "ellipse",
            width: 130,
            height: 42,
            "background-color": "#ccfbf1",
            "border-color": "#0f766e",
            color: "#134e4a",
            "font-size": 12,
          },
        },
        {
          selector: 'edge[kind="attribute-link"]',
          style: {
            label: "",
            "line-color": "#0f766e",
            width: 1,
            "target-arrow-shape": "none",
          },
        },
        {
          selector: "node.condition",
          style: { "border-color": "#f59e0b", "border-width": 4 },
        },
        {
          selector: "edge.witness",
          style: {
            "line-color": "#059669",
            "target-arrow-color": "#059669",
            width: 5,
            color: "#065f46",
          },
        },
        {
          selector: "node.picked",
          style: { "border-color": "#f97316", "border-width": 5, opacity: 1 },
        },
        {
          selector: "edge.picked",
          style: {
            "line-color": "#f97316",
            "target-arrow-color": "#f97316",
            width: 5,
            opacity: 1,
          },
        },
      ],
    });
    cy.current = g;
    g.on("tap", 'node[kind="concept"]', (e) => {
      if (!callbacks.current.locked) {
        if (callbacks.current.pickMode === "Click")
          callbacks.current.togglePick("concepts", e.target.id());
        else callbacks.current.onConcept(e.target.id());
      }
    });
    g.on("tap", 'edge[kind="relationship"]', (e) => {
      if (!callbacks.current.locked) {
        if (callbacks.current.pickMode === "Click")
          callbacks.current.togglePick("relationships", e.target.id());
        else callbacks.current.onEdge(e.target.id());
      }
    });
    g.on("tap", 'node[kind="attribute"]', (e) => {
      if (!callbacks.current.locked && callbacks.current.pickMode !== "Click")
        callbacks.current.onAttribute(e.target.data("attribute"));
    });
    // Refresh hit-test coordinates without resetting a user's zoom or pan.
    const refreshViewport = () => g.resize();
    const container = host.current;
    container.addEventListener("pointerdown", refreshViewport, true);
    container.addEventListener("wheel", refreshViewport, true);
    const resize = new ResizeObserver(refreshViewport);
    resize.observe(host.current);
    g.fit(g.elements(), 50);
    return () => {
      resize.disconnect();
      container.removeEventListener("pointerdown", refreshViewport, true);
      container.removeEventListener("wheel", refreshViewport, true);
      g.destroy();
      cy.current = undefined;
    };
  }, [graph.revision]);
  useEffect(() => {
    // Clicking to pick should not accidentally drag a small, zoomed-out node.
    cy.current?.autoungrabify(pickMode === "Click");
  }, [pickMode, graph.revision]);
  useEffect(() => {
    const g = cy.current;
    if (!g) return;
    g.elements('[kind="attribute"], [kind="attribute-link"]').remove();
    g.elements().removeClass("chosen muted available focus condition witness");
    const selected = new Set(
        [start, ...steps.map((s) => s.target)].filter(Boolean),
      ),
      edges = new Set(steps.map((s) => s.relationship));
    g.nodes().forEach((n) => {
      if (selected.has(n.id())) n.addClass("chosen");
      if (n.id() === focus) n.addClass("focus");
      else if (
        start &&
        !selected.has(n.id()) &&
        !graph.relationships.some(
          (e) =>
            (e.source === tip && e.target === n.id()) ||
            (e.target === tip && e.source === n.id()),
        )
      )
        n.addClass("muted");
    });
    g.edges().forEach((e) => {
      if (edges.has(e.id())) e.addClass("chosen");
      else if (tip && (e.data("source") === tip || e.data("target") === tip))
        e.addClass("available");
      else if (start) e.addClass("muted");
    });
    const attrs = graph.attributes?.filter((a) => a.concept === focus) || [],
      center = g.getElementById(focus || "").position();
    if (center)
      attrs.forEach((a, i) => {
        const columns = attrs.length > 3 ? 2 : 1;
        g.add([
          {
            data: {
              id: "attr:" + a.id,
              label: a.name,
              kind: "attribute",
              attribute: a.id,
            },
            position: {
              x: center.x + (columns === 1 ? 0 : i % columns === 0 ? -72 : 72),
              y: center.y + 100 + Math.floor(i / columns) * 58,
            },
          },
          {
            data: {
              id: "attr-edge:" + a.id,
              source: focus,
              target: "attr:" + a.id,
              kind: "attribute-link",
            },
          },
        ]);
        if (
          (position < 0
            ? (startAttributes ?? [])
            : conditionList(steps[position]?.condition).map((c) => c.attribute)
          )
            .concat(comparisonAttributes ?? [])
            .includes(a.id)
        )
          g.getElementById("attr:" + a.id).addClass("condition");
      });
    if (witness)
      witness.steps.forEach((s) => {
        if (s.edge)
          g.getElementById(s.edge).removeClass("muted").addClass("witness");
        g.getElementById(s.target.concept_id)
          .removeClass("muted")
          .addClass("chosen");
      });
  }, [
    start,
    steps,
    position,
    focus,
    tip,
    witness,
    graph.attributes,
    startAttributes,
    comparisonAttributes,
  ]);
  useEffect(() => {
    const g = cy.current;
    if (!g) return;
    g.elements().removeClass("picked");
    if (!locked) {
      picked.concepts.forEach((id) => g.getElementById(id).addClass("picked"));
      picked.relationships.forEach((id) =>
        g.getElementById(id).addClass("picked"),
      );
    }
  }, [picked, steps, position, start, locked]);
  useEffect(() => {
    if (!wide) return;
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") setWide(false);
      if (e.key === "Tab") {
        const controls = [
          ...(panel.current?.querySelectorAll<HTMLElement>(
            'button:not(:disabled),[tabindex="0"]',
          ) || []),
        ];
        const first = controls[0],
          last = controls.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = before;
      document.removeEventListener("keydown", key);
      expandButton.current?.focus();
    };
  }, [wide]);
  return (
    <section
      ref={panel}
      className={"kg-visual-canvas" + (wide ? " is-wide" : "")}
      role={wide ? "dialog" : undefined}
      aria-modal={wide || undefined}
      aria-label="Visual query schema"
    >
      <header>
        <div>
          <strong>Your query on the schema</strong>
          <small>Blue: query path · orange: picks · green: answer path</small>
        </div>
        <GraphNavigation
          getGraph={() => cy.current}
          wide={wide}
          onToggle={() => setWide((v) => !v)}
          expandButton={expandButton}
          expandLabel="Full window"
          closeLabel="Close full window"
          zoomInLabel="Zoom visual schema in"
          zoomOutLabel="Zoom visual schema out"
        />
      </header>
      {!locked && (
        <div
          className="kg-visual-pick-bar"
          role="toolbar"
          aria-label="Graph selection tools"
        >
          <div className="kg-visual-pick-modes">
            {["Click", "Rectangle", "Lasso"].map((mode) => (
              <button
                key={mode}
                aria-label={mode + " pick"}
                aria-pressed={pickMode === mode}
                title={
                  pickMode === mode
                    ? "Turn off picking to navigate the graph"
                    : mode === "Click"
                      ? "Click concepts or relationships to pick/unpick; only clicked relationships enter the query"
                      : "Drag to pick; click again to return to navigation"
                }
                onClick={() => {
                  setPickMode((current) =>
                    current === mode ? "Navigate" : mode,
                  );
                  setDraw([]);
                  drawing.current = [];
                }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 20 20"
                  fill="none"
                  aria-hidden="true"
                >
                  {mode === "Click" ? (
                    <path
                      d="M5 2l10 9-6 1-2 6z"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinejoin="round"
                    />
                  ) : mode === "Rectangle" ? (
                    <rect
                      x="3"
                      y="4"
                      width="14"
                      height="12"
                      rx="2"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeDasharray="3 2"
                    />
                  ) : (
                    <path
                      d="M5 15C1 12 3 4 9 3c7-1 10 5 7 9-2 3-6 4-9 1-2-2-3-1-3 1s2 3 4 3"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    />
                  )}
                </svg>
                {mode}
              </button>
            ))}
          </div>
          <button
            className="kg-visual-retain"
            aria-pressed={addPicks}
            aria-label="Keep previous picks"
            disabled={pickMode === "Click"}
            title={
              addPicks
                ? "Each new region adds to your existing selection. Click to replace picks instead."
                : "Each new region replaces your selection. Click to keep previous picks instead."
            }
            onClick={() => setAddPicks((value) => !value)}
          >
            <span className="kg-visual-toggle" aria-hidden="true">
              <span />
            </span>
            {addPicks ? "Keep previous picks" : "Replace picks"}
          </button>
          <span
            className="kg-visual-pick-count"
            role="status"
            title="Picked concepts and relationships are highlighted in orange"
          >
            {picked.concepts.length}{" "}
            {picked.concepts.length === 1 ? "concept" : "concepts"} ·{" "}
            {picked.relationships.length}{" "}
            {picked.relationships.length === 1 ? "link" : "links"}
          </span>
          <select
            aria-label="Picked path start"
            title="Choose the start of your picked path"
            className="kg-visual-pick-start"
            value={pickStart}
            disabled={!picked.concepts.length && !picked.relationships.length}
            onChange={(e) => setPickStart(e.target.value)}
          >
            <option value="">Start: Auto</option>
            {graph.concepts
              .filter(
                (c) =>
                  picked.concepts.includes(c.id) ||
                  graph.relationships.some(
                    (e) =>
                      picked.relationships.includes(e.id) &&
                      (e.source === c.id || e.target === c.id),
                  ),
              )
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
          </select>
          <button
            className="kg-visual-apply-picks"
            aria-label="Use picks as query"
            disabled={!picked.concepts.length && !picked.relationships.length}
            onClick={() => {
              if (onSelection(picked, pickStart)) {
                setPickMode("Navigate");
                setPicked({ concepts: [], relationships: [] });
                setPickStart("");
              }
            }}
          >
            Use picks <span aria-hidden="true">→</span>
          </button>
          <button
            className="kg-visual-clear-picks"
            aria-label="Clear picks"
            title="Clear picks"
            disabled={!picked.concepts.length && !picked.relationships.length}
            onClick={() => {
              setPicked({ concepts: [], relationships: [] });
              setPickStart("");
              onPick({ concepts: [], relationships: [] });
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 20 20"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="m6 6 8 8M14 6l-8 8"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      )}
      <div className="kg-visual-drawing-area">
        <div ref={host} className="kg-visual-host" />
        {(pickMode === "Rectangle" || pickMode === "Lasso") && !locked && (
          <svg
            className="kg-visual-draw"
            aria-label={pickMode + " selection surface"}
            onPointerDown={(e) => {
              if (e.button !== 0) return;
              e.preventDefault();
              e.currentTarget.setPointerCapture(e.pointerId);
              const rect = e.currentTarget.getBoundingClientRect();
              drawing.current = [
                { x: e.clientX - rect.left, y: e.clientY - rect.top },
              ];
              setDraw(drawing.current);
            }}
            onPointerMove={(e) => {
              if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
              const rect = e.currentTarget.getBoundingClientRect(),
                p = { x: e.clientX - rect.left, y: e.clientY - rect.top },
                first = drawing.current[0];
              drawing.current =
                pickMode === "Rectangle" ? [first, p] : [...drawing.current, p];
              setDraw([...drawing.current]);
            }}
            onPointerUp={(e) => {
              if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
              e.currentTarget.releasePointerCapture(e.pointerId);
              const points = drawing.current;
              if (pickMode === "Rectangle" && points.length === 2) {
                const [a, b] = points;
                finishPick([a, { x: b.x, y: a.y }, b, { x: a.x, y: b.y }]);
              } else finishPick(points);
              drawing.current = [];
              setDraw([]);
            }}
            onPointerCancel={() => {
              drawing.current = [];
              setDraw([]);
            }}
          >
            {draw.length > 1 &&
              (pickMode === "Rectangle" ? (
                <rect
                  x={Math.min(draw[0].x, draw.at(-1)!.x)}
                  y={Math.min(draw[0].y, draw.at(-1)!.y)}
                  width={Math.abs(draw[0].x - draw.at(-1)!.x)}
                  height={Math.abs(draw[0].y - draw.at(-1)!.y)}
                />
              ) : (
                <polygon points={draw.map((p) => `${p.x},${p.y}`).join(" ")} />
              ))}
          </svg>
        )}
      </div>
      <footer>
        <span>
          {witness
            ? "Green edges show the original relationships used by this answer. Inspect the evidence below."
            : start
              ? "Click a purple connection to extend the path. Click a path concept to inspect its attributes."
              : "Click any concept to start your query."}
        </span>
        <button
          className="kg-query-reset"
          disabled={locked}
          onClick={() => {
            setPicked({ concepts: [], relationships: [] });
            setPickStart("");
            setPickMode("Navigate");
            setDraw([]);
            drawing.current = [];
            onReset();
          }}
        >
          <svg
            aria-hidden="true"
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 10a9 9 0 1 1 2.6 8.4M3 4v6h6" />
          </svg>
          Reset query
        </button>
      </footer>
    </section>
  );
}

export function VisualQuery({
  graph: incomingGraph,
  runs: incomingRuns,
  post,
  disabled,
  scopeSummary,
  onOpenAnswer,
  temporalQueries = false,
  onTemporalRecipe,
  initialRecipe,
}: {
  graph: Graph;
  runs: string[];
  post: Post;
  disabled: boolean;
  scopeSummary?: ReactNode;
  onOpenAnswer?: (witness: Witness) => void;
  temporalQueries?: boolean;
  onTemporalRecipe?: (
    recipe: QueryRecipe & { graph: unknown; runs: string[]; stale: boolean },
  ) => void;
  initialRecipe?: QueryRecipe & {
    graph: unknown;
    runs: string[];
    stale: boolean;
  };
}) {
  const [context, setContext] = useState<{
      graph: Graph;
      runs: string[];
      checkpoint?: string;
      title: string;
    }>(),
    [loaded, setLoaded] = useState<QueryRecipe>(),
    [contextNotice, setContextNotice] = useState(""),
    [checkpoints, setCheckpoints] = useState<
      { id: string; title: string; available: boolean }[]
    >([]),
    [viewOffset, setViewOffset] = useState(0),
    [viewTotal, setViewTotal] = useState(0),
    [roleLabels, setRoleLabels] = useState<Record<string, string>>({}),
    [viewPending, setViewPending] = useState(false);
  const contextGeneration = useRef(0);
  const graph = context?.graph ?? incomingGraph,
    runs = context?.runs ?? incomingRuns;
  useEffect(() => {
    contextGeneration.current++;
    setViewPending(false);
    setContext(undefined);
    setLoaded(undefined);
    setContextNotice("");
  }, [incomingGraph.revision, JSON.stringify(incomingRuns), post]);
  useEffect(() => {
    let alive = true;
    void post<{
      items: { id: string; title: string; available: boolean }[];
      total: number;
    }>("checkpoints", { offset: viewOffset })
      .then((r) => {
        if (alive) {
          setCheckpoints(r.items ?? []);
          setViewTotal(r.total ?? 0);
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [post, viewOffset]);
  const [start, setStart] = useState(""),
    [steps, setSteps] = useState<Step[]>([]),
    [position, setPosition] = useState(-1),
    [startCondition, setStartCondition] = useState<VisualCondition>(),
    [comparisons, setComparisons] = useState<Comparison[]>([]),
    [temporal, setTemporal] = useState<{
      mode: "at" | "overlap" | "simultaneous";
      start: string;
      end?: string;
    }>(),
    [mode, setMode] = useState("exact"),
    [limit, setLimit] = useState(20),
    [budget, setBudget] = useState(1000),
    [startLimit, setStartLimit] = useState(100),
    [preview, setPreview] = useState<Preview>(),
    [showPreview, setShowPreview] = useState(false),
    [result, setResult] = useState<Result>(),
    [selected, setSelected] = useState(0),
    [error, setError] = useState(""),
    [pending, setPending] = useState(false),
    [hasPicks, setHasPicks] = useState(false);
  const generation = useRef(0),
    request = useRef(""),
    scope = JSON.stringify(runs),
    locked = disabled || pending || viewPending;
  useEffect(() => {
    generation.current++;
    setHasPicks(false);
    setStart("");
    setSteps([]);
    setPosition(-1);
    setStartCondition(undefined);
    setComparisons([]);
    setRoleLabels({});
    setTemporal(undefined);
    setShowPreview(false);
    setPreview(undefined);
    setResult(undefined);
    setError("");
    setPending(false);
    return () => {
      generation.current++;
      if (request.current)
        void post("cancel-traversal", { request_id: request.current }).catch(
          () => {},
        );
      request.current = "";
    };
  }, [graph.revision, scope, post]);
  useEffect(() => {
    if (!loaded) return;
    const q = loaded.query;
    setTemporal(q.temporal as typeof temporal);
    setStart(q.concept as string);
    setSteps(q.pattern as Step[]);
    setPosition(-1);
    setStartCondition(q.start_condition as VisualCondition | undefined);
    setComparisons((q.comparisons as Comparison[]) ?? []);
    setMode((q.pattern_mode as string) ?? "exact");
    setRoleLabels((q.role_labels as Record<string, string>) ?? {});
    setLimit((q.limit as number) ?? 20);
    setBudget((q.budget as number) ?? 1000);
    setStartLimit((q.start_limit as number) ?? 100);
    setShowPreview(false);
    setPreview(undefined);
    setResult(undefined);
  }, [loaded, graph.revision, scope]);
  async function chooseView(id: string) {
    const g = ++contextGeneration.current;
    if (!id) {
      setContext(undefined);
      setLoaded(undefined);
      setContextNotice("");
      return;
    }
    setViewPending(true);
    try {
      const r = await post<{
        graph: Graph;
        runs: string[];
        checkpoint: { title: string };
      }>("visual-query-context", { checkpoint: id });
      if (g !== contextGeneration.current) return;
      setLoaded(undefined);
      setContext({
        graph: r.graph,
        runs: r.runs,
        checkpoint: id,
        title: r.checkpoint.title,
      });
      setContextNotice(
        "Captured assertions and original values only. Click answers to inspect their evidence here.",
      );
    } catch (e) {
      if (g === contextGeneration.current) setContextNotice(String(e));
    } finally {
      if (g === contextGeneration.current) setViewPending(false);
    }
  }
  useEffect(() => {
    if (!initialRecipe || !temporalQueries) return;
    setContext({
      graph: initialRecipe.graph as Graph,
      runs: initialRecipe.runs,
      checkpoint: initialRecipe.query.checkpoint as string | undefined,
      title: initialRecipe.title,
    });
    setLoaded(initialRecipe);
    setContextNotice(
      "Temporal query loaded. Review and preview before running.",
    );
  }, [initialRecipe, temporalQueries]);
  function edit(fn: () => void) {
    fn();
    generation.current++;
    setShowPreview(false);
    setPreview(undefined);
    setResult(undefined);
    setError("");
  }
  const name = (id: string) =>
      graph.concepts.find((c) => c.id === id)?.label || id,
    tip = steps.at(-1)?.target || start,
    branching = steps.some(
      (s, i) =>
        (s.parent !== undefined && s.parent !== i - 1) ||
        s.target_binding !== undefined,
    ),
    focus = position < 0 ? start : steps[position]?.target,
    condition = position < 0 ? startCondition : steps[position]?.condition;
  const available = graph.relationships.filter(
    (e) => tip && (e.source === tip || e.target === tip),
  );
  function concept(id: string) {
    if (!start)
      edit(() => {
        setStart(id);
        setPosition(-1);
      });
    else if (id === start) setPosition(-1);
    else {
      const i = steps.findIndex((s) => s.target === id);
      if (i >= 0) setPosition(i);
      else
        setError(
          "Use a connection from the current path endpoint, or reset to choose a different starting concept.",
        );
    }
  }
  function edge(id: string) {
    const e = available.find((e) => e.id === id);
    if (!e) {
      setError("Choose a relationship connected to the current path endpoint.");
      return;
    }
    edit(() => {
      setSteps([
        ...steps,
        {
          relationship: e.id,
          direction: e.source === tip ? "outgoing" : "incoming",
          target: e.source === tip ? e.target : e.source,
        },
      ]);
      setPosition(steps.length);
    });
  }
  function changeCondition(c?: VisualCondition) {
    edit(() => {
      if (position < 0) setStartCondition(c);
      else
        setSteps(
          steps.map((s, i) => (i === position ? { ...s, condition: c } : s)),
        );
    });
  }
  function attribute(id: string) {
    const all = conditionList(condition);
    // Clicking an already filtered attribute preserves its edited conditions.
    if (all.some((c) => c.attribute === id)) return;
    changeCondition(
      packConditions([
        ...all.filter((c) => c.attribute),
        {
          attribute: id,
          mode: "exact",
          operator: "present",
          value: "",
          values: "original",
        },
      ]),
    );
  }
  const invalidCondition = (c?: VisualCondition) =>
    conditionList(c).some(
      (c) =>
        !c.attribute ||
        (!["present", "missing"].includes(c.operator) && !c.value.trim()),
    );
  const roles = [
    {
      binding: -1,
      concept: start,
      label: roleLabels["-1"] || `Start · ${name(start)}`,
    },
    ...steps.map((s, i) => ({
      binding: i,
      concept: s.target,
      label: roleLabels[String(i)] || `Step ${i + 1} · ${name(s.target)}`,
    })),
  ].filter((r) => r.concept);
  const invalidComparisons = comparisons.some(
    (c) =>
      [c.left, c.right].some(
        (o) =>
          !roles.some(
            (r) =>
              r.binding === o.binding &&
              graph.attributes?.some(
                (a) => a.id === o.attribute && a.concept === r.concept,
              ),
          ),
      ) ||
      comparisonFamily(
        graph.attributes?.find((a) => a.id === c.left.attribute)?.datatype ??
          "",
      ) !==
        comparisonFamily(
          graph.attributes?.find((a) => a.id === c.right.attribute)?.datatype ??
            "",
        ),
  );
  const invalidTime =
    !!temporal &&
    (!temporal.start ||
      (temporal.mode !== "at" &&
        (!temporal.end || temporal.end <= temporal.start)) ||
      steps.some((s) => s.kind === "identity") ||
      (temporal.mode === "simultaneous" && steps.some((s) => s.optional)));
  const ready =
    !hasPicks &&
    !invalidComparisons &&
    !invalidTime &&
    runs.length > 0 &&
    !!start &&
    steps.length > 0 &&
    !invalidCondition(startCondition) &&
    !steps.some((s) => invalidCondition(s.condition));
  const canRun =
    ready &&
    !locked &&
    Number.isInteger(startLimit) &&
    startLimit >= 1 &&
    startLimit <= 1000 &&
    Number.isInteger(limit) &&
    limit >= 1 &&
    limit <= 100 &&
    Number.isInteger(budget) &&
    budget >= 10 &&
    budget <= 5000;
  const runAction = (
    <button
      className="kg-primary kg-query-run"
      disabled={!canRun}
      aria-busy={pending}
      aria-describedby="kg-visual-preview-hint"
      onClick={() => void run(true)}
    >
      Run query <span aria-hidden="true">→</span>
    </button>
  );
  const previewHint = pending
    ? "Checking or running your query…"
    : disabled
      ? "Wait for the graph update or active task to finish."
      : !runs.length
        ? "Choose an Integration run for your query scope."
        : hasPicks
          ? error ||
            "Selection ready. Click Use picks → to build the query, then Run query."
          : !start
            ? "Select a concept and a connected relationship, then click Use picks →; or click a concept to start a path."
            : !steps.length
              ? "Choose at least one relationship connected to your starting concept. A concept alone does not define a path query."
              : invalidCondition(startCondition) ||
                  steps.some((s) => invalidCondition(s.condition))
                ? "Complete the attribute condition values, or remove the incomplete conditions."
                : invalidTime
                  ? "Complete the validity dates and exclusive range end. Temporal queries use assertion steps; remove identity steps or turn off the time filter. Shared-time queries require required connections."
                  : invalidComparisons
                    ? "Choose compatible attributes and valid record roles for each comparison."
                    : `${steps.length} relationship ${steps.length === 1 ? "step" : "steps"} ready. Run your query to find matching records. You can inspect a preview first if you wish.`;
  const describe = (condition?: VisualCondition) =>
    conditionList(condition)
      .map(
        (c) =>
          `${graph.attributes?.find((a) => a.id === c.attribute)?.name ?? "attribute"} ${{ eq: "equals", contains: "contains", gte: "is at least", gt: "is greater than", lte: "is at most", lt: "is less than", present: "has a value", missing: "is null or blank" }[c.operator] ?? c.operator}${c.value ? " " + c.value : ""}`,
      )
      .join(" AND ");
  const base = {
    runs,
    revision: graph.revision,
    concept: start,
    pattern: steps,
    pattern_mode: mode,
    start_condition: startCondition,
    comparisons,
    temporal,
    role_labels: Object.fromEntries(
      Object.entries(roleLabels).filter(
        ([key]) => Number(key) >= -1 && Number(key) < steps.length,
      ),
    ),
    ...(context?.checkpoint ? { checkpoint: context.checkpoint } : {}),
  };
  async function run(execute: boolean) {
    const g = ++generation.current;
    setPending(true);
    setError("");
    setResult(undefined);
    request.current = execute ? crypto.randomUUID() : "";
    try {
      if (execute) {
        const checked = await post<Preview>("preview-visual-path", base);
        if (g !== generation.current) return;
        setPreview(checked);
        const data = await post<Result>("visual-path", {
          ...base,
          preview_token: checked.token,
          request_id: request.current,
          limit,
          budget,
          start_limit: startLimit,
        });
        if (g === generation.current) {
          setResult(data);
          setSelected(0);
        }
      } else {
        const data = await post<Preview>("preview-visual-path", base);
        if (g === generation.current) {
          setPreview(data);
          setShowPreview(true);
        }
      }
    } catch (e) {
      if (g === generation.current) setError(String(e));
    } finally {
      if (g === generation.current) {
        setPending(false);
        request.current = "";
      }
    }
  }
  const answersPanel = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!result || disabled) return;
    const id = requestAnimationFrame(() => {
      answersPanel.current?.focus({ preventScroll: true });
      answersPanel.current?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    });
    return () => cancelAnimationFrame(id);
  }, [result, disabled]);
  const witness = result?.items[selected];
  return (
    <section className="kg-visual-query" aria-label="Visual query">
      <div className="kg-visual-intro">
        <h3>
          {temporalQueries
            ? "Explore connections across time"
            : "Draw the question you want to ask"}
        </h3>
        <p>
          Choose connected concepts and relationships, then add optional
          attribute conditions. Required connections match together, including
          branches, cycles and parallel relationships.
        </p>
      </div>
      <div className="kg-query-view-controls kg-query-toolbar">
        {temporalQueries && (
          <>
            <label>
              Query data view
              <select
                aria-label="Visual query data view"
                value={context?.checkpoint ?? (context ? "recipe" : "")}
                disabled={locked}
                onChange={(e) => void chooseView(e.target.value)}
              >
                <option value="">Current selected runs</option>
                {context && !context.checkpoint && (
                  <option value="recipe" disabled>
                    Loaded query scope · {context.title}
                  </option>
                )}
                {checkpoints.map((c) => (
                  <option key={c.id} value={c.id} disabled={!c.available}>
                    {c.title}
                    {!c.available ? " · unavailable" : ""}
                  </option>
                ))}
              </select>
            </label>
            {viewTotal > 20 && (
              <>
                <button
                  disabled={!viewOffset || locked}
                  onClick={() => setViewOffset(Math.max(0, viewOffset - 20))}
                >
                  Previous views
                </button>
                <span>
                  Page {viewOffset / 20 + 1} / {Math.ceil(viewTotal / 20)}
                </span>
                <button
                  disabled={viewOffset + 20 >= viewTotal || locked}
                  onClick={() => setViewOffset(viewOffset + 20)}
                >
                  Next views
                </button>
              </>
            )}
            {context && (
              <button
                disabled={locked}
                onClick={() => {
                  setContext(undefined);
                  setLoaded(undefined);
                  setContextNotice("");
                }}
              >
                Return to current scope
              </button>
            )}
            <span role="status">{contextNotice}</span>
          </>
        )}
      </div>
      {error && (
        <p className="kg-visual-query-alert" role="alert">
          {error}
        </p>
      )}
      <div className="kg-visual-layout">
        <aside
          className="kg-visual-execute"
          aria-label="Preview and run visual query"
        >
          {context ? (
            <div className="kg-query-context">
              <strong>{context.title}</strong>
              <p>
                {runs.length} runs ·{" "}
                {context.checkpoint ? "Captured view" : "Loaded query scope"}
              </p>
            </div>
          ) : (
            scopeSummary
          )}
          <h4>Preview &amp; run</h4>
          {runAction}
          <p
            id="kg-visual-preview-hint"
            className="kg-visual-preview-hint"
            role="status"
          >
            {previewHint}
          </p>
          <button
            aria-describedby="kg-visual-preview-hint"
            disabled={locked || !ready}
            className="kg-query-preview-button"
            onClick={() => void run(false)}
          >
            Preview visual query
          </button>
          {preview && showPreview && (
            <section
              className="kg-traversal-status"
              aria-label="Visual query preview"
            >
              <div className="kg-auto-actions">
                <strong>Review your question</strong>
                <button onClick={() => setShowPreview(false)}>
                  Hide preview
                </button>
              </div>
              {temporal && (
                <p>
                  {temporal.mode === "at"
                    ? `All assertion connections valid on ${temporal.start}.`
                    : temporal.mode === "simultaneous"
                      ? `All assertion connections share a common interval within [${temporal.start}, ${temporal.end}).`
                      : `Each assertion connection overlaps [${temporal.start}, ${temporal.end}).`}{" "}
                  Unknown validity is excluded.
                </p>
              )}
              <p>
                Find {preview.start} records
                {startCondition
                  ? " where " + describe(startCondition)
                  : ""}.{" "}
                {preview.summary
                  .map(
                    (s, i) =>
                      `${preview.branching ? `From ${s.source}, match` : i ? "Then follow" : "Follow"} ${steps[i].optional ? "optional " : ""}${s.relationship}${s.direction === "incoming" && graph.relationships.find((e) => e.id === steps[i].relationship)?.direction === "directed" ? " backwards" : ""} to ${s.target}${s.target_binding !== undefined ? ` (same record as ${s.target_binding === -1 ? "the start" : `step ${s.target_binding + 1}`})` : ""}${steps[i].condition ? " where " + describe(steps[i].condition) : ""}.`,
                  )
                  .join(" ")}
              </p>
              {!!preview.comparisons?.length && (
                <ul className="kg-comparison-preview">
                  {preview.comparisons.map((c, i) => (
                    <li key={i}>
                      {c.left}{" "}
                      {
                        {
                          eq: "equals",
                          ne: "does not equal",
                          gt: "is greater than",
                          gte: "is at least",
                          lt: "is less than",
                          lte: "is at most",
                        }[c.operator]
                      }{" "}
                      {c.right}.
                    </li>
                  ))}
                </ul>
              )}
              <p>
                {steps.some((s) => s.optional || s.alternatives?.length)
                  ? "Required connections match together. Alternatives match any one relationship on their connection. Optional leaf roles may be unmatched after a complete scan."
                  : preview.constraints
                    ? "All selected connections must hold together. Closing and parallel connections reuse the same records."
                    : preview.branching
                      ? "All selected relationships must match together, using the same record wherever branches meet."
                      : "This is a schema-compatible path."}{" "}
                Run it to find actual records and their supporting evidence.
              </p>
            </section>
          )}
          {temporalQueries && (
            <section
              className="kg-query-connection-options kg-visual-time-filter"
              aria-label="Visual query time filter"
            >
              <label>
                Fact validity
                <select
                  aria-label="Visual time filter"
                  value={temporal?.mode ?? "none"}
                  disabled={locked}
                  onChange={(e) =>
                    edit(() =>
                      setTemporal(
                        e.target.value === "none"
                          ? undefined
                          : {
                              mode: e.target.value as
                                "at" | "overlap" | "simultaneous",
                              start: "",
                              end: "",
                            },
                      ),
                    )
                  }
                >
                  <option value="none">Any time</option>
                  <option value="at">Valid on a date</option>
                  <option value="overlap">Overlaps a range</option>
                  <option value="simultaneous">Shared time in a range</option>
                </select>
              </label>
              {temporal && (
                <>
                  <label>
                    {temporal.mode === "at"
                      ? "Valid on"
                      : "Range start (inclusive)"}
                    <input
                      aria-label="Visual validity date"
                      type="date"
                      value={temporal.start}
                      disabled={locked}
                      onChange={(e) =>
                        edit(() =>
                          setTemporal({ ...temporal, start: e.target.value }),
                        )
                      }
                    />
                  </label>
                  {temporal.mode !== "at" && (
                    <label>
                      Range end (exclusive)
                      <input
                        aria-label="Visual validity end"
                        type="date"
                        value={temporal.end ?? ""}
                        disabled={locked}
                        onChange={(e) =>
                          edit(() =>
                            setTemporal({ ...temporal, end: e.target.value }),
                          )
                        }
                      />
                    </label>
                  )}
                  <p>
                    Review intervals under Refine → Valid time first. Only
                    reviewed intervals qualify. Unknown boundaries are excluded.
                    Explicitly open boundaries are allowed. Overlap mode checks
                    each connection separately. Shared-time mode requires a
                    common interval across every connection and currently uses
                    required connections only.
                  </p>
                </>
              )}
            </section>
          )}
          <h5>Search limits</h5>
          <div className="kg-traversal-controls">
            <label>
              Schema matching
              <select
                aria-label="Visual matching"
                value={mode}
                disabled={locked}
                onChange={(e) => edit(() => setMode(e.target.value))}
              >
                <option value="exact">Exact schema</option>
                <option value="aligned">Reviewed alignments</option>
              </select>
            </label>
            <label>
              Start records
              <input
                aria-label="Visual starting record limit"
                type="number"
                min={1}
                max={1000}
                value={startLimit}
                disabled={locked}
                onChange={(e) =>
                  edit(() => setStartLimit(Number(e.target.value)))
                }
              />
            </label>
            <label>
              Max answers
              <input
                aria-label="Visual answer limit"
                type="number"
                min={1}
                max={100}
                value={limit}
                disabled={locked}
                onChange={(e) => edit(() => setLimit(Number(e.target.value)))}
              />
            </label>
            <label>
              Work budget
              <input
                aria-label="Visual work budget"
                type="number"
                min={10}
                max={5000}
                value={budget}
                disabled={locked}
                onChange={(e) => edit(() => setBudget(Number(e.target.value)))}
              />
            </label>
          </div>
          <p
            className="kg-visual-budget-note"
            title="Starting records are deduplicated across runs. One shared budget counts starting-record checks, adjacent instance relationships and compared value pairs examined. The ten-second deadline and answer/start limits can also produce partial results."
          >
            Counts record checks, connections, compared values and interval
            checks. Limits return partial answers; your selected schema path
            stays intact. Execution stops after ten seconds.
          </p>
        </aside>

        <div className="kg-visual-center-column">
          <QueryCanvas
            graph={graph}
            start={start}
            steps={steps}
            position={position}
            startAttributes={conditionList(startCondition).map(
              (c) => c.attribute,
            )}
            comparisonAttributes={comparisons
              .flatMap((c) => [c.left, c.right])
              .filter((o) => o.binding === position)
              .map((o) => o.attribute)}
            witness={witness}
            locked={locked}
            onReset={() =>
              edit(() => {
                setStart("");
                setSteps([]);
                setPosition(-1);
                setStartCondition(undefined);
                setComparisons([]);
                setTemporal(undefined);
                setHasPicks(false);
              })
            }
            onConcept={concept}
            onEdge={edge}
            onAttribute={attribute}
            onPick={(picks) => {
              const hasPicks = !!(
                picks.concepts.length || picks.relationships.length
              );
              edit(() => setHasPicks(hasPicks));
              if (hasPicks) {
                try {
                  selectedChain(graph, picks);
                } catch (e) {
                  setError(e instanceof Error ? e.message : String(e));
                }
              }
            }}
            onSelection={(picked, preferred) => {
              try {
                const path = selectedChain(graph, picked, preferred);
                edit(() => {
                  setHasPicks(false);
                  setStart(path.start);
                  setSteps(path.steps);
                  setPosition(path.steps.length - 1);
                  setStartCondition(undefined);
                  setComparisons([]);
                  setRoleLabels({});
                });
                return true;
              } catch (e) {
                setError(e instanceof Error ? e.message : String(e));
                return false;
              }
            }}
          />
          {result && (
            <section
              className="kg-visual-inline-results kg-query-answer-panel"
              ref={answersPanel}
              tabIndex={-1}
              aria-label="Visual query answers"
            >
              {result && (
                <div className="kg-query-workflow-bar">
                  <strong>
                    {result.returned} answers
                    {result.truncated ? " · partial results" : ""}
                  </strong>
                  <button
                    onClick={() =>
                      downloadAnswers("json", result, {
                        ...base,
                        limit,
                        budget,
                        start_limit: startLimit,
                      })
                    }
                  >
                    Download JSON
                  </button>
                  <button
                    onClick={() =>
                      downloadAnswers("csv", result, {
                        ...base,
                        limit,
                        budget,
                        start_limit: startLimit,
                      })
                    }
                  >
                    Download CSV
                  </button>
                </div>
              )}

              <>
                <h4>
                  {result?.branching
                    ? "Matching connected records"
                    : "Matching record paths"}
                </h4>
                <p>
                  {result?.starts_scanned} starting records checked ·{" "}
                  {result?.examined} work units
                </p>
                <strong>
                  {result?.truncated
                    ? `Partial answers · ${result.stop?.replaceAll("_", " ")}`
                    : "Complete within the selected scope"}
                </strong>
                <p>{result?.semantics}</p>
                {!result?.returned && (
                  <p>
                    No records match the complete selection and conditions. Edit
                    the query or increase the displayed budgets.
                  </p>
                )}
                <div className="kg-traversal-results">
                  {result?.items.map((w, i) => (
                    <button
                      key={i}
                      aria-pressed={selected === i}
                      onClick={() => {
                        setSelected(i);
                        if (!context) onOpenAnswer?.(w);
                      }}
                    >
                      <strong>
                        {w.records
                          ? `${w.start.label} · ${new Set([w.start.id, ...w.records.map((r) => r.id)].filter(Boolean)).size} connected records`
                          : `${w.start.label} → ${w.record.label}`}
                      </strong>
                      <small>
                        {w.steps.length} relationships · {w.start.source} /{" "}
                        {w.record.source}
                      </small>
                    </button>
                  ))}
                </div>
              </>
            </section>
          )}

          {witness && <QueryWitnessDetails witness={witness} />}
        </div>
        <div className="kg-visual-right-column">
          <aside className="kg-visual-controls">
            <>
              <div className="kg-query-setup-heading">
                <h4>Start your query</h4>
                {runAction}
              </div>
              <label>
                Starting concept
                <select
                  aria-label="Visual starting concept"
                  disabled={locked}
                  value={start}
                  onChange={(e) =>
                    edit(() => {
                      setStart(e.target.value);
                      setSteps([]);
                      setPosition(-1);
                      setStartCondition(undefined);
                      setComparisons([]);
                      setRoleLabels({});
                    })
                  }
                >
                  <option value="">Select on the graph or here</option>
                  {graph.concepts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
              {start && (
                <>
                  <div
                    className="kg-visual-chain"
                    aria-label="Selected visual path"
                  >
                    <button
                      aria-pressed={position === -1}
                      onClick={() => setPosition(-1)}
                    >
                      {name(start)} · Start{startCondition ? " · filtered" : ""}
                    </button>
                    {steps.map((s, i) => (
                      <button
                        key={i}
                        aria-pressed={position === i}
                        onClick={() => setPosition(i)}
                      >
                        <small>
                          {i + 1} ·{" "}
                          {branching
                            ? `${name(s.parent === -1 ? start : steps[s.parent ?? i - 1]?.target)} · `
                            : ""}{" "}
                          {s.kind === "identity"
                            ? "Reviewed identity"
                            : graph.relationships.find(
                                (e) => e.id === s.relationship,
                              )?.label}{" "}
                          {graph.relationships.find(
                            (e) => e.id === s.relationship,
                          )?.direction === "directed"
                            ? s.direction === "incoming"
                              ? "←"
                              : "→"
                            : "—"}
                        </small>
                        {roleLabels[String(i)] || name(s.target)}
                        {s.optional ? " · optional" : ""}
                        {s.alternatives?.length ? " · alternatives" : ""}
                        {s.target_binding !== undefined
                          ? ` · same record as ${s.target_binding === -1 ? "start" : `step ${s.target_binding + 1}`}`
                          : ""}
                        {s.condition ? " · filtered" : ""}
                      </button>
                    ))}
                  </div>
                  <div className="kg-auto-actions">
                    <button
                      disabled={locked || !steps.length}
                      onClick={() =>
                        edit(() => {
                          setRoleLabels((previous) =>
                            Object.fromEntries(
                              Object.entries(previous).filter(
                                ([key]) => Number(key) < steps.length - 1,
                              ),
                            ),
                          );
                          setSteps(steps.slice(0, -1));
                          setPosition(steps.length - 2);
                        })
                      }
                    >
                      Undo last step
                    </button>
                  </div>
                  <h4>Continue from {name(tip)}</h4>
                  <div className="kg-visual-next">
                    {available.map((e) => (
                      <button
                        key={e.id}
                        disabled={locked}
                        onClick={() => edge(e.id)}
                      >
                        <strong>{e.label}</strong>
                        <small>
                          {e.direction === "directed" && e.target === tip
                            ? "Follow backwards · "
                            : ""}
                          {name(e.source === tip ? e.target : e.source)}
                        </small>
                      </button>
                    ))}
                    {!available.length && (
                      <p>
                        No relationships connect to this concept in the selected
                        runs.
                      </p>
                    )}
                  </div>
                  <button
                    disabled={locked || !!context?.checkpoint || !!temporal}
                    onClick={() =>
                      edit(() => {
                        setSteps([
                          ...steps,
                          {
                            kind: "identity",
                            relationship: "",
                            direction: "outgoing",
                            target: tip,
                          },
                        ]);
                        setPosition(steps.length);
                      })
                    }
                  >
                    Follow reviewed identity
                  </button>
                  <label>
                    Record role name
                    <input
                      aria-label="Visual record role name"
                      maxLength={100}
                      value={roleLabels[String(position)] ?? ""}
                      placeholder={
                        position < 0
                          ? `Start · ${name(start)}`
                          : `Step ${position + 1} · ${name(focus)}`
                      }
                      disabled={locked}
                      onChange={(e) =>
                        edit(() =>
                          setRoleLabels({
                            ...roleLabels,
                            [String(position)]: e.target.value,
                          }),
                        )
                      }
                    />
                  </label>
                  {position >= 0 && steps[position]?.kind !== "identity" && (
                    <section className="kg-query-connection-options">
                      <h5>This connection</h5>
                      <label>
                        <input
                          type="checkbox"
                          aria-label="Optional visual connection"
                          checked={steps[position].optional ?? false}
                          disabled={locked}
                          onChange={(e) =>
                            edit(() =>
                              setSteps(
                                steps.map((s, i) =>
                                  i === position
                                    ? { ...s, optional: e.target.checked }
                                    : s,
                                ),
                              ),
                            )
                          }
                        />
                        Optional leaf · keep the starting answer if no match
                      </label>
                      <label>
                        Alternative relationship
                        <select
                          aria-label="Alternative visual relationship"
                          value=""
                          disabled={locked}
                          onChange={(e) => {
                            const id = e.target.value;
                            if (id)
                              edit(() =>
                                setSteps(
                                  steps.map((s, i) =>
                                    i === position
                                      ? {
                                          ...s,
                                          alternatives: [
                                            ...new Set([
                                              ...(s.alternatives ?? []),
                                              id,
                                            ]),
                                          ],
                                        }
                                      : s,
                                  ),
                                ),
                              );
                          }}
                        >
                          <option value="">Add an alternative (OR)</option>
                          {graph.relationships
                            .filter((e) => {
                              const s = steps[position],
                                original = graph.relationships.find(
                                  (e) => e.id === s.relationship,
                                );
                              return (
                                original &&
                                e.id !== original.id &&
                                e.direction === original.direction &&
                                ((e.source === original.source &&
                                  e.target === original.target) ||
                                  (e.direction !== "directed" &&
                                    e.source === original.target &&
                                    e.target === original.source))
                              );
                            })
                            .map((e) => (
                              <option key={e.id} value={e.id}>
                                {e.label}
                              </option>
                            ))}
                        </select>
                      </label>
                      {steps[position].alternatives?.map((id) => (
                        <button
                          key={id}
                          disabled={locked}
                          onClick={() =>
                            edit(() =>
                              setSteps(
                                steps.map((s, i) =>
                                  i === position
                                    ? {
                                        ...s,
                                        alternatives: s.alternatives?.filter(
                                          (a) => a !== id,
                                        ),
                                      }
                                    : s,
                                ),
                              ),
                            )
                          }
                        >
                          {graph.relationships.find((e) => e.id === id)?.label}{" "}
                          ×
                        </button>
                      ))}
                      <p>
                        Alternatives match any one type on this connection.
                        Other connections must still match together. Optional
                        roles cannot feed another step or comparison.
                      </p>
                    </section>
                  )}
                  <h4>Conditions on {name(focus)}</h4>
                  <div className="kg-visual-attributes">
                    {graph.attributes
                      ?.filter((a) => a.concept === focus)
                      .map((a) => (
                        <button
                          key={a.id}
                          disabled={locked}
                          aria-pressed={conditionList(condition).some(
                            (c) => c.attribute === a.id,
                          )}
                          onClick={() => attribute(a.id)}
                        >
                          {a.name}
                          <small>{a.datatype}</small>
                        </button>
                      ))}
                  </div>
                  <VisualConditions
                    index={position}
                    target={focus}
                    attributes={graph.attributes ?? []}
                    condition={condition}
                    disabled={locked}
                    onChange={changeCondition}
                  />
                  <CompareAttributes
                    roles={roles}
                    attributes={graph.attributes ?? []}
                    comparisons={comparisons}
                    disabled={locked}
                    focus={position}
                    onChange={(value) => edit(() => setComparisons(value))}
                  />
                </>
              )}
            </>
          </aside>
          <VisualQueryLibrary
            key={JSON.stringify(incomingRuns)}
            post={post}
            selectedRecipe={loaded}
            draft={{ ...base, limit, budget, start_limit: startLimit }}
            token={preview?.token}
            disabled={locked}
            onLoad={(r) => {
              if (
                !temporalQueries &&
                (r.query.temporal || r.query.checkpoint)
              ) {
                if (onTemporalRecipe) onTemporalRecipe(r);
                else
                  setContextNotice(
                    "Open Compare views → Query by time to load this temporal or captured-view query.",
                  );
                return;
              }
              setContext({
                graph: r.graph as Graph,
                runs: r.runs,
                checkpoint: r.query.checkpoint as string | undefined,
                title: r.title,
              });
              setLoaded(r);
              setContextNotice(
                r.stale
                  ? "Schema changed since saving. Review connections and preview again."
                  : "Draft loaded. Review and preview before running. Answers can be inspected here.",
              );
            }}
          ></VisualQueryLibrary>
        </div>
      </div>
      {pending && (
        <div role="status">
          {request.current
            ? "Finding record paths…"
            : "Checking schema compatibility…"}
          {request.current && (
            <button
              onClick={() => {
                const id = request.current;
                generation.current++;
                setPending(false);
                request.current = "";
                void post("cancel-traversal", { request_id: id }).catch((e) =>
                  setError(String(e)),
                );
              }}
            >
              Cancel visual query
            </button>
          )}
        </div>
      )}
    </section>
  );
}
export function QueryWitnessDetails({ witness }: { witness: Witness }) {
  return (
    <section className="kg-visual-witness" aria-label="Visual query evidence">
      <h3>
        {witness.records
          ? `Answer graph · ${witness.start.label}`
          : `Answer path · ${witness.start.label} → ${witness.record.label}`}
      </h3>
      <p>
        Start: {witness.start.source} · Row {witness.start.row}
      </p>
      {!!witness.shared_intervals?.length && (
        <section
          className="kg-validity-summary"
          aria-label="Shared answer validity"
        >
          <h4>When these connections hold together</h4>
          {witness.shared_intervals.map((w, i) => (
            <p key={i}>
              {w.start} → {w.end} · end exclusive
            </p>
          ))}
          <small>
            These windows are supported by reviewed contributions on every
            connection.
          </small>
        </section>
      )}
      {witness.start_attribute_matches && (
        <AttributeMatchExplanation matches={witness.start_attribute_matches} />
      )}{" "}
      {!!witness.comparison_matches?.length && (
        <section aria-label="Compared attribute values">
          <h4>Why the comparisons match</h4>
          {witness.comparison_matches.map((c) => (
            <article key={c.index}>
              <strong>
                Comparison {c.index + 1}: {c.left.role}{" "}
                {
                  { eq: "=", ne: "≠", gt: ">", gte: "≥", lt: "<", lte: "≤" }[
                    c.operator
                  ]
                }{" "}
                {c.right.role}
              </strong>
              <p>
                {c.left.record}: {String(c.left.value)} · {c.right.record}:{" "}
                {String(c.right.value)}
              </p>
              <AttributeMatchExplanation matches={[c.left, c.right]} />
            </article>
          ))}
        </section>
      )}
      {witness.steps.map((s, i) => (
        <article key={i}>
          <h4>
            {i + 1} · {s.source ? `${s.source.label} — ` : ""}
            {s.relation} {s.pattern_direction === "incoming" ? "←" : "→"}{" "}
            {s.target.label}
          </h4>
          {s.kind === "identity" && (
            <p>
              Accepted reviewed identity ·{" "}
              {s.reviewed_key?.attributes?.join(", ") || "Reviewed key"}. No
              relationship is inferred.
            </p>
          )}
          {s.kind === "optional_missing" ? (
            <p>{s.explanation}</p>
          ) : (
            <p>
              {s.target.source} · Row {s.target.row} · Original relationship:{" "}
              {s.original_relationship ?? s.relation}
            </p>
          )}
          {s.direction === "directed" && s.pattern_direction === "incoming" && (
            <p>
              Followed backwards for this query; the stored relationship
              direction is unchanged.
            </p>
          )}
          {s.relationship_mappings?.map((m) => (
            <p key={m.id}>
              Reviewed {m.kind}: {m.source_label} / {m.target_label}
            </p>
          ))}
          {s.attribute_matches && (
            <AttributeMatchExplanation matches={s.attribute_matches} />
          )}{" "}
          {(s.contributions ?? []).map((c, j) => (
            <section key={j}>
              <strong>{c.run_title}</strong>
              {c.validity && <ValiditySummary review={c.validity} />}
              {c.evidence.map((e, k) => (
                <blockquote key={k}>
                  {e.context_text || e.text || "Passage unavailable"}
                </blockquote>
              ))}
            </section>
          ))}
        </article>
      ))}
    </section>
  );
}
