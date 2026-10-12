import {GraphNavigation} from "./GraphNavigation";
import type {RelationshipEditSeed} from './RelationshipEditor';
import { useCallback, useEffect, useRef, useState } from "react";
import {createPortal} from "react-dom";
import cytoscape, { type Core } from "cytoscape";
import { api } from "../storage/api";
import type { Mapping } from "./ConceptReview";
import "./knowledge.css";

type Concept = {
  id: string;
  label: string;
  attributes: { name: string; datatype: string }[];
};
type Predicate = {
  id: string;
  label: string;
  source: string;
  target: string;
  direction: string;
};
type Workspace = {
  alignments?: {id:string;source:string;target:string;kind:string}[];
  revision: string;
  concepts: Concept[];
  relationships: Predicate[];
  layers: { run: string; snapshot: string }[];
};
type Overview = {
  current: string | null;
  runs: { id: string; title: string; revision: string; supported: boolean }[];
  snapshots: {
    id: string;
    run_id: string;
    title: string;
    recorded_at: number;
    revision: string;
  }[];
  job?: { status: string; phase: string; snapshot?: string };
};
type Draft = {
  revision: string;
  mappings: Mapping[];
  groups: {
    source_class: string;
    source: string;
    columns: string[];
    samples: unknown[][];
  }[];
};
type RecordValue = {
  id: string;
  label: string;
  concept: string;
  concept_id: string;
  source: string;
  row: number;
  columns: string[];
  cells: unknown[];
};
type Assertion = {
  id: string;
  snapshot: string;
  run_id: string;
  run_title: string;
  relation: string;
  direction: string;
  subject: RecordValue;
  object: RecordValue;
  document: string;
  evidence: { text?: string; context_text?: string }[];
  endpoint_checks?: { quote: string; status: string }[];
  decision: { status: string; note?: string };
};
type Page = {
  items: Assertion[];
  total: number;
  offset: number;
  limit: number;
};

function fitSchema(g: Core, padding = 50) {
  g.resize();
  g.fit(undefined, padding);
  if (g.zoom() > 1.2) g.zoom(1.2);
  // Changing zoom after fit leaves the old pan in place. Center only after
  // the final zoom is known, so small schemas do not drift toward a corner.
  g.center();
}

