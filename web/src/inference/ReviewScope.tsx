import {useEffect,useState} from 'react';
import {api,post} from '../storage/api';
import type {ScopeSnapshot} from '../journey/ScopeHandoff';
import './profile-graph.css';
export type CommittedScope=ScopeSnapshot & {id:string};
export function ReviewScope({lakeId,onDiscover}:{lakeId:string;onDiscover:()=>void}){
 const [preview,setPreview]=useState<CommittedScope>();const [request,setRequest]=useState<unknown>();const [error,setError]=useState('');const [busy,setBusy]=useState(false);const[reload,setReload]=useState(0);
 useEffect(()=>{let active=true;setPreview(undefined);setError('');setBusy(true);
  (async()=>{const graph=await api<{graph:{generation:string}}>('/profile/graph');const saved=JSON.parse(localStorage.getItem(`idun:graph-draft:${lakeId}`)||'null');
   if(saved&&saved.generation!==graph.graph.generation)throw Error('Your draft belongs to an older profile. Return to Explore links to review it.');
   const body={generation:graph.graph.generation,recipe:saved?.recipe||{mode:'all'}};
   const p=await post<CommittedScope>('/discovery/scope/preview',body);if(active){setPreview(p);setRequest(body);}
  })().catch(e=>{if(active)setError(String(e));}).finally(()=>{if(active)setBusy(false);});return()=>{active=false;};
 },[lakeId,reload]);
 async function commit(){setBusy(true);setError('');try{const scope=await post<CommittedScope>('/discovery/scope/commit',request);sessionStorage.setItem(`idun:discovery-scope:${lakeId}`,JSON.stringify(scope));onDiscover();}catch(e){setError(String(e));}finally{setBusy(false);}}
 return <section className="profile-graph review-scope" aria-label="Review Discovery scope"><h2>Review what LOKI will explore</h2><p>Only the committed table–document pairs will enter fine-grained discovery. Editing your graph draft later will not change this snapshot.</p>
 {error&&<p role="alert">{error}</p>}{busy&&<p role="status">Checking selection…</p>}
 {preview&&<div className="journey-review-summary"><strong>{preview.counts.pairs.toLocaleString()} selected source pairs</strong><span>{preview.counts.tables} tables · {preview.counts.documents} documents · {preview.counts.shared_documents} shared-document neighborhoods</span><small>Inspect included and outside-scope pairs using Data Journey at the top.</small></div>}
 <button className="primary" disabled={busy||!preview?.counts.pairs} onClick={commit}>Commit scope & open Discovery →</button>
 {!preview?.counts.pairs&&preview&&<p>Select at least one pair in Explore links. An empty draft will never run the whole lake.</p>}
 <button disabled={busy} onClick={()=>setReload(n=>n+1)}>Refresh review</button>
 </section>;
}
