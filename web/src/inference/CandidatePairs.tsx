import {useEffect,useRef,useState} from 'react';
import {api,post} from '../storage/api';
type Pair={id:string;table:string;text:string;table_name:string;document_name:string;score:number;semantic_similarity?:number;shared_terms:string[];evidence?:{preview:string;row_index?:number;start?:number;end?:number}};
type Preview={graph:{generation:string;edges:number;isolated_sources:number;notice:string};counts:{pairs:number;tables:number;documents:number;shared_documents:number};items:Pair[];next_cursor:unknown;recipe:Record<string,unknown>};
export function CandidatePairs({revision}:{revision?:string}){
  const [result,setResult]=useState<Preview>();const[error,setError]=useState('');const[busy,setBusy]=useState(false);
  const[min,setMin]=useState('0');const[k,setK]=useState('');const[direction,setDirection]=useState('top_documents');const[search,setSearch]=useState('');
  const[edge,setEdge]=useState<Pair>();const epoch=useRef(0);
  useEffect(()=>{epoch.current++;setResult(undefined);setEdge(undefined);setBusy(false);setError('');return()=>{epoch.current++;};},[revision]);
  async function load(body?:object){const token=++epoch.current;setBusy(true);setError('');try{
    const next=body?await post<Preview>('/profile/graph/query',body):await api<Preview>('/profile/graph');
    if(token===epoch.current){setResult(next);setEdge(undefined);}
  }catch(e){if(token===epoch.current)setError((e as Error).message);}finally{if(token===epoch.current)setBusy(false);}}
  return <section className="candidate-pairs" aria-label="Profile candidate pairs">
    <h3>Inspect profiled candidate pairs</h3>
    <p>Preview retrieval scores and filtering rules. These controls do not change the pairs sent to Discovery yet.</p>
    {!result && <button className="secondary" disabled={busy} onClick={()=>load()}>{busy?'Loading candidates…':'Inspect candidate pairs'}</button>}
    {error && <p role="alert">{error} <button onClick={()=>load()} disabled={busy}>Reload current graph</button></p>}
    {result && <>
      <form className="candidate-pair-controls" onSubmit={e=>{e.preventDefault();load({generation:result.graph.generation,recipe:{mode:'query',min_score:Number(min),search,...(k?{[direction]:Number(k)}:{})}});}}>
        <label>Source name or shared term<input value={search} maxLength={200} onChange={e=>setSearch(e.target.value)}/></label>
        <label>Minimum profile score<input type="number" min={0} max={1} step="0.01" required value={min} onChange={e=>setMin(e.target.value)}/></label>
        <label>Top-K neighbors<input type="number" min={1} max={1000000} placeholder="All" value={k} onChange={e=>setK(e.target.value)}/></label>
        <label>Rank direction<select value={direction} onChange={e=>setDirection(e.target.value)}><option value="top_documents">Documents per table</option><option value="top_tables">Tables per document</option></select></label>
        <button disabled={busy}>Preview filters</button><button type="button" disabled={busy} onClick={()=>{setMin('0');setK('');setSearch('');load();}}>Reset to all candidates</button>
      </form>
      <p role="status">{result.counts.pairs} / {result.graph.edges} candidate pairs · {result.counts.tables} tables · {result.counts.documents} documents · {result.counts.shared_documents} documents connect multiple tables</p>
      <small>{result.graph.notice} {result.graph.isolated_sources} sources have no retained candidate edge.</small>
      <div className="candidate-pair-grid"><table><thead><tr><th>Table</th><th>Document</th><th>Profile score</th><th>Match</th></tr></thead><tbody>
        {result.items.map(p=><tr key={p.id}><td>{p.table_name}</td><td>{p.document_name}</td><td>{p.score.toFixed(3)}</td><td><button onClick={()=>setEdge(p)}>Inspect match</button></td></tr>)}
      </tbody></table></div>
      {!result.counts.pairs && <p>No pairs match this preview. This does not select the whole graph.</p>}
      <div className="candidate-pair-controls"><button disabled={busy} onClick={()=>load({generation:result.graph.generation,recipe:result.recipe})}>First page</button><button disabled={busy||!result.next_cursor} onClick={()=>load({generation:result.graph.generation,recipe:result.recipe,cursor:result.next_cursor})}>Next pairs</button><span>Showing {result.items.length} pairs; preview totals cover all pages.</span></div>
      {edge && <aside className="candidate-pair-inspector"><h4>{edge.table_name} ↔ {edge.document_name}</h4><p>Hybrid score: {edge.score.toFixed(3)} · Semantic similarity: {edge.semantic_similarity?.toFixed(3) ?? 'Not recorded'}</p><p>Shared terms: {edge.shared_terms.join(', ')||'None recorded'}</p><blockquote>{edge.evidence?.preview||'No representative passage recorded'}</blockquote><small>Profile match, not verified LOKI evidence. Source row: {edge.evidence?.row_index ?? 'not recorded'} · Passage offsets: {edge.evidence?.start ?? '—'}–{edge.evidence?.end ?? '—'}</small><button onClick={()=>setEdge(undefined)}>Close match</button></aside>}
    </>}
  </section>;
}
