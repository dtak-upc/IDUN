import { useEffect, useRef, useState } from "react";
import cytoscape, { type Core, type StylesheetJson } from "cytoscape";
import {
  classes,
  properties,
  snapshots,
  visibleFacts,
  changeFor,
  validFacts,
} from "./fixture";
import "./knowledge.css";
type Step = "Layers" | "Schema" | "Align" | "Query";
type Saved = {
  step: Step;
  layers: number[];
  at: number;
  compare: boolean;
  base: number;
  selected: string[];
  positions: Record<string, { x: number; y: number }>;
  clock?: "recorded" | "valid";
  validDate?: string;
  queryShown?: boolean;
  preview?: boolean;
};
const defaults: Saved = {
  step: "Layers",
  layers: [0, 1, 2],
  at: 2,
  compare: false,
  base: 0,
  selected: [],
  positions: {},
};
function load(lake: string): Saved {
  try {
    const s = JSON.parse(
      sessionStorage.getItem(`idun.kg.ui.v1.${lake}`) || "null",
    );
    if (
      s &&
      ["Layers", "Schema", "Align", "Query"].includes(s.step) &&
      Array.isArray(s.layers) &&
      s.layers.every(
        (n: unknown) => Number.isInteger(n) && Number(n) >= 0 && Number(n) < 3,
      ) &&
      Number.isInteger(s.at) &&
      s.at >= 0 &&
      s.at < 3 &&
      Number.isInteger(s.base) &&
      s.base >= 0 &&
      s.base < 3
    )
      return {
        ...defaults,
        ...s,
        compare: Boolean(s.compare) && s.at > 0,
        base: Math.min(s.base, Math.max(0, s.at - 1)),
        selected: Array.isArray(s.selected)
          ? s.selected.filter((v: unknown) => typeof v === "string")
          : [],
        positions: s.positions || {},
      };
  } catch {
    /* storage optional */
  }
  return { ...defaults };
}
function style(dark: boolean): StylesheetJson {
  return [
    {
      selector: "node",
      style: {
        label: "data(label)",
        width: 120,
        height: 75,
        "background-color": dark ? "#213554" : "#edf2ff",
        "border-width": 1.5,
        "border-color": "#7694d6",
        color: dark ? "#e5edff" : "#263a60",
        "text-valign": "center",
        "text-wrap": "wrap",
        "text-max-width": "106px",
        "font-size": 13,
      },
    },
    {
      selector: "edge",
      style: {
        label: "data(label)",
        "curve-style": "bezier",
        "target-arrow-shape": "triangle",
        "line-color": "#8c9db7",
        "target-arrow-color": "#8c9db7",
        width: 1.7,
        "font-size": 10,
        "text-background-color": dark ? "#111c2e" : "#ffffff",
        "text-background-opacity": 1,
        "text-background-padding": "4px",
        color: dark ? "#b9c9e8" : "#506485",
        "text-rotation": "autorotate",
      },
    },
    {
      selector: ".added",
      style: {
        "line-color": "#2c9269",
        "target-arrow-color": "#2c9269",
        width: 3,
      },
    },
    {
      selector: ".changed",
      style: {
        "line-color": "#cf981f",
        "target-arrow-color": "#cf981f",
        width: 3,
      },
    },
    {
      selector: ".withdrawn",
      style: {
        "line-color": "#b55b73",
        "target-arrow-color": "#b55b73",
        "line-style": "dashed",
        opacity: 0.55,
      },
    },
    {
      selector: ".mapping",
      style: {
        "line-style": "dashed",
        "line-color": "#846bd0",
        "target-arrow-shape": "none",
        color: dark ? "#c9b8ff" : "#785bb7",
      },
    },
    { selector: ".dim", style: { opacity: 0.18 } },
    {
      selector: ":selected",
      style: {
        "border-width": 3,
        "border-color": "#3564dd",
        "line-color": "#3564dd",
        "target-arrow-color": "#3564dd",
        opacity: 1,
      },
    },
  ];
}
export function KnowledgeGraph({
  lakeId,
  lakeName,
}: {
  lakeId: string;
  lakeName: string;
}) {
  const [state, setState] = useState<Saved>(() => load(lakeId));
  const [preview, setPreview] = useState(Boolean(state.preview)),
    [drawer, setDrawer] = useState(false),
    [search, setSearch] = useState("");
  const [clock, setClock] = useState<"recorded" | "valid">(
      state.clock === "valid" ? "valid" : "recorded",
    ),
    [validDate, setValidDate] = useState(
      typeof state.validDate === "string" ? state.validDate : "2026-07-15",
    ),
    [queryShown, setQueryShown] = useState(Boolean(state.queryShown));
  const host = useRef<HTMLDivElement>(null),
    graph = useRef<Core | undefined>(undefined),
    current = useRef(state);
  current.current = state;
  const patch = (v: Partial<Saved>) => setState((s) => ({ ...s, ...v }));
  const active = visibleFacts(state.at, state.layers),
    previous = state.compare ? visibleFacts(state.base, state.layers) : [];
  const shownProperties = properties.filter((p) =>
    [...active, ...previous].some((f) => f.property === p.id),
  );
  const shownClasses = classes.filter((c) =>
    shownProperties.some((p) => p.source === c.id || p.target === c.id),
  );
  const selected = state.selected.at(-1),
    concept = classes.find((c) => c.id === selected),
    property = properties.find((p) => p.id === selected);
  const selectedFacts = property
    ? active.filter((f) => f.property === property.id)
    : active.filter((f) =>
        properties.some(
          (p) =>
            p.id === f.property &&
            (p.source === selected || p.target === selected),
        ),
      );
  const changes = shownProperties.map((p) =>
    changeFor(p.id, state.at, state.base, state.layers),
  );
  const answers = (
    clock === "recorded"
      ? active
      : validFacts(state.at, state.layers, validDate)
  ).filter((f) => f.property === "operates");
  useEffect(() => {
    try {
      sessionStorage.setItem(
        `idun.kg.ui.v1.${lakeId}`,
        JSON.stringify({ ...state, clock, validDate, queryShown, preview }),
      );
    } catch {
      /* optional */
    }
  }, [state, lakeId, clock, validDate, queryShown, preview]);
  useEffect(() => {
    if (!host.current) return;
    const cy = cytoscape({
      container: host.current,
      elements: [],
      style: style(document.documentElement.dataset.theme === "dark"),
      layout: { name: "preset" },
      selectionType: "additive",
      minZoom: 0.25,
      maxZoom: 3,
    });
    graph.current = cy;
    cy.on("select unselect", () =>
      patch({ selected: cy.$(":selected").map((e) => e.id()) }),
    );
    cy.on("dragfree", "node", () =>
      patch({
        positions: Object.fromEntries(
          cy.nodes().map((n) => [n.id(), n.position()]),
        ),
      }),
    );
    const resize = new ResizeObserver(() => cy.resize());
    resize.observe(host.current);
    const theme = new MutationObserver(() =>
      cy.style(style(document.documentElement.dataset.theme === "dark")),
    );
    theme.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => {
      resize.disconnect();
      theme.disconnect();
      cy.destroy();
      graph.current = undefined;
    };
  }, []);
  useEffect(() => {
    const cy = graph.current;
    if (!cy) return;
    const ids = new Set([
      ...shownClasses.map((c) => c.id),
      ...shownProperties.map((p) => p.id),
      ...(preview && state.step === "Align" ? ["mapping"] : []),
    ]);
    cy.batch(() => {
      cy.elements()
        .filter((e) => !ids.has(e.id()))
        .remove();
      for (const c of shownClasses)
        if (!cy.$id(c.id).length) {
          const p = current.current.positions[c.id];
          cy.add({
            data: { id: c.id, label: c.label },
            position:
              p && Number.isFinite(p.x) && Number.isFinite(p.y)
                ? p
                : { x: c.x, y: c.y },
          });
        }
      for (const p of shownProperties) {
        if (!cy.$id(p.id).length) cy.add({ data: { ...p } });
        cy.$id(p.id).classes(
          state.compare
            ? changeFor(p.id, state.at, state.base, state.layers)
            : "",
        );
      }
      if (
        preview &&
        state.step === "Align" &&
        cy.$id("city").length &&
        cy.$id("municipality").length &&
        !cy.$id("mapping").length
      )
        cy.add({
          data: {
            id: "mapping",
            source: "city",
            target: "municipality",
            label: "PROPOSED EQUIVALENCE",
          },
          classes: "mapping",
        });
      for (const id of current.current.selected) cy.$id(id).select();
    });
    if (cy.nodes().length && !cy.scratch("fitted")) {
      cy.fit(undefined, 55);
      cy.scratch("fitted", true);
    }
  }, [state.at, state.base, state.compare, state.layers, preview, state.step]);
  useEffect(() => {
    const cy = graph.current;
    if (!cy) return;
    cy.elements().removeClass("dim");
    const picked = cy.$(":selected");
    if (picked.length)
      cy.elements()
        .difference(
          picked
            .union(picked.connectedEdges())
            .union(picked.connectedEdges().connectedNodes())
            .union(picked.connectedNodes()),
        )
        .addClass("dim");
  }, [state.selected, state.at, state.layers, preview]);
  function choose(id: string, add = false) {
    const cy = graph.current;
    if (!cy) return;
    if (!add) cy.elements().unselect();
    cy.$id(id).select();
  }
  function at(n: number) {
    patch({
      at: n,
      base: Math.min(state.base, Math.max(0, n - 1)),
      compare: n === 0 ? false : state.compare,
    });
  }
  const steps: Step[] = ["Layers", "Schema", "Align", "Query"];
  return (
    <section className="kg" aria-label="Knowledge Graph workspace">
      <header className="kg-heading">
        <div>
          <span className="kg-eyebrow">KNOWLEDGE GRAPH</span>
          <h1>
            See how knowledge connects.
            <br />
            <em>And how it changes.</em>
          </h1>
          <p>
            Explore schemas, trace instances and compare what each run
            contributes.
          </p>
        </div>
        <div className="kg-preview">
          <b>Interactive UI preview</b>
          <span>Synthetic examples · {lakeName}</span>
          <small>No graph has been built from this lake.</small>
        </div>
      </header>
      <nav
        className="kg-steps"
        role="tablist"
        aria-label="Knowledge Graph steps"
      >
        {steps.map((s, i) => (
          <button
            key={s}
            id={`kg-tab-${s}`}
            role="tab"
            aria-controls={`kg-panel-${s}`}
            aria-selected={state.step === s}
            tabIndex={state.step === s ? 0 : -1}
            onKeyDown={(event) => {
              const target =
                event.key === "ArrowRight"
                  ? steps[(i + 1) % 4]
                  : event.key === "ArrowLeft"
                    ? steps[(i + 3) % 4]
                    : event.key === "Home"
                      ? steps[0]
                      : event.key === "End"
                        ? steps[3]
                        : undefined;
              if (target) {
                event.preventDefault();
                patch({ step: target });
                setDrawer(false);
                document.getElementById(`kg-tab-${target}`)?.focus();
              }
            }}
            onClick={() => {
              patch({ step: s });
              setDrawer(false);
            }}
          >
            <span>0{i + 1}</span>
            <div>
              <b>{s}</b>
              <small>
                {
                  [
                    "Choose contributions",
                    "Explore the structure",
                    "Connect concepts",
                    "Follow a question",
                  ][i]
                }
              </small>
            </div>
          </button>
        ))}
      </nav>
      <div
        className="kg-stage"
        role="tabpanel"
        id={`kg-panel-${state.step}`}
        aria-labelledby={`kg-tab-${state.step}`}
      >
        <div className="kg-stage-intro" key={state.step}>
          <div>
            <h2>
              {
                {
                  Layers: "Build a view from selected runs",
                  Schema: "A compact map, with records underneath",
                  Align: "Review connections between schemas",
                  Query: "Ask across the connections",
                }[state.step]
              }
            </h2>
            <p>
              {
                {
                  Layers:
                    "Layers contribute knowledge; unchecking one changes this example’s view and query scope.",
                  Schema:
                    "Pick a concept or relationship. Its records and supporting passages stay one click away.",
                  Align:
                    "Compare meaning and direction before accepting a mapping. Class alignment never merges records.",
                  Query:
                    "Choose when IDUN knew something, or when the evidence says it was valid.",
                }[state.step]
              }
            </p>
          </div>
          {state.step === "Layers" && (
            <button
              className="kg-primary"
              onClick={() => patch({ step: "Schema" })}
            >
              Explore schema →
            </button>
          )}
        </div>
        <div className="kg-layout">
          <aside className="kg-layers">
            <span className="kg-eyebrow">RUN LAYERS</span>
            <h3>
              {state.layers.filter((n) => n <= state.at).length} active
              contributions
            </h3>
            {snapshots.map((run, i) => (
              <label
                key={run.id}
                className={`kg-layer ${i > state.at ? "kg-future" : ""}`}
              >
                <input
                  type="checkbox"
                  checked={state.layers.includes(i)}
                  onChange={() =>
                    patch({
                      layers: state.layers.includes(i)
                        ? state.layers.filter((n) => n !== i)
                        : [...state.layers, i],
                    })
                  }
                />
                <div>
                  <strong>{run.title}</strong>
                  <small>{run.model}</small>
                  <time>
                    {run.date}
                    {i > state.at ? " · after snapshot" : ""}
                  </time>
                </div>
                <span className="kg-layer-no">0{i + 1}</span>
              </label>
            ))}
            <p className="kg-note">
              Only checked layers recorded by the selected snapshot contribute.
              A hidden update cannot withdraw an earlier assertion.
            </p>
            <button disabled title="Real run projection begins in KG-03">
              Build from integration runs
            </button>
            <small className="kg-unavailable">
              Real run connection is the next iteration.
            </small>
          </aside>
          <div className="kg-canvas-panel">
            <div className="kg-canvas-toolbar">
              <div>
                <b>Schema view</b>
                <span>
                  {shownClasses.length} concepts · {shownProperties.length}{" "}
                  relationships
                </span>
              </div>
              <div className="kg-tools">
                <button
                  aria-label="Zoom out"
                  onClick={() => {
                    const cy = graph.current;
                    if (cy)
                      cy.zoom({
                        level: cy.zoom() / 1.2,
                        renderedPosition: {
                          x: cy.width() / 2,
                          y: cy.height() / 2,
                        },
                      });
                  }}
                >
                  −
                </button>
                <button
                  aria-label="Zoom in"
                  onClick={() => {
                    const cy = graph.current;
                    if (cy)
                      cy.zoom({
                        level: cy.zoom() * 1.2,
                        renderedPosition: {
                          x: cy.width() / 2,
                          y: cy.height() / 2,
                        },
                      });
                  }}
                >
                  +
                </button>
                <button onClick={() => graph.current?.fit(undefined, 55)}>
                  Fit
                </button>
                <button
                  disabled={!state.selected.length}
                  onClick={() => graph.current?.elements().unselect()}
                >
                  Clear focus
                </button>
              </div>
            </div>
            <div className="kg-graph-wrap">
              <div
                ref={host}
                className="kg-graph"
                aria-label="Interactive schema graph"
              />
              {!shownClasses.length && (
                <div className="kg-empty">
                  <h3>No layers in this view</h3>
                  <p>Check an earlier run or choose a later snapshot.</p>
                  <button onClick={() => patch({ layers: [0, 1, 2], at: 2 })}>
                    Restore example layers
                  </button>
                </div>
              )}
            </div>
            <div className="kg-graph-foot">
              <span>
                Drag to arrange · scroll to zoom · Ctrl/⌘-click to select
                several
              </span>
              <details>
                <summary>Find a concept or relationship</summary>
                <input
                  aria-label="Find schema element"
                  placeholder="Search the schema"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <div>
                  {[...shownClasses, ...shownProperties]
                    .filter((e) =>
                      e.label.toLowerCase().includes(search.toLowerCase()),
                    )
                    .map((e) => (
                      <button
                        key={e.id}
                        onClick={(event) =>
                          choose(e.id, event.ctrlKey || event.metaKey)
                        }
                      >
                        {e.label}
                      </button>
                    ))}
                </div>
              </details>
            </div>
            <div className="kg-timeline">
              <div className="kg-time-heading">
                <div>
                  <span className="kg-eyebrow">RECORDED HISTORY</span>
                  <strong>{snapshots[state.at].title}</strong>
                  <small>
                    Known to IDUN by {snapshots[state.at].date} · synthetic
                    snapshots
                  </small>
                </div>
                <label className="kg-compare">
                  <input
                    type="checkbox"
                    checked={state.compare}
                    disabled={state.at === 0}
                    onChange={(e) => patch({ compare: e.target.checked })}
                  />{" "}
                  Compare changes
                </label>
              </div>
              <input
                type="range"
                aria-label="Recorded snapshot"
                min="0"
                max="2"
                step="1"
                value={state.at}
                onChange={(e) => at(Number(e.target.value))}
              />
              <div className="kg-ticks">
                {snapshots.map((s, i) => (
                  <button
                    key={s.id}
                    aria-pressed={i === state.at}
                    onClick={() => at(i)}
                  >
                    {s.date}
                    <small>{["Initial", "Extended", "Reviewed"][i]}</small>
                  </button>
                ))}
              </div>
              {state.compare && (
                <div className="kg-change-legend">
                  <label>
                    Compare with{" "}
                    <select
                      aria-label="Comparison snapshot"
                      value={state.base}
                      onChange={(e) => patch({ base: Number(e.target.value) })}
                    >
                      {snapshots.slice(0, state.at).map((s, i) => (
                        <option key={s.id} value={i}>
                          {s.title}
                        </option>
                      ))}
                    </select>
                  </label>
                  <span className="kg-added">
                    + {changes.filter((c) => c === "added").length} added
                  </span>
                  <span className="kg-changed">
                    ↻ {changes.filter((c) => c === "changed").length} changed
                  </span>
                  <span className="kg-withdrawn">
                    − {changes.filter((c) => c === "withdrawn").length}{" "}
                    withdrawn
                  </span>
                  <small>
                    Relationship groups; changes include different supporting
                    instances. Dashed edges show explicit withdrawals in this
                    example.
                  </small>
                </div>
              )}
            </div>
          </div>
          <aside className="kg-inspector">
            {state.step === "Align" ? (
              <>
                <span className="kg-eyebrow">SCHEMA SUGGESTION · EXAMPLE</span>
                <h3>City ↔ Municipality</h3>
                <p>
                  These classes may describe the same kind of place. Compare
                  their records before aligning them.
                </p>
                <div className="kg-mapping">
                  <span>
                    Before <b>2 classes</b>
                  </span>
                  <span>
                    After <b>1 shared class</b>
                  </span>
                </div>
                <p className="kg-note">
                  Source records remain distinct. Name similarity alone does not
                  establish entity identity.
                </p>
                <button
                  disabled={!shownClasses.some((c) => c.id === "municipality")}
                  aria-pressed={preview}
                  onClick={() => setPreview(!preview)}
                >
                  {preview ? "Hide mapping preview" : "Preview mapping"}
                </button>
                <button disabled>Accept mapping</button>
                <small className="kg-unavailable">
                  Review persistence and LLM suggestions arrive in KG-05/06.
                  This is a supplied example.
                </small>
              </>
            ) : state.step === "Query" ? (
              <>
                <span className="kg-eyebrow">TEMPORAL QUERY · EXAMPLE</span>
                <h3>Where did Northstar operate?</h3>
                <label className="kg-field">
                  Time perspective
                  <select
                    value={clock}
                    onChange={(e) => setClock(e.target.value as typeof clock)}
                  >
                    <option value="recorded">Known by this snapshot</option>
                    <option value="valid">Valid on a source date</option>
                  </select>
                </label>
                {clock === "valid" && (
                  <label className="kg-field">
                    Valid on
                    <input
                      type="date"
                      value={validDate}
                      onChange={(e) => setValidDate(e.target.value)}
                    />
                  </label>
                )}
                <p>Organization → OPERATES_IN → City</p>
                <button
                  className="kg-primary"
                  disabled={clock === "valid" && !validDate}
                  onClick={() => setQueryShown(true)}
                >
                  Preview example answer
                </button>
                <small className="kg-unavailable">
                  Evaluates synthetic records only. Live query execution is
                  planned for KG-08.
                </small>
                {queryShown && (
                  <div className="kg-query-results" role="status">
                    <b>
                      {answers.length} example{" "}
                      {answers.length === 1 ? "answer" : "answers"}
                    </b>
                    {answers.map((f) => (
                      <p key={f.id}>
                        <strong>{f.object}</strong>
                        <small>
                          {clock === "valid"
                            ? `Source interval: ${f.validFrom} → ${f.validTo || "open end"}`
                            : `Recorded in ${snapshots[f.introduced].title}`}
                        </small>
                      </p>
                    ))}
                    {!answers.length && (
                      <p>
                        No matching assertion in the selected history and layer
                        scope. This does not mean the relationship never
                        existed.
                      </p>
                    )}
                  </div>
                )}
                <details className="kg-time-help">
                  <summary>What do the two clocks mean?</summary>
                  <p>
                    Recorded time is when IDUN stored a claim. Valid time is
                    when its source says it applies. Unknown dates stay unknown;
                    newer runs do not automatically make facts false.
                  </p>
                  <p>
                    {active.filter((f) => !f.validFrom).length} current example
                    assertions have no source validity date.
                  </p>
                </details>
              </>
            ) : concept || property ? (
              <>
                <span className="kg-eyebrow">
                  {concept ? "CONCEPT" : "RELATIONSHIP"}
                </span>
                <h3>{concept?.label || property?.label}</h3>
                <p>
                  {concept
                    ? "A schema concept groups records without merging their identities."
                    : `${classes.find((c) => c.id === property?.source)?.label} → ${classes.find((c) => c.id === property?.target)?.label}`}
                </p>
                {state.compare && property && (
                  <span className="kg-state-pill">
                    {changeFor(property.id, state.at, state.base, state.layers)}
                  </span>
                )}
                <div className="kg-inspector-count">
                  <strong>{selectedFacts.length}</strong>
                  <span>current supporting assertions</span>
                </div>
                <button onClick={() => setDrawer(!drawer)}>
                  {drawer ? "Close records" : "Inspect records & evidence"}
                </button>
                <p className="kg-note">
                  Selection keeps other concepts in place. Use Ctrl/⌘-click for
                  multiple selections.
                </p>
              </>
            ) : (
              <>
                <span className="kg-eyebrow">START EXPLORING</span>
                <h3>The schema is your map.</h3>
                <p>
                  Select a concept to inspect its records, or a relationship to
                  follow its evidence.
                </p>
                <ol>
                  <li>Choose run layers.</li>
                  <li>Move through recorded snapshots.</li>
                  <li>Compare changes in the same graph.</li>
                </ol>
                <details className="kg-time-help">
                  <summary>Does newer mean more reliable?</summary>
                  <p>
                    No. Recency is separate from support and review. Unchanged
                    facts do not expire just because another run completes.
                  </p>
                </details>
              </>
            )}
          </aside>
        </div>
        {drawer && (
          <section
            className="kg-drawer"
            aria-label="Example instances and evidence"
          >
            <header>
              <div>
                <span className="kg-eyebrow">INSTANCES · SYNTHETIC</span>
                <h3>{concept?.label || property?.label}</h3>
              </div>
              <button onClick={() => setDrawer(false)}>Close records</button>
            </header>
            {selectedFacts.length ? (
              <div className="kg-records">
                {selectedFacts.map((f) => (
                  <article key={f.id}>
                    <strong>
                      {f.subject} → {f.object}
                    </strong>
                    <small>
                      {properties.find((p) => p.id === f.property)?.label} ·
                      recorded {snapshots[f.introduced].date}
                    </small>
                    <blockquote>{f.passage}</blockquote>
                    <small>
                      Source validity:{" "}
                      {f.validFrom
                        ? `${f.validFrom} → ${f.validTo || "open end"}`
                        : "not specified"}
                    </small>
                  </article>
                ))}
              </div>
            ) : (
              <p>
                No current assertions for this selection. A comparison may show
                a withdrawn relationship.
              </p>
            )}
          </section>
        )}
      </div>
    </section>
  );
}
