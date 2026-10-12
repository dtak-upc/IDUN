import { useEffect, useRef, useState } from 'react';
import { api } from '../storage/api';
import {savedDemo} from '../mode';

type Source = {id:string;name:string;version:string;row?:number;start?:number;end?:number};
type Page = {kind:'table'|'document';name:string;version:string;offset:number;limit:number;total:number;end?:number;columns?:string[];rows?:{index:number;cells:unknown[]}[];text?:string};
export function useSourcePeek(lakeId:string,resetKey:string) {
  const [source,setSource]=useState<Source>(),[offset,setOffset]=useState(0),[page,setPage]=useState<Page>(),[error,setError]=useState('');
  const panel=useRef<HTMLElement>(null);
  const trigger=useRef<HTMLButtonElement|null>(null);
  function collapse(){setSource(undefined);requestAnimationFrame(()=>trigger.current?.isConnected&&trigger.current.focus());}
  const textSlice=(start:number,end?:number)=>Array.from(page?.text??'').slice(start,end).join('');
  useEffect(()=>{setSource(undefined);setPage(undefined);setError('');},[lakeId,resetKey]);
  useEffect(()=>{
    setPage(undefined);setError('');if(!source)return;
    let active=true;const controller=new AbortController();
    api<Page>(`/assets/${encodeURIComponent(source.id)}/journey?version=${encodeURIComponent(source.version)}&offset=${offset}`,{signal:controller.signal},lakeId)
      .then(result=>{if(active){if(result.version!==source.version)throw Error('Source version changed. Close and reopen the source.');setPage(result);}}).catch(e=>{if(active)setError(String(e));});
    return()=>{active=false;controller.abort();};
  },[lakeId,source,offset]);
  const same=(item:Source)=>source?.id===item.id&&source.version===item.version;
  function link(item:Source) {
    // Older snapshots without IDs remain readable, without guessing by filename.
    if(!item.id||!item.version)return item.name;
    return <button type="button" className="journey-source-link" aria-expanded={same(item)} onClick={e=>{
      trigger.current=e.currentTarget;
      if(same(item)){collapse();return;}
      setOffset(item.row?Math.floor(Math.max(0,item.row-2)/20)*20:Math.floor((item.start??0)/8000)*8000);setSource(item);
      requestAnimationFrame(()=>{panel.current?.focus({preventScroll:true});panel.current?.scrollIntoView({block:'nearest',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});});
    }}>{item.name}<span aria-hidden="true"> {same(item)?'↙':'↗'}</span></button>;
  }
  const view=source&&<section className="journey-source-peek" ref={panel} tabIndex={-1} aria-label="Expanded source"><header><div><h4>{source.name}</h4><small>{savedDemo?'Saved public source projection · only exported fields':'Actual saved source · original values, not model projection'}</small></div><button onClick={collapse}>Collapse source</button></header>
    {error?<p role="alert">{error}</p>:!page?<p role="status">Loading source…</p>:<><div className="journey-pagination"><span>{page.kind==='table'?`${page.total.toLocaleString()} data rows · Page ${page.total?Math.floor(page.offset/20)+1:0} / ${Math.ceil(page.total/20)}`:`Characters ${page.offset.toLocaleString()}–${page.end?.toLocaleString()} of ${page.total.toLocaleString()}`}</span><div><button disabled={!offset} onClick={()=>setOffset(Math.max(0,offset-page.limit))}>Previous source page</button><button disabled={offset+page.limit>=page.total} onClick={()=>setOffset(offset+page.limit)}>Next source page</button></div></div>
    {page.kind==='table'?<div className="journey-table-scroll"><table><thead><tr><th>Row</th>{page.columns?.map((name,i)=><th key={i}>{name||`Column ${i+1}`}</th>)}</tr></thead><tbody>{page.rows?.map(row=><tr key={row.index} className={row.index===source.row?'journey-source-match':''}><td>{row.index}</td>{Array.from({length:Math.max(row.cells.length,page.columns?.length??0)},(_,i)=><td key={i}>{row.cells[i]==null?'':String(row.cells[i])}</td>)}</tr>)}</tbody></table></div>:<pre className="journey-source-text">{source.start!==undefined&&source.end!==undefined&&source.end>page.offset&&source.start< (page.end??0)?<>{textSlice(0,Math.max(0,source.start-page.offset))}<mark>{textSlice(Math.max(0,source.start-page.offset),Math.min(page.limit,source.end-page.offset))}</mark>{textSlice(Math.min(page.limit,source.end-page.offset))}</>:page.text}</pre>}
    <details><summary>Source version</summary><small>{page.version}</small></details></>}
  </section>;
  return {link,view};
}
