import { useState, type ComponentProps } from 'react';
import { ScopeHandoff, type ScopeSnapshot } from './ScopeHandoff';
import { EvidenceHandoff } from './EvidenceHandoff';

export function DiscoveryJourney({scope,scopeError,initialTab,...evidence}:ComponentProps<typeof EvidenceHandoff>&{
  scope?:ScopeSnapshot;scopeError?:string;initialTab:'scope'|'evidence';
}) {
  const [tab,setTab]=useState(initialTab);
  return <><nav className="journey-tabs" aria-label="Discovery journey views"><button aria-pressed={tab==='scope'} onClick={()=>setTab('scope')}>Input scope</button><button aria-pressed={tab==='evidence'} onClick={()=>setTab('evidence')}>Scores & evidence</button></nav>
    {tab==='scope'?(scope?<ScopeHandoff scope={scope} lakeId={evidence.lakeId} receiving/>:<p role={scopeError?'alert':'status'}>{scopeError||'Loading the selected input scope…'}</p>):<EvidenceHandoff {...evidence}/>}</>;
}
