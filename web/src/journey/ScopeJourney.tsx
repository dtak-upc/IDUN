import { useEffect, useState } from 'react';
import { api } from '../storage/api';
import { ScopeHandoff, type ScopeSnapshot } from './ScopeHandoff';

export function ScopeJourney({ lakeId }: { lakeId: string }) {
  const [scope,setScope]=useState<ScopeSnapshot>(),[error,setError]=useState('');
  const [retry,setRetry]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();let active=true;setError('');setScope(undefined);
    (async()=>{
      const graph=await api<{graph:{generation:string}}>('/profile/graph',{signal:controller.signal},lakeId);
      const draft=JSON.parse(localStorage.getItem(`idun:graph-draft:${lakeId}`)||'null');
      if(draft&&draft.generation!==graph.graph.generation)throw Error('Your draft belongs to an older profile. Review Explore links before continuing.');
      const result=await api<ScopeSnapshot>('/discovery/scope/preview',{method:'POST',signal:controller.signal,headers:{'Content-Type':'application/json'},body:JSON.stringify({generation:graph.graph.generation,recipe:draft?.recipe||{mode:'all'}})},lakeId);
      if(active)setScope(result);
    })().catch(e=>{if(active)setError(String(e));});
    return()=>{active=false;controller.abort();};
  },[lakeId,retry]);
  return error?<div className="journey-notice"><p role="alert">{error}</p><button onClick={()=>setRetry(value=>value+1)}>Retry inspection</button></div>:scope?<ScopeHandoff scope={scope} lakeId={lakeId}/>:<p role="status">Opening your saved profiles and selected scope…</p>;
}
