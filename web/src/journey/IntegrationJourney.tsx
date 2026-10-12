import { useEffect, useRef, useState } from 'react';
import { api } from '../storage/api';
import { EvidenceHandoff } from './EvidenceHandoff';
import {RecordOrigins} from './RecordOrigins';
import './journey.css';

type Source={name:string;columns:string[];record:{record_id?:string;cells:unknown[]}};
type Item={candidate:string;status?:string;relation?:string;direction?:string;left:Source;right:Source;document_name?:string;evidence_quote?:string;decision?:{reason?:string;relations?:string[];path_decisions?:{evidence?:string;relationship:string;basis:string;reason?:string}[]};paths:{evidence?:string;text?:string;context_text?:string;score?:number;ce_score?:number}[]};
type Receipt={id:string;title:string;revision:string;discovery_revision:string;input?:{revision:string;evidence_filter?:{min_score?:number;max_score?:number;top_k?:number};summary?:{links?:number;bridges?:number}};model?:string;materialized:boolean;batch:{mode?:string;budget?:number;total?:number;retained?:number;resumed?:boolean};parent_run_id?:string;coverage:Record<string,number>;outcomes:Record<string,number>;candidates:number;output_rows:number;groups:{relation:string;rows:number}[];curated:boolean;page:{total:number;offset:number;limit:number;items:Item[]}};
const labels:Record<string,string>={include:'Supported',abstain:'Withheld',conflict:'Conflicting',unreviewed:'No decision recorded'};
const count=(value?:number)=>value===undefined?'Unrecorded':value.toLocaleString();

function Records({item,lakeId,revision}:{item:Item;lakeId:string;revision:string}) {
  const [open,setOpen]=useState(false);
  return <article><header><b>{item.candidate} · {item.left.name} ↔ {item.right.name}</b><span>{item.relation||labels[item.status||'unreviewed']}</span></header>
    {item.decision?.reason&&<p>{item.decision.reason}</p>}
    {item.decision?.relations?.length? <p>{item.decision.relations.join(' · ')}</p>:null}
    {item.document_name&&<small>{item.document_name}</small>}
    <button className="journey-source-link" aria-expanded={open} onClick={()=>setOpen(!open)}>{open?'Collapse records & evidence':'Inspect records & evidence ↗'}</button>
    {open&&<div className="journey-record-detail">{(['left','right'] as const).map(side=>{const source=item[side],row=source.record.record_id?.split(':').at(-1);return <section key={side}><h4>{source.name}{row?` · Row ${row}`:''}</h4><div className="journey-table-scroll"><table><thead><tr>{source.columns.map((c,i)=><th key={i}>{c}</th>)}</tr></thead><tbody><tr>{source.columns.map((_,i)=><td key={i}>{source.record.cells[i]==null||source.record.cells[i]===''?<em>Missing</em>:String(source.record.cells[i])}</td>)}</tr></tbody></table></div></section>;})}
      <section><h4>Saved narrative evidence</h4>{item.paths.length?item.paths.map((p,i)=><div key={i}><small>Passage {i+1}{p.score!==undefined?` · LOKI similarity ${p.score.toFixed(3)}`:''}</small><blockquote>{p.context_text||p.text||'Saved passage text unavailable'}</blockquote>{item.decision?.path_decisions?.filter(d=>d && p.evidence===d.evidence).map((d,j)=><p key={j}>{d.relationship} · {d.basis}{d.reason?` · ${d.reason}`:''}</p>)}</div>):<p>{item.evidence_quote||'No passage recorded.'}</p>}</section>
      <small>Saved projected records and passages. Original source values remain unchanged.</small>
      <RecordOrigins lakeId={lakeId} context={`${revision}/${item.candidate}`} records={[{name:item.left.name,reference:item.left.record.record_id},{name:item.right.name,reference:item.right.record.record_id}]}/></div>}
  </article>;
}

