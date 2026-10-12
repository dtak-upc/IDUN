import {useEffect,useState} from 'react';
import {snapshot,type Snapshot} from '../showcase/snapshot';
import {EvidenceHandoff} from './EvidenceHandoff';
import {useSourcePeek} from './SourcePeek';

export function SavedJourney({lakeId,discovery=false}:{lakeId:string;discovery?:boolean}) {
  const [data,setData]=useState<Snapshot>(),[error,setError]=useState('');
  const peek=useSourcePeek(lakeId,lakeId);
  useEffect(()=>{let active=true;snapshot(lakeId).then(s=>{if(active)setData(s);}).catch(e=>{if(active)setError(String(e));});return()=>{active=false;};},[lakeId]);
  if(error)return <p role="alert">{error}</p>;
  if(!data)return <p role="status">Loading saved sources…</p>;
  const sources=Object.values(data.sources),tables=sources.filter(s=>s.kind==='csv'),documents=sources.filter(s=>s.kind!=='csv');
  return <section className="journey-handoff"><header className="journey-heading"><div><span>SAVED DATA JOURNEY</span><h3>{discovery?'Explore the saved Discovery input and evidence':'Sources in this saved lake'}</h3></div></header>
    <div className="journey-grid"><article className="journey-card"><h4>Source tables</h4><b className="journey-number">{tables.length}</b><p>{tables.reduce((n,s)=>n+s.total,0).toLocaleString()} saved data rows</p></article><article className="journey-card"><h4>Source documents</h4><b className="journey-number">{documents.length}</b><p>Saved narratives available for inspection</p></article><article className="journey-card"><h4>Prepared Discovery</h4><b className="journey-number">{(data.link_storage?.total??data.links.length).toLocaleString()}</b><p>saved row–text link entries</p><small>These are retained evidence entries, not the number of all score observations. Earlier filter and scope reductions may not be recorded.</small></article></div>
    {peek.view}<section className="journey-inspector"><h4>Inspect saved sources</h4><div className="journey-evidence-list">{sources.map(s=>{const version=data.assets.find(a=>a.asset_id===s.id||a.id===s.id)?.version;return <article key={s.id}>{peek.link({id:s.id,name:s.name,version:version||'saved'})}<small>{s.kind==='csv'?`${s.total.toLocaleString()} rows · ${s.columns.length} projected columns`:'Text document'}</small></article>;})}</div></section>
    {discovery&&<EvidenceHandoff lakeId={lakeId}/>}</section>;
}
