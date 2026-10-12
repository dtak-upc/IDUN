export type ClassStep={id:string;kind:string;source:string;target:string;source_label:string;target_label:string};
export type ConceptScope={mode:string;concept:string;revision:string;resolved:{id:string;label:string;via:ClassStep[]}[]};
export type ConceptMatch={side:string;id:string;label:string;via:ClassStep[]};

export function ConceptQueryScope({mode,onMode,concept,scope,loading}:{mode:'exact'|'aligned';onMode:(mode:'exact'|'aligned')=>void;concept:string;scope?:ConceptScope;loading:boolean}) {
 return <section className="kg-concept-query" aria-label="Concept matching">
  <header><div><strong>How should concepts match?</strong><p>Choose a concept below to explore its records.</p></div><div className="kg-task-tabs">
   <button aria-pressed={mode==='exact'} onClick={()=>onMode('exact')}>Exact assignments</button>
   <button aria-pressed={mode==='aligned'} onClick={()=>onMode('aligned')}>Include reviewed mappings</button>
  </div></header>
  <p>{mode==='exact'?'Show records assigned directly to the chosen concept.':'Include equivalent concepts and subclasses through reviewed class mappings in these query runs.'}</p>
  {mode==='aligned'&&concept&&<div className="kg-query-resolved" role="status">{loading?'Resolving reviewed concept mappings…':<><strong>{scope?.resolved.length??0} matching concept{scope?.resolved.length===1?'':'s'}</strong><div>{scope?.resolved.slice(0,8).map(c=><span key={c.id}>{c.label}<small>{c.via.length?'via reviewed mapping':'direct assignment'}</small></span>)}</div>{(scope?.resolved.length??0)>8&&<p>And {scope!.resolved.length-8} more. Each returned assertion shows its matching concept and mapping path.</p>}{scope?.resolved.length===1&&<p>No additional equivalent concepts or subclasses are available in this query scope.</p>}</>}</div>}
 </section>;
}

export function ConceptMatchExplanation({matches}:{matches:ConceptMatch[]}) {
 return <section className="kg-concept-match" aria-label="Why this assertion matches"><h4>Why this assertion matches</h4>{matches.map(m=><div key={m.side}><strong>{m.label} · {m.side==='subject'?'first record':'second record'}</strong>{!m.via.length?<p>Direct concept assignment</p>:<ol>{m.via.map(step=><li key={step.id}>{step.source_label} {step.kind==='equivalent'?'is equivalent to':'is a subclass of'} {step.target_label}</li>)}</ol>}</div>)}</section>;
}