export function SchemaCanvas({
  workspace,
  onInspect,
  onEdit,
  editControlsHost,
  onEditingChange,
}: {
  workspace: Workspace;
  onInspect: (concept: string, relationship: string) => void;
  onEdit?: (seed: RelationshipEditSeed) => void;
  editControlsHost?: HTMLElement | null;
  onEditingChange?: (enabled:boolean)=>void;
}) {
  const [editing,setEditing]=useState(false),[editEdges,setEditEdges]=useState<string[]>([]),[editConcepts,setEditConcepts]=useState<string[]>([]);
  const editRef=useRef(editing);editRef.current=editing;
  useEffect(()=>{setEditEdges([]);setEditConcepts([]);},[workspace.revision]);
  const [wide,setWide]=useState(false);
  const expandButton=useRef<HTMLButtonElement>(null);
  const panel=useRef<HTMLElement>(null);
  useEffect(()=>{
    if(!wide)return;
    const previous=document.body.style.overflow;document.body.style.overflow='hidden';
    panel.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const key=(event:KeyboardEvent)=>{
      if(event.key==='Escape'){event.preventDefault();setWide(false);}
      if(event.key==='Tab'){
        const controls=[...panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled),[tabindex="0"]')||[]].filter(e=>e.getClientRects().length);
        const first=controls[0],last=controls[controls.length-1];
        if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
        else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
      }
    };
    document.addEventListener('keydown',key);
    return()=>{document.body.style.overflow=previous;document.removeEventListener('keydown',key);expandButton.current?.focus();};
  },[wide]);
  const host = useRef<HTMLDivElement>(null);
  const cy = useRef<Core | undefined>(undefined);
  const [expanded, setExpanded] = useState("");
  const [within, setWithin] = useState("");
  const internal = workspace.relationships.filter(p => p.source === p.target);
  const hierarchyLike = (label: string) => /^(IS_A_TYPE_OF|SUBCLASS_OF|IS_A_SUBTYPE_OF|TYPE_OF)$/.test(label.toUpperCase().replace(/[ -]+/g, "_"));
  useEffect(() => {
    if (!host.current) return;
    const nodes = workspace.concepts.map((c, i) => ({
      data: { id: c.id, label: c.label, kind: "concept" },
      position: { x: 150 + (i % 3) * 360, y: 120 + Math.floor(i / 3) * 280 },
    }));
    const g = cytoscape({
      container: host.current,
      elements: [
        ...nodes,
        ...(workspace.alignments||[]).map(a=>({data:{...a,kind:"alignment",label:a.kind==="subclass"?"subclass of":"equivalent class",direction:a.kind==="subclass"?"directed":"unspecified"}})),
        ...workspace.relationships.filter(p => p.source !== p.target).map((p) => ({
          data: { ...p, kind: "relationship" },
        })),
        ...workspace.concepts.flatMap(c => {
          const count = workspace.relationships.filter(p => p.source === c.id && p.target === c.id).length;
          return count ? [{data: {id: 'within-'+c.id, source:c.id, target:c.id, kind:'within', direction:'unspecified', label: `${count} relationships within ${c.label}`}}] : [];
        }),
      ],
      layout: { name: "preset" },
      minZoom: 0.15,
      maxZoom: 3,
      style: [
        {
          selector: "node",
          style: {
            "background-color": "#3b4cca",
            "border-color": "#283593",
            "border-width": 2,
            color: "#ffffff",
            label: "data(label)",
            "text-valign": "center",
            "text-halign": "center",
            "font-size": 15,
            "font-weight": 600,
            "text-wrap": "wrap",
            "text-max-width": "150px",
            width: 170,
            height: 64,
            shape: "round-rectangle",
          },
        },
        {
          selector: 'node[kind="attribute"]',
          style: {
            shape: "ellipse",
            width: 130,
            height: 45,
            "background-color": "#ccfbf1",
            "border-color": "#0f766e",
            "font-size": 13,
            "font-weight": 600,
          },
        },
        {
          selector: "edge",
          style: {
            "curve-style": "bezier",
            "control-point-step-size": 65,
            "line-color": "#7c3aed",
            "target-arrow-color": "#7c3aed",
            "target-arrow-shape": "triangle",
            label: "data(label)",
            "font-size": 13,
            "font-weight": 600,
            color: "#4c1d95",
            "text-background-color": "#fff",
            "text-background-opacity": 1,
            width: 2,
            "text-background-padding": "3px",
            "loop-direction": "-35deg",
            "loop-sweep": "60deg",
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
            "source-arrow-color": "#7c3aed",
          },
        },
        {
          selector: 'edge[kind="attribute"]',
          style: {
            "target-arrow-shape": "none",
            "line-style": "dashed",
            "line-color": "#0f766e",
          },
        },
        {selector: 'edge[kind="alignment"]',style:{"line-color":"#369786","target-arrow-color":"#369786","color":"#267769","line-style":"dotted","width":2}},
      ],
    });
    cy.current = g;
    fitSchema(g, 60);
    g.on("tap", 'node[kind="concept"]', (e) => {
      if(editRef.current) setEditConcepts(old=>old.includes(e.target.id())?old.filter(id=>id!==e.target.id()):[...old,e.target.id()]);
      else setExpanded(old=>old===e.target.id()?"":e.target.id());
    });
    g.on("tap", 'edge[kind="relationship"]', (e) => {
      if(editRef.current)setEditEdges(old=>old.includes(e.target.id())?old.filter(id=>id!==e.target.id()):[...old,e.target.id()]);
      else onInspect("",e.target.id());
    });
    g.on("tap", 'edge[kind="within"]', e => setWithin(e.target.data('source')));
    let width = g.width(), height = g.height();
    const observer = new ResizeObserver(() => {
      const pan = g.pan();
      g.resize();
      // Keep the point at the viewport center stable when the panel resizes,
      // without discarding the user's zoom or pan.
      g.pan({ x: pan.x + (g.width() - width) / 2,
              y: pan.y + (g.height() - height) / 2 });
      width = g.width(); height = g.height();
    });
    observer.observe(host.current);
    const applyTheme = () => {
      const dark =
        document.documentElement.getAttribute("data-theme") === "dark";
      g.style()
        .selector('node[kind="concept"]')
        .style({
          "background-color": dark ? "#4355b9" : "#3b4cca",
          "border-color": dark ? "#a5b4fc" : "#283593",
          color: "#ffffff",
        })
        .selector('node[kind="attribute"]')
        .style({
          "background-color": dark ? "#164e48" : "#ccfbf1",
          "border-color": dark ? "#5eead4" : "#0f766e",
          color: dark ? "#f0fdfa" : "#134e4a",
        })
        .selector("edge")
        .style({
          "line-color": dark ? "#c4b5fd" : "#7c3aed",
          "source-arrow-color": dark ? "#c4b5fd" : "#7c3aed",
          "target-arrow-color": dark ? "#c4b5fd" : "#7c3aed",
          "text-background-color": dark ? "#172337" : "#ffffff",
          color: dark ? "#ede9fe" : "#4c1d95",
        })
        .selector('edge[kind="attribute"], edge[kind="alignment"]')
        .style({
          "line-color": dark ? "#5eead4" : "#0f766e",
          "target-arrow-color": dark ? "#5eead4" : "#0f766e",
          color: dark ? "#ccfbf1" : "#115e59",
        })
        .update();
    };
    applyTheme();
    const themeObserver = new MutationObserver(applyTheme);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => {
      observer.disconnect();
      themeObserver.disconnect();
      g.destroy();
      cy.current = undefined;
    };
  }, [workspace.revision, onInspect]);
  useEffect(() => {
    const g = cy.current;
    if (!g) return;
    g.elements('[kind="attribute"]').remove();
    const c = workspace.concepts.find((c) => c.id === expanded);
    if (!c) { fitSchema(g); return; }
    const pos = g.getElementById(c.id).position();
    const radius = Math.max(160, (c.attributes.length * 145) / (2 * Math.PI));
    c.attributes.forEach((a, i) => {
      const angle = -Math.PI / 2 + (i * 2 * Math.PI) / c.attributes.length;
      const id = `attr-${c.id}-${i}`;
      g.add([
        {
          data: { id, label: `${a.name}\n${a.datatype}`, kind: "attribute" },
          position: {
            x: pos.x + radius * Math.cos(angle),
            y: pos.y + radius * Math.sin(angle),
          },
        },
        {
          data: {
            id: `link-${id}`,
            source: c.id,
            target: id,
            kind: "attribute",
          },
        },
      ]);
    });
    fitSchema(g, 45);
  }, [expanded, workspace.revision]);
  useEffect(()=>{
    const g=cy.current;if(!g)return;
    g.elements().removeClass('edit-picked');
    g.style().selector('node.edit-picked').style({'border-color':'#f97316','border-width':5}).selector('edge.edit-picked').style({'line-color':'#f97316','source-arrow-color':'#f97316','target-arrow-color':'#f97316','width':5}).update();
    if(editing){editEdges.forEach(id=>g.getElementById(id).addClass('edit-picked'));editConcepts.forEach(id=>g.getElementById(id).addClass('edit-picked'));}
  },[editEdges,editConcepts,editing,workspace.revision]);
  const editPairs = new Set(workspace.relationships.filter(e=>editEdges.includes(e.id)).map(e=>[e.source,e.target].sort().join('|')));
  const compatibleMerge = editEdges.length>=2 && editPairs.size===1;
  function launchEdit(operation:string){setWide(false);onEdit?.({operation,edges:editEdges,source:editConcepts[0],target:editConcepts[1]});}
  const editingControls=onEdit&&<div className="kg-schema-picking-controls">
    <button aria-pressed={editing} onClick={()=>{setEditing(!editing);onEditingChange?.(!editing);setEditEdges([]);setEditConcepts([]);}}>{editing?"Finish graph picking":"Edit on graph"}</button>
      {editing&&<div className="kg-schema-edit-toolbar" aria-label="Visual relationship editing">
        <span>Click connections or concepts to pick/unpick · {editEdges.length} connection{editEdges.length===1?"":"s"} · {editConcepts.length} concept{editConcepts.length===1?"":"s"}</span>
        <button disabled={editEdges.length!==1} onClick={()=>launchEdit('rename')}>Rename / reclassify</button>
        <button disabled={!compatibleMerge} title={editEdges.length>=2&&!compatibleMerge?'Choose connections between the same two concepts':undefined} onClick={()=>launchEdit('merge')}>Merge connections</button>
        <button disabled={editEdges.length!==1} onClick={()=>launchEdit('remove')}>Remove connection</button>
        <button disabled={editConcepts.length!==2} onClick={()=>launchEdit('add')}>Add relationship</button>
        {editEdges.length>=2&&!compatibleMerge&&<small>Merge requires connections between the same two concepts.</small>}
        <button disabled={!editEdges.length&&!editConcepts.length} onClick={()=>{setEditEdges([]);setEditConcepts([]);}}>Clear picks</button>
      </div>}
  </div>;
  return (
    <section ref={panel} className={"kg-canvas-panel"+(wide?" kg-canvas-expanded":"")} role={wide?"dialog":undefined} aria-modal={wide?true:undefined} aria-label={wide?"Expanded schema graph":undefined}>
      <div className="kg-canvas-toolbar">
        <div>
          <strong>Shared schema · T-Box</strong>
          <small>
            Concepts and integrated relationships · click a concept to
            expand attributes
          </small>
        </div>
        <GraphNavigation getGraph={()=>cy.current} wide={wide} onToggle={()=>setWide(v=>!v)} expandButton={expandButton}/>

      </div>
      {editingControls&&(editControlsHost&&!wide?createPortal(editingControls,editControlsHost):editingControls)}
      <div
        ref={host}
        className="kg-real-canvas"
        aria-label="Shared conceptual schema"
      />
      {!workspace.concepts.length && (
        <p className="kg-real-empty">
          Choose an Integration run with materialized relationships to see its schema.
        </p>
      )}
      {internal.length > 0 && <section className="kg-within-panel" aria-label="Relationships within concepts">
        <div className="kg-within-buttons">{workspace.concepts.filter(c => internal.some(p => p.source === c.id)).map(c => <button key={c.id} aria-expanded={within === c.id} onClick={() => setWithin(within === c.id ? "" : c.id)}>{internal.filter(p => p.source === c.id).length} relationships within {c.label}</button>)}</div>
        {internal.some(p => p.source === within) && <div>
          <p>These relationships connect different records classified under the same concept. Select a relationship to inspect the records and evidence.</p>
          <div className="kg-relationship-items">{internal.filter(p => p.source === within).map(p => <button key={p.id} aria-pressed={editing ? editEdges.includes(p.id) : undefined} onClick={() => editing ? setEditEdges(old=>old.includes(p.id)?old.filter(id=>id!==p.id):[...old,p.id]) : (setWide(false),onInspect("", p.id))}><strong>{p.label}</strong><small>{hierarchyLike(p.label) ? 'Hierarchy-like label · not a validated subclass axiom' : 'Relationship within this concept'} · {editing ? 'Pick relationship' : 'Inspect instances →'}</small></button>)}</div>
          <p>Hierarchy-like labels come from Integration. They require semantic review before being interpreted as subclass axioms.</p>
        </div>}
      </section>}
      <div className="kg-concept-actions">
        {workspace.concepts.map((c) => (
          <button
            key={"expand-" + c.id}
            aria-expanded={expanded === c.id}
            onClick={() => setExpanded(expanded === c.id ? "" : c.id)}
          >
            Attributes of {c.label}
          </button>
        ))}
        {workspace.concepts.map((c) => (
          <button key={c.id} onClick={() => (setWide(false),onInspect(c.id, ""))}>
            Explore {c.label} instances
          </button>
        ))}
      </div>
      <div className="kg-relationship-items">
        {workspace.relationships.filter(p => p.source !== p.target).map((p) => (
          <button key={p.id} aria-pressed={editing ? editEdges.includes(p.id) : undefined} onClick={() => editing ? setEditEdges(old=>old.includes(p.id)?old.filter(id=>id!==p.id):[...old,p.id]) : (setWide(false),onInspect("", p.id))}>
            <strong>{p.label}</strong>
            <small>
              {workspace.concepts.find((c) => c.id === p.source)?.label}{" "}
              {p.direction === "directed"
                ? "→"
                : p.direction === "bidirectional"
                  ? "↔"
                  : "—"}{" "}
              {workspace.concepts.find((c) => c.id === p.target)?.label}
            </small>
          </button>
        ))}
      </div>
    </section>
  );
}