export function IntegrationJourney({lakeId,runId,refreshKey,onEvidence}:{lakeId:string;runId?:string;refreshKey?:string;onEvidence?:(id:string,companion?:string)=>void}) {
  const [view,setView]=useState<'run'|'input'>(runId?'run':'input'),[kind,setKind]=useState<'candidates'|'tables'>('candidates'),[outcome,setOutcome]=useState(''),[relation,setRelation]=useState(''),[offset,setOffset]=useState(0),[data,setData]=useState<Receipt>(),[error,setError]=useState('');
  const revision=useRef('');
  const [loading,setLoading]=useState(false);
  useEffect(()=>{setOffset(0);setOutcome('');setRelation('');setData(undefined);},[lakeId,runId]);
  useEffect(()=>{revision.current='';},[lakeId,runId,refreshKey]);
  useEffect(()=>{
    if(view!=='run'||!runId)return;
    let active=true;const controller=new AbortController();setLoading(true);setError('');
    const query=new URLSearchParams({kind,outcome,relation,offset:String(offset),revision:revision.current});
    api<Receipt>(`/integration/${encodeURIComponent(runId)}/journey?${query}`,{signal:controller.signal},lakeId).then(r=>{if(active){revision.current=r.revision;setData(r);}}).catch(e=>{if(active)setError(String(e));}).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;controller.abort();};
  },[lakeId,runId,refreshKey,view,kind,outcome,relation,offset]);
  function inspect(next:'candidates'|'tables',filter=''){setKind(next);setOffset(0);if(next==='candidates')setOutcome(filter);else setRelation(filter);}
  return <><nav className="journey-tabs" aria-label="Integration journey views"><button aria-pressed={view==='run'} disabled={!runId} onClick={()=>setView('run')}>Selected run · outcomes & tables</button><button aria-pressed={view==='input'} onClick={()=>setView('input')}>Discovery input · next run</button></nav>
    {view==='input'?<EvidenceHandoff lakeId={lakeId} refreshKey={refreshKey} receiving onEvidence={onEvidence}/>:<section className="journey-handoff" aria-label="Selected Integration run journey">
      {error?<p role="alert">{error}</p>:!data?<p role="status">Loading this run’s saved journey…</p>:<>
      <header className="journey-heading"><div><span>CANDIDATES → DECISIONS → RELATIONSHIP TABLES</span><h3>{data.title}</h3><small>{data.model||'Model unrecorded'} · {data.batch.mode||'Operation unrecorded'}{data.batch.resumed?' · resumed original batch':''}</small></div><span className="journey-status">{data.materialized?'Materialized output':'Proposed output · not materialized'}</span></header>
      <p className="journey-footnote">This is the selected run’s saved snapshot. Current Discovery filters do not change its records or evidence.</p>
      <div className="journey-grid">
        <article className="journey-card"><h4>Selected for this run</h4><b className="journey-number">{count(data.candidates)}</b><p>saved row-pair candidates</p><ol className="journey-funnel">{[['Available before ranking','available_pairs'],['Ranking pool','pool_pairs'],['Outside ranking pool','pool_omitted'],['Filtered after ranking','ce_filtered'],['Pending beyond this batch','pending_pairs']].map(([label,key])=><li key={key}><span>{label}</span><b>{count(data.coverage[key])}</b></li>)}</ol><small>These are recorded processing stages, not additive categories.</small><p>Batch allowance: {count(data.batch.budget)} · Batch candidates: {count(data.batch.total)} · Carried from base: {count(data.batch.retained)}</p>{data.parent_run_id&&<small>Extends or rebuilds a saved base run; unchanged carried candidates are included above.</small>}
          {data.input?<p>Saved Discovery input: {count(data.input.summary?.links)} link entries · {count(data.input.summary?.bridges)} shared-span paths{data.input.evidence_filter&&<small>Score {data.input.evidence_filter.min_score}–{data.input.evidence_filter.max_score} · {data.input.evidence_filter.top_k?`Top ${data.input.evidence_filter.top_k}`:'All matching scores'}</small>}</p>:<small>Discovery preparation counts were not captured for this older run. Its saved candidate records and evidence remain inspectable.</small>}
        </article>
        <article className="journey-card"><h4>Candidate outcomes</h4>{Object.entries(data.outcomes).map(([key,value])=><button className="journey-metric-action" key={key} aria-pressed={kind==='candidates'&&outcome===key} onClick={()=>inspect('candidates',key)}><span>{labels[key]}</span><b>{count(value)} ↗</b></button>)}<small>Disjoint candidate counts. Supported means the saved decision includes a relationship, not independently verified truth. Withheld includes negative or unresolved decisions.</small><button onClick={()=>inspect('candidates')}>Inspect all candidates ↗</button></article>
        <article className="journey-card"><h4>{data.materialized?'Materialized tables':'Proposed tables'}</h4><b className="journey-number">{count(data.output_rows)}</b><p>relationship rows across {data.groups.length} relationship types</p>{data.groups.map(g=><button className="journey-metric-action" key={g.relation} aria-pressed={kind==='tables'&&relation===g.relation} onClick={()=>inspect('tables',g.relation)}><span>{g.relation}</span><b>{count(g.rows)} ↗</b></button>)}<small>A candidate can produce several relationship rows. Rows are grouped by source pair, document, relationship and direction. {data.curated?'Current saved relationship edits are reflected here.':''}</small>{!data.output_rows&&<p>No relationship rows were produced. Inspect withheld/conflicting candidates to see the saved reasons.</p>}<button onClick={()=>inspect('tables')}>Inspect all output rows ↗</button></article>
      </div>
      <section className="journey-inspector"><h4>{kind==='candidates'?(outcome?labels[outcome]+' candidates':'All saved candidates'):(relation||'All relationship tables')}</h4><div className="journey-tabs"><button aria-pressed={kind==='candidates'} onClick={()=>inspect('candidates')}>Candidates & evidence</button><button aria-pressed={kind==='tables'} onClick={()=>inspect('tables')}>Relationship tables</button></div><div className="journey-pagination"><span>{count(data.page.total)} {kind==='candidates'?'candidates':'relationship rows'} · Page {data.page.total?Math.floor(data.page.offset/12)+1:0} / {Math.ceil(data.page.total/12)}</span><div><button disabled={loading||!offset} onClick={()=>setOffset(o=>o-12)}>Previous results</button><button disabled={loading||offset+12>=data.page.total} onClick={()=>setOffset(o=>o+12)}>Next results</button></div></div><div className="journey-evidence-list">{loading?<p role="status">Loading selected records…</p>:data.page.items.map((item,i)=><Records key={`${data.revision}/${kind}/${offset}/${i}`} item={item} lakeId={lakeId} revision={data.revision}/>)}</div>{!data.page.total&&<p>No records in this selection.</p>}</section>
      </>}
    </section>}</>;
}
