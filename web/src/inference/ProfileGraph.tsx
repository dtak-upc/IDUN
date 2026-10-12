import {useEffect,useMemo,useRef,useState} from 'react';
import {api,post} from '../storage/api';
import './profile-graph.css';

type Recipe={mode:'all'|'query'|'explicit';search?:string;min_score?:number;top_documents?:number;top_tables?:number;tables?:string[];documents?:string[];pairs?:string[];include?:string[];exclude?:string[]};
type Pair={id:string;table:string;text:string;table_name:string;document_name:string;score:number;selected?:boolean;semantic_similarity?:number;shared_terms:string[];evidence?:{preview:string;row_index?:number;start?:number;end?:number}};
type Counts={pairs:number;tables:number;documents:number;shared_documents:number};
type Result={graph:{generation:string;edges:number;isolated_sources:number;notice:string};items:Pair[];counts:Counts;selection_counts:Counts;next_cursor:unknown};
type Source={asset_id:string;name:string;kind:string;records?:number;degree?:number;issues?:string[];columns?:{name:string;type:string;missing?:number}[];coverage?:{indexed_units:number;available_units:number};terms?:{term:string}[]};
const ALL:Recipe={mode:'all'};
export function ProfileGraph({lakeId,revision}:{lakeId:string;revision?:string}){
  const key=`idun:graph-draft:${lakeId}`;
  const [reload,setReload]=useState(0);const inventoryEpoch=useRef(0);
  const [result,setResult]=useState<Result>();const[generation,setGeneration]=useState('');
  const [sort,setSort]=useState<'asc'|'desc'>('desc');const [focusSort,setFocusSort]=useState<'asc'|'desc'>();
  const [page,setPage]=useState(0);const [pageCursors,setPageCursors]=useState<unknown[]>([undefined]);
  const [draft,setDraft]=useState<Recipe>(ALL);const[view,setView]=useState<Recipe>(ALL);
  const [undo,setUndo]=useState<Recipe[]>([]);const[redo,setRedo]=useState<Recipe[]>([]);
  const [search,setSearch]=useState('');const[min,setMin]=useState('0');const[k,setK]=useState('');const[direction,setDirection]=useState('top_documents');
  const [neighbors,setNeighbors]=useState<Result>();
  const [sources,setSources]=useState<Source[]>([]);const[after,setAfter]=useState<string|null>(null);const[inspected,setInspected]=useState<Source>();const[edge,setEdge]=useState<Pair>();
  const [picked,setPickedIds]=useState<string[]>([]);const pickedRecords=useRef(new Map<string,Pair>());const[error,setError]=useState('');const[busy,setBusy]=useState(false);const[stale,setStale]=useState(false);
  const [camera,setCamera]=useState({x:0,y:0,z:1});const[selectMode,setSelectMode]=useState(false);const[pickMode,setPickMode]=useState(false);const[box,setBox]=useState<{x:number;y:number;w:number;h:number}>();
  const filterTimer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
  const layout=useRef(new Map<string,{x:number;y:number}>());
  const epoch=useRef(0),inspection=useRef(0),viewport=useRef<HTMLDivElement>(null);
  const drag=useRef<{x:number;y:number;cx:number;cy:number;select:boolean}|undefined>(undefined);
  useEffect(()=>{let active=true;const token=++epoch.current;inventoryEpoch.current++;setBusy(true);setError('');layout.current=new Map();setResult(undefined);setSort('desc');setPage(0);setPageCursors([undefined]);setGeneration('');setUndo([]);setRedo([]);setPicked([]);setInspected(undefined);setEdge(undefined);setNeighbors(undefined);
    api<Result>('/profile/graph').then(async r=>{
      if(!active||token!==epoch.current)return;
      let initial=ALL,old=false;
      try{const saved=JSON.parse(localStorage.getItem(key)||'null');if(saved){old=saved.generation!==r.graph.generation;if(!old)initial=saved.recipe;}}catch{/* Ignore damaged browser state. */}
      const inventory=await api<{items:Source[];next_after:string|null}>(`/profile/graph/nodes?generation=${r.graph.generation}`);
      if(!active||token!==epoch.current)return;
      setSources(inventory.items);setAfter(inventory.next_after);setGeneration(r.graph.generation);setDraft(initial);setView(ALL);setStale(old);
      const data=await post<Result>('/profile/graph/query',{generation:r.graph.generation,recipe:ALL,selection_recipe:initial,limit:12});
      if(active&&token===epoch.current){setResult(data);setCamera({x:0,y:0,z:1});}
    }).catch(e=>{if(active&&token===epoch.current)setError(e.message);}).finally(()=>{if(active&&token===epoch.current)setBusy(false);});
    return()=>{active=false;clearTimeout(filterTimer.current);epoch.current++;inspection.current++;inventoryEpoch.current++;};
  },[key,revision,reload]);
  useEffect(()=>{const el=viewport.current;if(!el)return;const wheel=(e:WheelEvent)=>{e.preventDefault();setCamera(c=>({...c,z:Math.max(.15,Math.min(5,c.z*Math.exp(-e.deltaY*.0015)))}));};el.addEventListener('wheel',wheel,{passive:false});return()=>el.removeEventListener('wheel',wheel);},[]);
  async function refresh(nextView=view,nextDraft=draft,cursor?:unknown,targetPage=0,nextSort=sort){clearTimeout(filterTimer.current);const token=++epoch.current;setBusy(true);setError('');try{
    const data=await post<Result>('/profile/graph/query',{generation,recipe:nextView,selection_recipe:nextDraft,sort:nextSort,limit:12,...(cursor?{cursor}:{})});
    if(token===epoch.current){layout.current=new Map();setResult(data);setSort(nextSort);setPage(targetPage);setPageCursors(previous=>targetPage===0?[undefined]:[...previous.slice(0,targetPage),cursor]);setView(nextView);setDraft(nextDraft);clearFocus();if(!stale)localStorage.setItem(key,JSON.stringify({generation,recipe:nextDraft}));return true;}return false;
  }catch(e){if(token===epoch.current)setError((e as Error).message);return false;}finally{if(token===epoch.current)setBusy(false);}}
  function applyFilters(values:{search?:string;min?:string;k?:string;direction?:string},delay=0){
    clearTimeout(filterTimer.current);
    const next={search,min,k,direction,...values};const score=Number(next.min),count=Number(next.k);
    epoch.current++;setBusy(false);
    if(!generation||next.min===''||!Number.isFinite(score)||score<0||score>1||(next.k!==''&&(!Number.isInteger(count)||count<1||count>1000000)))return;
    const recipe:Recipe={mode:'query',search:next.search,min_score:score,...(next.k?{[next.direction]:count}:{})};
    if(delay){setBusy(true);filterTimer.current=setTimeout(()=>void refresh(recipe),delay);}else void refresh(recipe);
  }
  async function changeDraft(next:Recipe){if(stale)return;if(await refresh(view,next)){setUndo(h=>[...h.slice(-19),draft]);setRedo([]);setPicked([]);}}
  function clearFocus(){inspection.current++;setFocusSort(undefined);setInspected(undefined);setEdge(undefined);setNeighbors(undefined);}
  function orderNeighbors(source:Source,pairs:Pair[],order:'asc'|'desc'){
    // Preserve the entire anchor lane; rank only the opposite lane.
    const x=source.kind==='csv'?730:210;
    const ranked=[...pairs].filter(p=>p.table===source.asset_id||p.text===source.asset_id).sort((a,b)=>(order==='asc'?a.score-b.score:b.score-a.score)||a.id.localeCompare(b.id));
    const ids=[...new Set(ranked.map(p=>source.kind==='csv'?p.text:p.table))];
    const previous=[...layout.current.entries()].filter(([,p])=>p.x===x).sort((a,b)=>a[1].y-b[1].y).map(([id])=>id);
    const next=new Map(layout.current);
    [...ids,...previous.filter(id=>!ids.includes(id))].forEach((id,i)=>next.set(id,{x,y:80+i*46}));
    layout.current=next;
  }
  async function inspectSource(id:string,order=focusSort||sort){const token=++inspection.current;setEdge(undefined);setNeighbors(undefined);try{
    const r=await api<{item:Source}>(`/profile/graph/nodes/${encodeURIComponent(id)}?generation=${generation}`);
    if(token!==inspection.current)return;setInspected(r.item);
    const related=await post<Result>('/profile/graph/query',{generation,recipe:{mode:'query',[r.item.kind==='csv'?'tables':'documents']:[id]},selection_recipe:draft,sort:order,limit:200});
    if(token===inspection.current){orderNeighbors(r.item,related.items,order);setNeighbors(related);}
  }catch(e){if(token===inspection.current)setError((e as Error).message);}}
  const localOrder=focusSort||sort;
  async function changeOrder(order:'asc'|'desc'){
    if(inspected){
      const token=++inspection.current;setBusy(true);setError('');
      try{
        const related=await post<Result>('/profile/graph/query',{generation,recipe:{mode:'query',[inspected.kind==='csv'?'tables':'documents']:[inspected.asset_id]},selection_recipe:draft,sort:order,limit:200});
        if(token===inspection.current){orderNeighbors(inspected,related.items,order);setFocusSort(order);setNeighbors(related);}
      }catch(e){if(token===inspection.current)setError(String(e));}
      finally{setBusy(false);}
    }else if(edge||picked.length){layout.current=new Map();setFocusSort(order);}
    else {setFocusSort(undefined);await refresh(view,draft,undefined,0,order);}
  }
  const displayed=useMemo(()=>[...new Map([...pickedRecords.current.values(),...(result?.items||[]),...(neighbors?.items||[])].map(p=>[p.id,p])).values()].sort((a,b)=>(localOrder==='asc'?a.score-b.score:b.score-a.score)||a.id.localeCompare(b.id)),[result,neighbors,localOrder,picked]);
  const focused=(p:Pair)=>edge?p.id===edge.id:!!inspected&&(p.table===inspected.asset_id||p.text===inspected.asset_id);
  const visibleEdges=inspected?displayed.filter(p=>focused(p)||picked.includes(p.id)):displayed;
  const pickable=(p:Pair)=>!inspected||focused(p);
  const focusedNodes=new Set(displayed.filter(focused).flatMap(p=>[p.table,p.text]));if(inspected)focusedNodes.add(inspected.asset_id);
  const hasFocus=!!edge||!!inspected;
  const nodes=useMemo(()=>{const map=new Map<string,Source>();for(const p of [...visibleEdges.filter(focused),...displayed]){if(!map.has(p.table))map.set(p.table,{asset_id:p.table,name:p.table_name,kind:'csv'});if(!map.has(p.text))map.set(p.text,{asset_id:p.text,name:p.document_name,kind:'txt'});}if(inspected)map.set(inspected.asset_id,inspected);return [...map.values()];},[displayed,inspected,edge,picked]);
  const positions=useMemo(()=>{
    const map=layout.current;
    for(const kind of ['csv','txt']){
      const x=kind==='csv'?210:730;
      let next=Math.max(-1,...[...map.values()].filter(p=>p.x===x).map(p=>(p.y-80)/46))+1;
      for(const n of nodes.filter(n=>n.kind===kind))if(!map.has(n.asset_id))map.set(n.asset_id,{x,y:80+next++*46});
    }
    return map;
  },[nodes]);
  function fit(){setCamera({x:0,y:0,z:Math.min(1,530/(Math.max(nodes.filter(n=>n.kind==='csv').length,nodes.filter(n=>n.kind==='txt').length)*46+100))});}
  function point(e:{clientX:number;clientY:number;currentTarget:SVGSVGElement}){const rect=e.currentTarget.getBoundingClientRect();return {x:(e.clientX-rect.left)*960/rect.width,y:(e.clientY-rect.top)*580/rect.height};}
  function setPicked(update:string[]|((previous:string[])=>string[])){
    const next=typeof update==='function'?update(picked):update;
    const available=new Map(displayed.map(p=>[p.id,p]));
    pickedRecords.current=new Map(next.flatMap(id=>{const pair=available.get(id)||pickedRecords.current.get(id);return pair?[[id,pair] as [string,Pair]]:[];}));
    setPickedIds(next);
  }
  function mark(id:string){const pair=displayed.find(p=>p.id===id);if(!pair||!pickable(pair))return;setPicked(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id]);}
  const locked=busy||stale||!result;
  return <section className="profile-graph" aria-label="Candidate graph explorer">
    <div className="pg-heading"><div><span className="pg-eyebrow">SOURCE EXPLORER</span><h2>Explore table–document links</h2><p>Follow the connections. Find the sources worth exploring together.</p></div><span className="pg-preview">Selection draft · commit in Review scope</span></div>
    {error&&<p role="alert">{error} <button disabled={busy} onClick={()=>setReload(n=>n+1)}>Reload graph</button></p>}
    {stale&&<div role="alert" className="pg-stale">Your saved selection belongs to an older profile. It has not been applied. <button disabled={busy} onClick={()=>{localStorage.setItem(key,JSON.stringify({generation,recipe:ALL}));setStale(false);void refresh(ALL,ALL);}}>Start a selection on this graph</button></div>}
    <form className="pg-filters" onSubmit={e=>{e.preventDefault();void refresh({mode:'query',search,min_score:Number(min),...(k?{[direction]:Number(k)}:{})});}}>
      <label>Find sources or shared terms<input value={search} maxLength={200} onChange={e=>{setSearch(e.target.value);applyFilters({search:e.target.value},250);}}/></label>
      <label>Minimum score<input type="number" required min={0} max={1} step=".01" value={min} onChange={e=>{setMin(e.target.value);applyFilters({min:e.target.value});}}/></label>
      <label>Top-K<input type="number" min={1} max={1000000} placeholder="All" value={k} onChange={e=>{setK(e.target.value);applyFilters({k:e.target.value});}}/></label>
      <label>Direction<select value={direction} onChange={e=>{setDirection(e.target.value);applyFilters({direction:e.target.value});}}><option value="top_documents">Documents per table</option><option value="top_tables">Tables per document</option></select></label>
      <label>Score order<select value={localOrder} disabled={busy||!generation} onChange={e=>void changeOrder(e.target.value as 'asc'|'desc')}><option value="desc">Highest score first</option><option value="asc">Lowest score first</option></select></label>
      <button type="button" disabled={busy||!generation} onClick={()=>{setSearch('');setMin('0');setK('');clearFocus();void refresh(ALL);}}>Show whole graph</button>
    </form>
    <details className="pg-filter-help"><summary>How filters work</summary><p className="pg-filter-note">{!k?'Top-K is All: direction has no effect. Choose a direction and enter a K value to filter immediately.':`Keep up to ${k} ${direction==='top_documents'?'documents for each table':'tables for each document'}.` } Filters update automatically. Search updates after a brief typing pause. Direction filters links; tables stay on the left and documents on the right.</p></details>
    <p className="pg-filter-note pg-applied" aria-live="polite">{busy?'Updating graph… · ':''}Applied view: {view.top_documents?`top ${view.top_documents} documents per table`:view.top_tables?`top ${view.top_tables} tables per document`:'no directional limit'} · {result?.counts.pairs??0} matching pairs · {localOrder==='desc'?'highest':'lowest'} score first{inspected?' within this source':picked.length?' within picked edges':edge?' for this pair':''}.</p>
    <div className="pg-layout">
    <aside className="pg-selection" aria-label="Discovery selection draft"><span className="pg-eyebrow">SELECTION DRAFT</span><div><strong>{stale?'Saved draft needs review':`${result?.selection_counts?.pairs??0} candidate pairs in draft`}</strong><p>{result?.selection_counts?.tables??0} tables · {result?.selection_counts?.documents??0} documents · {result?.selection_counts?.shared_documents??0} shared-document neighborhoods</p><small>{draft.mode==='all'?'Base: whole candidate graph':draft.mode==='query'?'Base: filter recipe (all matching pages)':'Base: explicitly picked pairs'} · {draft.include?.length||0} pins · {draft.exclude?.length||0} exclusions</small></div>
      <div className="pg-tools"><button disabled={locked||!result} onClick={()=>changeDraft(view)}>Use these filters as draft</button><button disabled={locked||!picked.length} onClick={()=>changeDraft({mode:'explicit',pairs:picked})}>Use picked pairs ({picked.length})</button><button disabled={locked||!picked.length} onClick={()=>changeDraft({...draft,include:[...new Set([...(draft.include||[]),...picked])],exclude:(draft.exclude||[]).filter(i=>!picked.includes(i))})}>Add picked</button><button disabled={locked||!picked.length} onClick={()=>changeDraft({...draft,exclude:[...new Set([...(draft.exclude||[]),...picked])]})}>Exclude picked</button><button disabled={locked} onClick={()=>changeDraft({mode:'explicit',pairs:[]})}>Clear draft</button><button disabled={locked} onClick={()=>changeDraft(ALL)}>Reset draft to whole graph</button><button disabled={locked||!undo.length} onClick={async()=>{const previous=undo[undo.length-1];if(await refresh(view,previous)){setUndo(h=>h.slice(0,-1));setRedo(h=>[...h,draft]);}}}>Undo</button><button disabled={locked||!redo.length} onClick={async()=>{const next=redo[redo.length-1];if(await refresh(view,next)){setRedo(h=>h.slice(0,-1));setUndo(h=>[...h,draft]);}}}>Redo</button></div>
      <p>Draft only. Continue to Review scope to commit these pairs for Discovery.</p>
    </aside>
    <div className="pg-main">
      <div className="pg-topbar">
      <div className="pg-zoom-controls"><div className="pg-tools"><button onClick={()=>setCamera(c=>({...c,z:Math.min(5,c.z*1.25)}))} aria-label="Zoom in">+</button><button onClick={()=>setCamera(c=>({...c,z:Math.max(.15,c.z/1.25)}))} aria-label="Zoom out">−</button><button onClick={fit}>Fit displayed links</button><button aria-pressed={selectMode} onClick={()=>{setSelectMode(!selectMode);setPickMode(false);}}>Rectangle pick</button><button aria-pressed={pickMode} onClick={()=>{setPickMode(!pickMode);setSelectMode(false);}}>Pick edges</button><button disabled={!hasFocus&&!picked.length} onClick={()=>{clearFocus();setPicked([]);setBox(undefined);drag.current=undefined;setSelectMode(false);setPickMode(false);}}>Clear focus</button></div><p className="pg-interaction-hint">Wheel to zoom · drag to pan · Ctrl/Cmd-click to pick multiple edges</p></div>
      <nav className="pg-pagination" aria-label="Graph pages">
        <div role="status"><strong>Page {result?.counts.pairs?page+1:0} of {Math.ceil((result?.counts.pairs||0)/12)}</strong><span>Pairs {result?.items.length?page*12+1:0}–{page*12+(result?.items.length||0)} of {result?.counts.pairs||0} matching pairs</span></div>
        <div className="pg-tools"><button disabled={busy||page===0} onClick={()=>refresh()}>First page</button><button disabled={busy||page===0} onClick={()=>refresh(view,draft,pageCursors[page-1],page-1)}>Previous links</button><button disabled={busy||!result?.next_cursor} onClick={()=>refresh(view,draft,result?.next_cursor,page+1)}>Next links →</button></div>
      </nav>
      </div>
      <div className="pg-viewport" ref={viewport}>
        <svg viewBox="0 0 960 580" preserveAspectRatio="none" role="img" aria-label="Bipartite graph: tables left and documents right"
          onPointerDown={e=>{if((e.target as Element).closest('[data-interactive]'))return;const p=point(e);drag.current={...p,cx:camera.x,cy:camera.y,select:selectMode};e.currentTarget.setPointerCapture(e.pointerId);}}
          onPointerMove={e=>{const d=drag.current;if(!d)return;const p=point(e);if(d.select)setBox({x:Math.min(d.x,p.x),y:Math.min(d.y,p.y),w:Math.abs(d.x-p.x),h:Math.abs(d.y-p.y)});else setCamera(c=>({...c,x:d.cx+p.x-d.x,y:d.cy+p.y-d.y}));}}
          onPointerUp={()=>{if(drag.current?.select&&box){const ids=visibleEdges.filter(p=>pickable(p)).filter(p=>{const a=positions.get(p.table)!,b=positions.get(p.text)!;const x=(a.x+b.x)/2*camera.z+camera.x,y=(a.y+b.y)/2*camera.z+camera.y;return x>=box.x&&x<=box.x+box.w&&y>=box.y&&y<=box.y+box.h;}).map(p=>p.id);setPicked(p=>[...new Set([...p,...ids])]);}drag.current=undefined;setBox(undefined);}}
          onPointerCancel={()=>{drag.current=undefined;setBox(undefined);}}>
          <text x="24" y="28" className="pg-lane">TABLES</text><text x="800" y="28" className="pg-lane">DOCUMENTS</text>
          <g transform={`translate(${camera.x} ${camera.y}) scale(${camera.z})`}>
            {visibleEdges.map(p=>{const a=positions.get(p.table)!,b=positions.get(p.text)!;return <g key={p.id} data-interactive="true" className={`pg-edge ${p.selected?'selected':''} ${picked.includes(p.id)?'picked':''} ${hasFocus?(focused(p)?'focused':'muted'):''}`} onClick={e=>{if(e.ctrlKey||e.metaKey||e.shiftKey||pickMode)mark(p.id);else{inspection.current++;setEdge(p);setInspected(undefined);}}}><path d={`M${a.x},${a.y} C470,${a.y} 470,${b.y} ${b.x},${b.y}`} strokeWidth={1+p.score*4}/><path className="pg-hit" d={`M${a.x},${a.y} C470,${a.y} 470,${b.y} ${b.x},${b.y}`} /><title>{p.table_name} ↔ {p.document_name}: {p.score.toFixed(3)}</title></g>;})}
            {displayed.filter(focused).map((p,i)=>{const a=positions.get(p.table)!,b=positions.get(p.text)!;const t=.35+(i%3)*.15;const x=(1-t)**3*a.x+3*(1-t)**2*t*470+3*(1-t)*t*t*470+t**3*b.x;const y=(1-t)**3*a.y+3*(1-t)**2*t*a.y+3*(1-t)*t*t*b.y+t**3*b.y;return <g className="pg-score" key={p.id} transform={`translate(${x} ${y})`}><rect x="-25" y="-11" width="50" height="22" rx="6"/><text textAnchor="middle" dy="4">{p.score.toFixed(3)}</text></g>;})}
            {nodes.map(n=>{const p=positions.get(n.asset_id);if(!p)return null;return <g key={n.asset_id} data-interactive="true" className={`pg-node ${n.kind} ${hasFocus?(focusedNodes.has(n.asset_id)?'focused':'muted'):''}`} transform={`translate(${p.x} ${p.y})`} onClick={()=>inspectSource(n.asset_id)}>{n.kind==='csv'?<rect className="pg-source-shape" x="-18" y="-12" width="36" height="24" rx="7"/>:<circle className="pg-source-shape" r="13"/>}
              <text className="pg-node-name" x={n.kind==='csv'?-28:24} textAnchor={n.kind==='csv'?'end':'start'} dy="4">{n.name.length>24?n.name.slice(0,21)+'…':n.name}</text>
              <title>{n.name}</title></g>;})}
          </g>{box&&<rect className="pg-box" x={box.x} y={box.y} width={box.w} height={box.h}/>}
        </svg>
      </div>
      {inspected&&neighbors&&<p>{neighbors.items.length} / {neighbors.counts.pairs} connected links loaded for {inspected.name}. {!!neighbors.next_cursor&&<button onClick={async()=>{const token=inspection.current;try{const next=await post<Result>('/profile/graph/query',{generation,recipe:{mode:'query',[inspected.kind==='csv'?'tables':'documents']:[inspected.asset_id]},selection_recipe:draft,sort:localOrder,limit:200,cursor:neighbors.next_cursor});if(token===inspection.current)setNeighbors(previous=>({...next,items:[...(previous?.items||[]),...next.items]}));}catch(e){if(token===inspection.current)setError(String(e));}}}>Load more connected links</button>}</p>}
      <div className="pg-pick-bar" aria-label="Edge picking"><strong>{picked.length} edges picked</strong><span>{pickMode?'Click edges to add or remove them.':selectMode?'Drag a rectangle across the edge midpoints.':inspected?'Pick this source’s connections. Earlier picks stay dimmed; unrelated links are hidden.':'Picks accumulate across sources and pages until cleared or applied.'}</span><button disabled={!visibleEdges.some(pickable)} onClick={()=>setPicked(previous=>[...new Set([...previous,...visibleEdges.filter(pickable).map(p=>p.id)])])}>{inspected?'Pick this source’s edges':'Pick displayed edges'}</button><button disabled={!picked.length} onClick={()=>setPicked([])}>Clear picks</button></div>
      <p className="pg-legend">■ Tables · ● Documents · thicker edges = higher profile score · teal = in draft · gold = picked. Click a node to see connected scores; click an edge for its score. Other links fade. Rectangle picks displayed edge midpoints.</p>
      <p className="pg-page-note"><small>12 pairs per page · Query-based drafts include all matching pages.{displayed.length>(result?.items.length||0)?` Focus and retained picks add ${displayed.length-(result?.items.length||0)} connected links outside this page.`:''}</small></p>
      <details className="pg-list"><summary>Ranked links · keyboard selection</summary><table><thead><tr><th>Pick</th><th>Table</th><th>Document</th><th>Score</th><th>Inspect</th></tr></thead><tbody>{(hasFocus?displayed.filter(p=>focused(p)||picked.includes(p.id)):picked.length?[...displayed.filter(p=>picked.includes(p.id)),...displayed.filter(p=>!picked.includes(p.id))]:displayed).map(p=><tr key={p.id}><td><input type="checkbox" aria-label={`Pick ${p.table_name} and ${p.document_name}`} disabled={!pickable(p)} checked={picked.includes(p.id)} onChange={()=>mark(p.id)}/></td><td>{p.table_name}</td><td>{p.document_name}</td><td>{p.score.toFixed(3)}{p.selected?' · selected':''}</td><td><button onClick={()=>{inspection.current++;setEdge(p);setInspected(undefined);}}>Inspect pair</button></td></tr>)}</tbody></table></details>
    </div><aside className="pg-inspector">
      <span className="pg-eyebrow">CONTEXT PANEL</span><h3>Inspect a source or link</h3><label>Source inventory<select value={inspected?.asset_id||''} onChange={e=>e.target.value&&inspectSource(e.target.value)}><option value="">Choose a source</option>{sources.map(n=><option key={n.asset_id} value={n.asset_id}>{n.name} · {n.degree===0?'isolated':`${n.degree} links`}</option>)}</select></label>
      {after&&<button onClick={async()=>{const token=++inventoryEpoch.current;try{const r=await api<{items:Source[];next_after:string|null}>(`/profile/graph/nodes?generation=${generation}&after=${encodeURIComponent(after)}`);if(token===inventoryEpoch.current){setSources(s=>[...new Map([...s,...r.items].map(n=>[n.asset_id,n])).values()]);setAfter(r.next_after);}}catch(e){if(token===inventoryEpoch.current)setError((e as Error).message);}}}>More sources</button>}
      {inspected&&<><h4>{inspected.name}</h4><p>{inspected.records??0} rows / text units</p><p>Indexed {inspected.coverage?.indexed_units??'—'} / {inspected.coverage?.available_units??'—'} units</p><p>{inspected.issues?.join(' · ')}</p><p>{inspected.terms?.map(t=>t.term).join(', ')}</p>{inspected.columns?.map(c=><p key={c.name}><strong>{c.name}</strong> · {c.type} · {c.missing??'—'} missing</p>)}<button disabled={busy} onClick={()=>refresh({mode:'query',[inspected.kind==='csv'?'tables':'documents']:[inspected.asset_id],...(k?{[inspected.kind==='csv'?'top_documents':'top_tables']:Number(k)}:{})})}>Explore this source's neighbors</button></>}
      {edge&&<><h4>{edge.table_name} ↔ {edge.document_name}</h4><p>Hybrid score <strong>{edge.score.toFixed(3)}</strong> · semantic {edge.semantic_similarity?.toFixed(3)??'not recorded'}</p><p>{edge.shared_terms.join(', ')}</p><blockquote>{edge.evidence?.preview||'No preview recorded'}</blockquote><small>Profile match · row {edge.evidence?.row_index??'—'} · characters {edge.evidence?.start??'—'}–{edge.evidence?.end??'—'}</small><button disabled={locked} onClick={()=>changeDraft({...draft,include:edge.selected?(draft.include||[]).filter(i=>i!==edge.id):[...new Set([...(draft.include||[]),edge.id])],exclude:edge.selected?[...new Set([...(draft.exclude||[]),edge.id])]:(draft.exclude||[]).filter(i=>i!==edge.id)})}>{edge.selected?'Exclude pair from draft':'Include pair in draft'}</button></>}
      {!edge&&!inspected&&<div className="pg-inspector-empty"><svg viewBox="0 0 180 100" aria-hidden="true"><path d="M40 30 C90 30 90 70 140 70 M40 70 C90 70 90 30 140 30"/><rect x="22" y="18" width="36" height="24" rx="7"/><rect x="22" y="58" width="36" height="24" rx="7"/><circle cx="140" cy="30" r="13"/><circle cx="140" cy="70" r="13"/></svg><h4>Every link has a story</h4><p>Select a source to follow its connections, or a link to inspect its score and evidence preview.</p><small>Inspection leaves your draft unchanged.</small></div>}
    </aside></div>
  </section>;
}

