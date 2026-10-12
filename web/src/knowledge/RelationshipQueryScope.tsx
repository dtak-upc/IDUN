import type {ClassStep} from './ConceptQueryScope';

export type RelationshipMatch={id:string;label:string;matched_id:string;matched_label:string;reversed:boolean;via:ClassStep[];original_direction:string;original_subject:string;original_object:string};
export type RelationshipScope={mode:string;relationship:string;revision:string;resolved:{id:string;label:string;source_label:string;target_label:string;direction:string;reversed:boolean;via:ClassStep[]}[]};

export function RelationshipQueryScope({mode,onMode,relationship,scope,loading}:{mode:'exact'|'aligned';onMode:(mode:'exact'|'aligned')=>void;relationship:string;scope?:RelationshipScope;loading:boolean}) {
 return <section className="kg-concept-query" aria-label="Relationship matching">
  <header><div><strong>How should relationships match?</strong><p>Choose a relationship below to follow its records.</p></div><div className="kg-task-tabs">
   <button aria-pressed={mode==='exact'} onClick={()=>onMode('exact')}>Exact relationship</button>
   <button aria-pressed={mode==='aligned'} onClick={()=>onMode('aligned')}>Include equivalent & inverse</button>
  </div></header>
  <p>{mode==='exact'?'Show assertions with the selected relationship definition.':'Include reviewed equivalent and inverse relationships in your query runs. Inverse matches display records in the selected relationship’s direction.'}</p>
  {mode==='aligned'&&relationship&&<div className="kg-query-resolved" role="status">{loading?'Resolving reviewed relationship mappings…':<><strong>{scope?.resolved.length??0} matching relationship{scope?.resolved.length===1?'':'s'}</strong><div>{scope?.resolved.slice(0,8).map(r=><span key={r.id}>{r.label}<small>{r.source_label} {r.direction==='directed'?'→':r.direction==='bidirectional'?'↔':'—'} {r.target_label}</small><small>{r.reversed?'Reverse endpoints for this query':r.via.length?'Same endpoint orientation':'Direct relationship'}</small></span>)}</div>{(scope?.resolved.length??0)>8&&<p>And {scope!.resolved.length-8} more. Select an assertion to inspect its mapping path.</p>}{scope?.resolved.length===1&&<p>No additional current mappings apply. Reviewed relationship mappings require a single direction for both relationships.</p>}</>}</div>}
 </section>;
}

export function RelationshipMatchExplanation({match}:{match:RelationshipMatch}) {
 return <section className="kg-concept-match" aria-label="Why this relationship matches"><h4>Why this relationship matches</h4><p>Query relationship: <strong>{match.label}</strong> · Original Integration relationship: <strong>{match.matched_label}</strong></p>{!match.via.length?<p>Direct relationship match.</p>:<ol>{match.via.map(step=><li key={step.id}>{step.source_label} {step.kind==='inverse'?'is inverse to':'is equivalent to'} {step.target_label}</li>)}</ol>}{match.reversed&&<p>The displayed record order is reversed for this query. Source records and Integration evidence retain their original meaning.</p>}</section>;
}
