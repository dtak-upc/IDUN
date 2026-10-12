import {useEffect,useRef,useState} from 'react';
import {api} from '../storage/api';
import {RecordOrigins} from './RecordOrigins';
type Record = {source:string;reference?:string;columns:string[];cells:unknown[]};
type Receipt = {title:string;projection:string;input_revision?:string;integration_current:boolean;integration_available:boolean;relation:string;document?:string;notice:string;subject:Record;object:Record;origins:{candidate?:string;relation:string;direction:string}[];evidence:{text?:string;context_text?:string}[]};
export function ContributionTrace({lakeId,run,assertion,projection,onClose}:{lakeId:string;run:string;assertion:string;projection:string;onClose:()=>void}) {
  const [receipt,setReceipt]=useState<Receipt>(),[error,setError]=useState(''),[offset,setOffset]=useState(0);
  const panel=useRef<HTMLElement>(null);
  useEffect(()=>{panel.current?.focus({preventScroll:true});panel.current?.scrollIntoView({block:'nearest',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});},[run,assertion,projection]);
  useEffect(()=>{
    setReceipt(undefined);setError('');setOffset(0);let active=true;const controller=new AbortController();
    const q=new URLSearchParams({run,assertion,projection});
    api<Receipt>('/knowledge/automatic/contribution?'+q,{signal:controller.signal},lakeId).then(r=>{if(active)setReceipt(r);}).catch(e=>{if(active)setError(String(e));});
    return()=>{active=false;controller.abort();};
  },[lakeId,run,assertion,projection]);
  return <section ref={panel} tabIndex={-1} className="journey-source-peek journey-contribution-trace" aria-label="Pinned Integration contribution">
    <header><div><h4>{receipt?.title || 'Integration contribution'}</h4><small>Saved graph projection · original Integration records and evidence</small></div><button onClick={onClose}>Close trace</button></header>
    {error?<p role="alert">{error}</p>:!receipt?<p role="status">Loading the pinned contribution…</p>:<>
      <span className="journey-status">{receipt.integration_current?'Matches current Integration run':receipt.integration_available?'Integration has changed · showing pinned contribution':'Integration run unavailable · showing saved contribution'}</span>
      {receipt.notice&&<p className="journey-notice">{receipt.notice}</p>}
      {!!receipt.origins.length&&<><div className="journey-pagination"><strong>{receipt.origins.length} originating relationship rows</strong><div><button disabled={!offset} onClick={()=>setOffset(o=>o-8)}>Previous origins</button><button disabled={offset+8>=receipt.origins.length} onClick={()=>setOffset(o=>o+8)}>Next origins</button></div></div>
      <div className="journey-origin-labels">{receipt.origins.slice(offset,offset+8).map((o,i)=><span key={i}><b>{o.candidate||'Saved row'}</b> · {o.relation} · {o.direction}</span>)}</div></>}
      <div className="journey-records">{[receipt.subject,receipt.object].map((record,i)=><section key={i}><h4>{record.source}</h4><div className="journey-table-scroll"><table><thead><tr>{record.columns.map((c,j)=><th key={j}>{c}</th>)}</tr></thead><tbody><tr>{record.columns.map((_,j)=><td key={j}>{String(record.cells[j]??'—')}</td>)}</tr></tbody></table></div></section>)}</div>
      <small>{receipt.document||'Saved supporting document'}</small>{receipt.evidence.map((p,i)=><blockquote key={i}>{p.context_text||p.text||'Saved passage unavailable'}</blockquote>)}
      <RecordOrigins lakeId={lakeId} context={projection+'/'+assertion+'/'+run} records={[receipt.subject,receipt.object].map(r=>({name:r.source,reference:r.reference}))}/>
    </>}
  </section>;
}
