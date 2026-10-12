import { useEffect, useRef, useState } from 'react';
import { api } from '../storage/api';

export type GapAssessment={revision:string;counts:{tables:number;rows:number;missing_cells:number};tables:{id:string;name:string;version:string;rows:number;columns:{index:number;name:string;missing:number;kind?:string}[]}[]};
type Table=GapAssessment['tables'][number];
type Page={revision:string;version:string;columns:Table['columns'];rows:{index:number;cells:unknown[];missing:boolean[]}[];total:number;offset:number;limit:number;assessed_rows:number};
export function AssessmentTables({lakeId,assessment,scope,baseRunId='',augmentationRunId=''}:{lakeId:string;assessment:GapAssessment;scope:string;baseRunId?:string;augmentationRunId?:string}) {
  const [selected,setSelected]=useState<Table>(),[column,setColumn]=useState<number>(),[gapsOnly,setGapsOnly]=useState(true),[offset,setOffset]=useState(0),[page,setPage]=useState<Page>(),[error,setError]=useState('');
  const panel=useRef<HTMLElement>(null),trigger=useRef<HTMLButtonElement|null>(null);
  useEffect(()=>{setSelected(undefined);setPage(undefined);setError('');},[lakeId,assessment.revision,scope,baseRunId]);
  useEffect(()=>{
    setPage(undefined);setError('');if(!selected)return;
    let active=true;const controller=new AbortController();
    const query=new URLSearchParams({scope,run:baseRunId,assessment_run:augmentationRunId,revision:assessment.revision,table:selected.id,version:selected.version,offset:String(offset),missing_only:String(gapsOnly),column:column===undefined?'':String(column)});
    api<Page>('/augmentation/assessment/table?'+query,{signal:controller.signal},lakeId).then(p=>{if(active){if(p.revision!==assessment.revision||p.version!==selected.version)throw Error('Assessment changed. Close this table and refresh the assessment.');setPage(p);}}).catch(e=>{if(active)setError(String(e));});
    return()=>{active=false;controller.abort();};
  },[lakeId,assessment.revision,scope,baseRunId,augmentationRunId,selected,column,gapsOnly,offset]);
  const same=(t:Table)=>selected?.id===t.id&&selected.version===t.version;
  const visibleColumns=page?.columns.map((c,position)=>({...c,position})).filter(c=>column===undefined||c.index===column)??[];
  function collapse(){setSelected(undefined);requestAnimationFrame(()=>trigger.current?.isConnected&&trigger.current.focus());}
  function select(t:Table,button:HTMLButtonElement,col?:number){
    trigger.current=button;
    if(same(t)&&col===undefined&&column===undefined){collapse();return;}
    setSelected(t);setColumn(col);setGapsOnly(t.columns.some(c=>c.missing>0));setOffset(0);
    requestAnimationFrame(()=>{panel.current?.focus({preventScroll:true});panel.current?.scrollIntoView({block:'nearest',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});});
  }
  return <div className="journey-inspector"><h4>Assessed tables</h4><small>Click a table to inspect its missing cells, or a column to focus on its gaps.</small>
    {selected&&<section className="journey-source-peek" ref={panel} tabIndex={-1} aria-label="Assessed table gaps"><header><div><h4>{selected.name}</h4><small>{scope==='source'?'Saved source values':'Source rows represented in this Integration run'} · missing cells highlighted</small></div><button onClick={collapse}>Collapse table</button></header>
    <div className="journey-tabs"><button aria-pressed={gapsOnly} disabled={!selected.columns.some(c=>c.missing)} onClick={()=>{setGapsOnly(true);setOffset(0);}}>Rows with gaps</button><button aria-pressed={!gapsOnly} onClick={()=>{setGapsOnly(false);setOffset(0);}}>All assessed rows</button></div>
    <div className="journey-gap-columns" aria-label="Columns to show"><button aria-pressed={column===undefined} onClick={()=>{setColumn(undefined);setOffset(0);}}>All columns</button>{selected.columns.filter(c=>c.missing>0).map(c=><button key={c.index} aria-pressed={column===c.index} onClick={()=>{setColumn(c.index);setOffset(0);}}>{c.name} · {c.missing.toLocaleString()}</button>)}</div>
    {error?<p role="alert">{error}</p>:!page?<p role="status">Loading assessed rows…</p>:<><div className="journey-pagination"><span>{page.total.toLocaleString()} {gapsOnly?'rows with gaps':'assessed rows'} · Page {page.total?Math.floor(page.offset/20)+1:0} / {Math.ceil(page.total/20)}</span><div><button disabled={!offset} onClick={()=>setOffset(o=>o-20)}>Previous table page</button><button disabled={offset+20>=page.total} onClick={()=>setOffset(o=>o+20)}>Next table page</button></div></div><p className="journey-filter-summary">{column===undefined?'Showing all assessed columns':`Showing ${selected.columns.find(c=>c.index===column)?.name}`} · {gapsOnly?(column===undefined?'Rows missing any assessed value':'Rows missing this value'):'Every assessed row, including complete rows'}</p><div className="journey-table-scroll"><table><thead><tr><th>Row</th>{visibleColumns.map(c=><th key={c.index} className={c.missing?'journey-gap-column':''}>{c.name}{c.missing>0&&<small> · {c.missing} missing</small>}</th>)}</tr></thead><tbody>{page.rows.map(r=><tr key={r.index}><td>{r.index}</td>{visibleColumns.map(c=><td key={c.index} className={r.missing[c.position]?'journey-missing-cell':''}>{r.missing[c.position]?<><b>Missing</b><small>{r.cells[c.position]==null||r.cells[c.position]===''?'No value':`Source: ${String(r.cells[c.position])}`}</small></>:String(r.cells[c.position]??'')}</td>)}</tr>)}</tbody></table></div>{!page.total&&<p>No rows match this gap selection.</p>}</>}
    <small>Only fields included in this assessment are shown. Original values are unchanged.</small></section>}
    <div className="journey-table-scroll"><table><thead><tr><th>Table</th><th>Rows</th><th>Columns with gaps</th></tr></thead><tbody>{assessment.tables.map(t=><tr key={t.id+':'+t.version}><td><button className="journey-source-link" aria-expanded={same(t)} onClick={e=>select(t,e.currentTarget)}>{t.name}<span aria-hidden="true"> {same(t)?'↙':'↗'}</span></button></td><td>{t.rows}</td><td><div className="journey-gap-links">{t.columns.filter(c=>c.missing>0).map(c=><button className="journey-source-link" key={c.index} onClick={e=>select(t,e.currentTarget,c.index)}>{c.name} ({c.missing})</button>)}{!t.columns.some(c=>c.missing)&&'No missing cells'}</div></td></tr>)}</tbody></table></div>
  </div>;
}