export function KnowledgeGraph({
  lakeId,
  lakeName,
}: {
  lakeId: string;
  lakeName: string;
}) {
  // Remount all requests and selections at lake boundaries.
  return <WorkspaceView key={lakeId} lakeId={lakeId} lakeName={lakeName} />;
}
function WorkspaceView({
  lakeId,
  lakeName,
}: {
  lakeId: string;
  lakeName: string;
}) {
  const [tab, setTab] = useState("Sources");
  const [overview, setOverview] = useState<Overview>();
  const [workspace, setWorkspace] = useState<Workspace>();
  const [run, setRun] = useState("");
  const [sid, setSid] = useState("");
  const [draft, setDraft] = useState<Draft>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [epoch, setEpoch] = useState(0);
  const [status, setStatus] = useState("pending");
  const [concept, setConcept] = useState("");
  const [relationship, setRelationship] = useState("");
  const [runFilter, setRunFilter] = useState("");
  const [offset, setOffset] = useState(0);
  const [page, setPage] = useState<Page>();
  const [selected, setSelected] = useState<Assertion>();
  const [note, setNote] = useState("");
  const send = <T,>(path: string, body: unknown) =>
    api<T>(
      "/knowledge/" + path,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
      lakeId,
    );
  useEffect(() => {
    let active = true;
    const refresh = () =>
      Promise.all([
        api<Overview>("/knowledge", undefined, lakeId),
        api<Workspace>("/knowledge/workspace", undefined, lakeId),
      ])
        .then(([o, w]) => {
          if (active) {
            setOverview(o);
            setWorkspace((old) =>
              old?.revision === w.revision &&
              JSON.stringify(old.layers) === JSON.stringify(w.layers)
                ? old
                : w,
            );
          }
        })
        .catch((e) => active && setError(String(e)));
    void refresh();
    const t = setInterval(() => void refresh(), 3000);
    return () => {
      active = false;
      clearInterval(t);
    };
  }, [lakeId, epoch]);
  useEffect(() => {
    if (overview?.job?.status === "completed" && overview.job.snapshot) {
      const s = overview.snapshots.find((s) => s.id === overview.job?.snapshot);
      if (s?.run_id === run) setSid(s.id);
    }
  }, [overview?.job?.status, overview?.job?.snapshot, run]);
  useEffect(() => {
    let active = true;
    setDraft(undefined);
    if (sid)
      api<Draft>(`/knowledge/snapshots/${sid}/schema`, undefined, lakeId)
        .then((d) => active && setDraft(d))
        .catch((e) => active && setError(String(e)));
    return () => {
      active = false;
    };
  }, [sid, lakeId, overview?.job?.status]);
  useEffect(() => {
    let active = true;
    setPage(undefined);
    setSelected(undefined);
    setNote("");
    if (tab === "Instances" || tab === "Review") {
      const q = new URLSearchParams({
        status: tab === "Instances" ? "accepted" : status,
        offset: String(offset),
        concept,
        relationship,
        run: runFilter,
      });
      api<Page>("/knowledge/workspace/assertions?" + q, undefined, lakeId)
        .then((p) => active && setPage(p))
        .catch((e) => active && setError(String(e)));
    }
    return () => {
      active = false;
    };
  }, [tab, status, offset, concept, relationship, runFilter, lakeId, epoch]);
  const action = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
      setEpoch((e) => e + 1);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };
  const inspect = useCallback((c: string, p: string) => {
    setConcept(c);
    setRelationship(p);
    setOffset(0);
    setTab("Instances");
  }, []);
  const chooseRun = (id: string) => {
    setRun(id);
    setSid(
      overview?.snapshots
        .filter((s) => s.run_id === id)
        .sort((a, b) => b.recorded_at - a.recorded_at)[0]?.id || "",
    );
  };
  const changeMapping = (index: number, update: Partial<Mapping>) =>
    setDraft((d) =>
      d
        ? {
            ...d,
            mappings: d.mappings.map((m, i) =>
              i === index ? { ...m, ...update } : m,
            ),
          }
        : d,
    );
  const running = overview?.job?.status === "running";
  return (
    <section className="kg kg-workspace">
      <header className="kg-heading">
        <div>
          <span className="kg-eyebrow">KNOWLEDGE GRAPH · {lakeName}</span>
          <h2>
            One shared schema. <em>Connected instances.</em>
          </h2>
          <p>
            Map your sources, review their evidence, then explore records
            through shared concepts.
          </p>
        </div>
      </header>
      <nav className="kg-steps" aria-label="Knowledge workspace views">
        {["Sources", "Schema", "Review", "Instances"].map((name, i) => (
          <button
            key={name}
            aria-selected={tab === name}
            className={tab === name ? "active" : ""}
            onClick={() => {
              setTab(name);
              setOffset(0);
              setConcept("");
              setRelationship("");
            }}
          >
            <span>{String(i + 1).padStart(2, "0")}</span>
            <div>
              <strong>{name}</strong>
              <small>
                {
                  [
                    "Map runs to concepts",
                    "Global T-Box",
                    "Validate assertions",
                    "Explore the A-Box",
                  ][i]
                }
              </small>
            </div>
          </button>
        ))}
      </nav>
      {error && (
        <p role="alert" className="kg-real-notice">
          {error}
        </p>
      )}
      {tab === "Sources" && (
        <>
          <p className="kg-flow-guide">
            Prepare a run → map its records to shared concepts → review
            assertions. Preparing or mapping a run does not accept its
            relationships.
          </p>
          <section className="kg-real-panel">
            <div className="kg-source-controls">
              <label>
                Integration run
                <select value={run} onChange={(e) => chooseRun(e.target.value)}>
                  <option value="">Choose a saved run</option>
                  {overview?.runs.map((r) => (
                    <option key={r.id} value={r.id} disabled={!r.supported}>
                      {r.title}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="kg-primary"
                disabled={!run || busy || running}
                onClick={() =>
                  void action(async () => {
                    const r = overview!.runs.find((r) => r.id === run)!;
                    await send("build", {
                      run_id: run,
                      revision: r.revision,
                      expected_parent: overview!.current,
                    });
                  })
                }
              >
                Prepare current run
              </button>
              {running && (
                <>
                  <span role="status">{overview?.job?.phase}</span>
                  <button onClick={() => void action(() => send("cancel", {}))}>
                    Cancel
                  </button>
                </>
              )}
            </div>
            {overview?.job?.status === "failed" && (
              <p role="alert">{overview.job.phase}</p>
            )}
            {draft && workspace && (
              <>
                <h3>Map source groups to concepts</h3>
                <button
                  disabled={busy || running}
                  onClick={() =>
                    void action(async () => {
                      const saved = await send<Draft>(
                        `snapshots/${sid}/schema-save`,
                        { revision: draft.revision, mappings: draft.mappings },
                      );
                      setDraft(saved);
                      await send(`snapshots/${sid}/schema-suggest`, {
                        revision: saved.revision,
                      });
                    })
                  }
                >
                  Suggest concepts with configured LLM
                </button>
                <p>
                  Use an existing concept name to explicitly reuse its schema
                  across runs. Records remain separate. Review the example
                  values before mapping.
                </p>
                <datalist id="kg-shared-concepts">
                  {workspace.concepts.map((c) => (
                    <option key={c.id} value={c.label} />
                  ))}
                </datalist>
                <div className="kg-mapping-grid">
                  {draft.mappings.map((m, i) => {
                    const g = draft.groups.find(
                      (g) => g.source_class === m.source_class,
                    )!;
                    return (
                      <article className="kg-source-card" key={m.source_class}>
                        <strong>{g.source}</strong>
                        <label>
                          Shared concept
                          <input
                            list="kg-shared-concepts"
                            value={m.concept}
                            onChange={(e) =>
                              changeMapping(i, { concept: e.target.value })
                            }
                          />
                        </label>
                        <label>
                          Record label
                          <select
                            value={m.label_column}
                            onChange={(e) =>
                              changeMapping(i, {
                                label_column: Number(e.target.value),
                              })
                            }
                          >
                            {g.columns.map((c, j) => (
                              <option key={j} value={j}>
                                {c}
                              </option>
                            ))}
                          </select>
                        </label>
                        <div className="kg-record-scroll">
                          <table>
                            <thead>
                              <tr>
                                {g.columns.map((c, j) => (
                                  <th key={j}>{c}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {g.samples.map((r, j) => (
                                <tr key={j}>
                                  {r.map((v, k) => (
                                    <td key={k}>{String(v ?? "—")}</td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <details>
                          <summary>
                            Attributes ·{" "}
                            {m.attributes.filter((a) => a.included).length}{" "}
                            included
                          </summary>
                          {m.attributes.map((a, j) => (
                            <label className="kg-attribute-edit" key={j}>
                              <input
                                type="checkbox"
                                checked={a.included}
                                onChange={(e) =>
                                  changeMapping(i, {
                                    attributes: m.attributes.map((v, k) =>
                                      k === j
                                        ? { ...v, included: e.target.checked }
                                        : v,
                                    ),
                                  })
                                }
                              />
                              <input
                                aria-label="Attribute name"
                                value={a.name}
                                onChange={(e) =>
                                  changeMapping(i, {
                                    attributes: m.attributes.map((v, k) =>
                                      k === j
                                        ? { ...v, name: e.target.value }
                                        : v,
                                    ),
                                  })
                                }
                              />
                              <select
                                aria-label="Attribute type"
                                value={a.datatype}
                                onChange={(e) =>
                                  changeMapping(i, {
                                    attributes: m.attributes.map((v, k) =>
                                      k === j
                                        ? { ...v, datatype: e.target.value }
                                        : v,
                                    ),
                                  })
                                }
                              >
                                {[
                                  "string",
                                  "number",
                                  "boolean",
                                  "date",
                                  "unknown",
                                ].map((t) => (
                                  <option key={t}>{t}</option>
                                ))}
                              </select>
                            </label>
                          ))}
                        </details>
                      </article>
                    );
                  })}
                </div>
                <button
                  className="kg-primary"
                  disabled={busy || running}
                  onClick={() =>
                    void action(async () => {
                      await send("workspace/map", {
                        snapshot: sid,
                        mappings: draft.mappings,
                        revision: workspace.revision,
                      });
                      setTab("Review");
                      setOffset(0);
                    })
                  }
                >
                  Confirm mappings & review assertions
                </button>
              </>
            )}
          </section>
          <p>
            {workspace?.layers.length || 0} run contributions mapped. Previously
            prepared snapshots remain source provenance; they are not
            automatically accepted knowledge.
          </p>
          <div className="kg-source-controls">
            {workspace?.layers.map((layer) => (
              <button
                key={layer.run}
                disabled={busy}
                onClick={() => {
                  if (
                    window.confirm(
                      "Remove this run contribution and its graph review decisions? The Integration run and source snapshots will remain.",
                    )
                  ) {
                    void action(() =>
                      send("workspace/remove", {
                        run: layer.run,
                        revision: workspace.revision,
                      }),
                    );
                  }
                }}
              >
                Remove contribution ·{" "}
                {overview?.runs.find((r) => r.id === layer.run)?.title ||
                  "Saved run"}
              </button>
            ))}
          </div>
        </>
      )}
      {tab === "Schema" && workspace && (
        <SchemaCanvas workspace={workspace} onInspect={inspect} />
      )}
      {(tab === "Instances" || tab === "Review") && (
        <section className="kg-real-panel">
          <div className="kg-canvas-toolbar">
            <div>
              <strong>
                {tab === "Instances" ? "Instances · A-Box" : "Assertion review"}
              </strong>
              <small>
                {tab === "Instances"
                  ? "Reviewed records and relationships, with source evidence. Record identities are preserved."
                  : "Check both endpoints and the passage. An Integration label alone is not an accepted fact."}
              </small>
            </div>
          </div>
          <div className="kg-source-controls">
            {tab === "Review" && (
              <label>
                State
                <select
                  value={status}
                  onChange={(e) => {
                    setStatus(e.target.value);
                    setOffset(0);
                  }}
                >
                  {["pending", "rejected", "accepted"].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
            )}
            <label>
              Concept
              <select
                value={concept}
                onChange={(e) => {
                  setConcept(e.target.value);
                  setOffset(0);
                }}
              >
                <option value="">All concepts</option>
                {workspace?.concepts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Run layer
              <select
                value={runFilter}
                onChange={(e) => {
                  setRunFilter(e.target.value);
                  setOffset(0);
                }}
              >
                <option value="">All mapped runs</option>
                {overview?.runs
                  .filter((r) => workspace?.layers.some((l) => l.run === r.id))
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.title}
                    </option>
                  ))}
              </select>
            </label>
            {relationship && (
              <button
                onClick={() => {
                  setRelationship("");
                  setOffset(0);
                }}
              >
                Clear relationship filter
              </button>
            )}
            <span>
              {page
                ? `${page.total} assertions · page ${Math.floor(offset / 25) + 1} of ${Math.max(1, Math.ceil(page.total / 25))}`
                : "Loading…"}
            </span>
            <button
              disabled={!offset || busy}
              onClick={() => setOffset(Math.max(0, offset - 25))}
            >
              Previous
            </button>
            <button
              disabled={!page || offset + 25 >= page.total || busy}
              onClick={() => setOffset(offset + 25)}
            >
              Next
            </button>
          </div>
          {page?.total === 0 && (
            <p className="kg-real-empty">
              {tab === "Instances"
                ? "No accepted assertions match this selection. Review pending assertions to populate the instance explorer."
                : "No assertions in this selection. Map a prepared run in Sources to begin."}
            </p>
          )}
          <div className="kg-abox-layout">
            <div className="kg-assertion-list">
              {page?.items.map((a) => (
                <button
                  key={a.snapshot + a.id}
                  aria-pressed={selected?.id === a.id}
                  onClick={() => {
                    setSelected(a);
                    setNote(a.decision.note || "");
                  }}
                >
                  <strong>
                    {a.subject.label} <span>· {a.relation} ·</span>{" "}
                    {a.object.label}
                  </strong>
                  <small>
                    {a.subject.concept} → {a.object.concept} · {a.run_title}
                  </small>
                  {(a.endpoint_checks?.some(
                    (c) => c.status === "needs_review",
                  ) ||
                    a.subject.concept_id === a.object.concept_id) && (
                    <small>Review endpoint compatibility</small>
                  )}
                </button>
              ))}
            </div>
            {selected ? (
              <article className="kg-assertion-detail">
                <h3>{selected.relation}</h3>
                <p>
                  {selected.direction} · {selected.decision.status} ·{" "}
                  {selected.run_title}
                </p>
                <div className="kg-mapping-grid">
                  {[selected.subject, selected.object].map((r, i) => (
                    <div key={i}>
                      <h4>
                        {i ? "Object" : "Subject"} · {r.concept}
                      </h4>
                      <small>
                        {r.source} · row {r.row}
                      </small>
                      <dl>
                        {r.columns.map((c, j) => (
                          <div key={j}>
                            <dt>{c}</dt>
                            <dd>{String(r.cells[j] ?? "—")}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  ))}
                </div>
                <h4>Evidence · {selected.document}</h4>
                {selected.evidence.map((e, i) => (
                  <blockquote key={i}>{e.context_text || e.text}</blockquote>
                ))}
                {selected.endpoint_checks?.map((c, i) => (
                  <p key={i}>
                    Endpoint quote: “{c.quote}” ·{" "}
                    {c.status === "needs_review"
                      ? "No lexical overlap with the record"
                      : "Lexical overlap only; meaning still requires review"}
                  </p>
                ))}
                {tab === "Review" && (
                  <>
                    <label>
                      Review explanation
                      <textarea
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="Explain ambiguous endpoints, direction, or a relationship within the same concept."
                      />
                    </label>
                    <p>
                      Accepting confirms these endpoints and creates or reuses
                      the displayed concept–relationship signature in the shared
                      schema. Incorrect endpoints should be rejected and
                      corrected in Integration.
                    </p>
                    <div className="kg-source-controls">
                      {["accepted", "rejected", "pending"].map((s) => (
                        <button
                          key={s}
                          className={s === "accepted" ? "kg-primary" : ""}
                          disabled={busy || s === selected.decision.status}
                          onClick={() =>
                            void action(async () => {
                              await send("workspace/review", {
                                revision: workspace?.revision,
                                snapshot: selected.snapshot,
                                assertion: selected.id,
                                status: s,
                                note,
                              });
                              setSelected(undefined);
                            })
                          }
                        >
                          {s === "accepted"
                            ? "Accept assertion & schema relation"
                            : s === "rejected"
                              ? "Reject"
                              : "Return to pending"}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </article>
            ) : (
              <p className="kg-real-empty">
                Select an assertion to inspect its records and evidence.
              </p>
            )}
          </div>
        </section>
      )}
    </section>
  );
}
