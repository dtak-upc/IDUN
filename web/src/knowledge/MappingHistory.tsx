import {useEffect,useState} from 'react';
type Event={sequence:number;recorded:number;family:string;action:string;label:string;runs:string[];before:{status:string}|null;after:{status:string}};
type Page={total:number;offset:number;limit:number;items:Event[]};
export function MappingHistory({revision,post}:{revision:string;post:<T>(path:string,body:unknown)=>Promise<T>}){
 const [open]=useState(true),[offset,setOffset]=useState(0),[page,setPage]=useState<Page>(),[error,setError]=useState(''),[loading,setLoading]=useState(false);
 useEffect(()=>setOffset(0),[revision]);
 useEffect(()=>{if(!open)return;let live=true;setLoading(true);setError('');setPage(undefined);
 void post<Page>('mapping-history',{offset}).then(p=>{if(live)setPage(p);}).catch(e=>{if(live)setError(String(e));}).finally(()=>{if(live)setLoading(false);});
 return()=>{live=false;};},[open,offset,revision,post]);
 return <section className="kg-layer-comparison"><h3>Mapping decision history</h3><p>All concept, relationship, attribute and record-assignment decisions in this lake, including hidden layers. Names are recorded at decision time. Undo changes the active mapping; it does not erase earlier decisions.</p>
 {loading&&<p role="status">Loading mapping history…</p>}{error&&<p role="alert">{error}</p>}
 {page&&<><p>{page.total} recorded events · Page {Math.floor(offset/25)+1} of {Math.max(1,Math.ceil(page.total/25))}</p>{!page.total&&<p>No mapping decisions yet. Accepted mappings and undo actions will appear here.</p>}
 {page.items.map(event=><article className="kg-mapping-event" key={event.sequence}><header><strong>{event.action==='baseline'?'Imported baseline':event.action==='undo'?'Undone':'Accepted'} · {event.family==='assignment'?'Record assignment':event.family==='property'?'Relationship':event.family==='attribute'?'Attribute':'Concept'}</strong><time dateTime={new Date(event.recorded*1000).toISOString()}>{new Date(event.recorded*1000).toLocaleString()}</time></header><p>{event.label}</p><small>{event.before?.status||'No recorded previous state'} → {event.after.status} · {event.runs.length} runs in the review scope</small>{event.action==='baseline'&&<p>Recorded when history was introduced; original action time and prior decisions are unavailable.</p>}</article>)}
 <div className="kg-mapping-history-pages"><button disabled={loading||offset===0} onClick={()=>setOffset(v=>Math.max(0,v-25))}>Previous decisions</button><button disabled={loading||offset+25>=page.total} onClick={()=>setOffset(v=>v+25)}>Next decisions</button></div></>}
 </section>;
}
