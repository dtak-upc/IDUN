import type {QueryRecipe} from './VisualQueryLibrary';
import {RelationshipEditor,type RelationshipEditSeed} from './RelationshipEditor';
import {VisualQuery,QueryWitnessDetails,type Witness} from './VisualQuery';
import {ValidityReview} from './ValidityReview';
import {AugmentationLayers} from './AugmentationLayers';
import {IdentityReview} from './IdentityReview';
import {PathWorkspace} from './PathWorkspace';
import {IdentityBridges} from './IdentityBridges';
import {EntityKeys} from './EntityKeys';
import {AttributeQueryFilter,AttributeMatchExplanation,type AttributeCondition,type AttributeScope,type AttributeMatch} from './AttributeQueryFilter';
import {RelationshipQueryScope,RelationshipMatchExplanation,type RelationshipScope,type RelationshipMatch} from './RelationshipQueryScope';
import {ConceptQueryScope,ConceptMatchExplanation,type ConceptScope,type ConceptMatch} from './ConceptQueryScope';
import { RunPicker, type PickerRun } from './RunPicker';
import { AlignmentSuggestions } from './AlignmentSuggestions';
import { useCallback, useEffect, useState } from 'react';
import { restoreScopes,excludeFromViews,applyRecordSelection } from './scopes';
import { api } from '../storage/api';
import { savedDemo, inferenceUnavailable } from '../mode';
import { DataJourneyButton } from '../journey/DataJourneyButton';
import { KnowledgeJourney } from '../journey/KnowledgeJourney';
import { AssignmentReview } from './AssignmentReview';
import { MappingHistory } from './MappingHistory';
import { QueryCheckpoints } from './QueryCheckpoints';
import { CompareCheckpoints } from './CompareCheckpoints';
import { AttributeAlignment } from './AttributeAlignment';
import { PropertyAlignment } from './PropertyAlignment';
import { ConceptAlignment } from './ConceptAlignment';
import { SchemaCanvas } from './KnowledgeWorkspace';
import './knowledge.css';
import './workspace-theme.css';
import '../storage/workflow.css';

type Proposal = {signature:string;revision:string;status:string;model:string;edges:{id:string;direction:string;reason:string}[]};
type Graph = {
  attributes?:{id:string;concept:string;name:string;datatype:string}[];
  attribute_alignments?:{id:string;attributes:{id:string;concept:string;name:string;datatype:string}[];stale:boolean}[];
  property_alignments?:{id:string;source:string;target:string;kind:string;stale:boolean}[];
  alignments?:{id:string;source:string;target:string;kind:string}[];
  revision:string;count:number;contribution_count:number;shared_count:number;
  concepts:{id:string;label:string;inferred_label?:string;definition?:string;attributes:{name:string;datatype:string}[]}[];
  relationships:{id:string;label:string;source:string;target:string;direction:string;count:number}[];
  layers:{run:string;title:string;count:number;exclusive:number;shared:number;revision:string;update_available:boolean;semantic?:boolean}[];
  types:{label:string;signature:string;proposal:Proposal|null}[];
};
type UpdatePreview = {token:string;updates:{run:string;title:string;before:number;after:number;added:number;removed:number;retained:number;evidence_changed:number;semantic_reset:boolean}[]};
type RetentionPreview = {token:string;keep:number;bytes:number;protected:number;retained:number;candidates:(SavedRevision&{bytes:number})[]};
type SavedRevision = {run:string;revision:string;recorded:number;title:string;count:number};
type RecordValue = {augmentation_claims?:{id:string;layer:string;layer_title:string;column:string;value:unknown;unit?:string;origin:string;grounding:string;conflict:boolean}[];id:string;label:string;concept:string;concept_id:string;source:string;row:number;columns:string[];cells:unknown[];concept_reason?:string};
type Instance = {attribute_matches?:AttributeMatch[];relationship_match?:RelationshipMatch;concept_matches?:ConceptMatch[];contributions:{run_id:string;run_title:string;evidence:{text?:string;context_text?:string}[]}[];id:string;run_id:string;run_title:string;relation:string;direction:string;subject:RecordValue;object:RecordValue;document:string;evidence:{text?:string;context_text?:string}[]};
type Overview = {runs:PickerRun[];job?:{status:string;phase:string;kind?:string}};

function ConceptName({concept,disabled,onSave}:{concept:Graph['concepts'][number];disabled:boolean;onSave:(name:string)=>Promise<void>}) {
  const [name,setName]=useState(concept.label);
  useEffect(()=>setName(concept.label),[concept.label]);
  return <form className="kg-concept-name" onSubmit={e=>{e.preventDefault();void onSave(name);}}>
    <label>Concept name<input aria-label={'Rename '+concept.label} value={name} maxLength={100} disabled={disabled} onChange={e=>setName(e.target.value)}/></label>
    <button disabled={disabled||!name.trim()||name.trim()===concept.label}>Save name</button>
    {concept.inferred_label&&concept.inferred_label!==concept.label&&<button type="button" disabled={disabled} onClick={()=>void onSave(concept.inferred_label!)}>Restore inferred name</button>}
    <p>{concept.definition||'Source-column grouping; infer semantic concepts to obtain a definition.'}</p>
  </form>;
}

function DirectionOverride({graph,type,disabled,onSave}:{graph:Graph;type:Graph['types'][number];disabled:boolean;onSave:(edges:Proposal['edges'])=>Promise<void>}) {
  const edges=graph.relationships.filter(e=>e.label===type.label);
  const [values,setValues]=useState<Record<string,string>>(()=>Object.fromEntries(edges.map(e=>[e.id,type.proposal?.status==='dismissed'?'undirected':type.proposal?.edges.find(p=>p.id===e.id)?.direction||'undirected'])));
  const name=(id:string)=>graph.concepts.find(c=>c.id===id)?.label||id;
  return <details className="kg-auto-override"><summary>Set or override direction manually</summary>
    {edges.map(e=>{const [a,b]=[e.source,e.target].sort();return <label key={e.id}>{name(a)} / {name(b)}<select aria-label={'Direction for '+type.label+' '+name(a)+' / '+name(b)} value={values[e.id]} disabled={disabled} onChange={event=>setValues(v=>({...v,[e.id]:event.target.value}))}>
      <option value="undirected">Undirected · {name(a)} --- {name(b)}</option><option value="forward">{name(a)} → {name(b)}</option><option value="reverse">{name(b)} → {name(a)}</option><option value="both">Both directions · {name(a)} ↔ {name(b)}</option>
    </select></label>;})}
    <button disabled={disabled} onClick={()=>void onSave(edges.map(e=>({id:e.id,direction:values[e.id],reason:'User-selected direction'})))}>Save direction for {type.label}</button>
  </details>;
}

export function KnowledgeGraph(props:{lakeId:string;lakeName:string}) {
  return <GraphView key={props.lakeId} {...props}/>;
}
function GraphView({lakeId,lakeName}:{lakeId:string;lakeName:string}) {
  const [preview,setPreview]=useState<UpdatePreview>();
  const [keepHistory,setKeepHistory]=useState('5');
  const [retention,setRetention]=useState<RetentionPreview>();
  const [cleanupNotice,setCleanupNotice]=useState('');
  const [history,setHistory]=useState<SavedRevision[]>([]);
  const [overview,setOverview]=useState<Overview>();
  const [runs,setRuns]=useState<string[]>([]);
  const [queryRuns,setQueryRuns]=useState<string[]>([]);
  const [queryGraph,setQueryGraph]=useState<Graph>();
  const [queryLoading,setQueryLoading]=useState(false);
  const [scopesReady,setScopesReady]=useState(false);
  const [graph,setGraph]=useState<Graph>();
  const [tab,setTab]=useState(()=>{try{const saved=sessionStorage.getItem('idun-kg-step:'+lakeId);return saved&&['Runs','Schema','Refine','Instances','Queries','History'].includes(saved)?saved:'Runs';}catch{return 'Runs';}});
  useEffect(()=>{try{sessionStorage.setItem('idun-kg-step:'+lakeId,tab);}catch{/* Session storage may be disabled. */}},[lakeId,tab]);
  const [tool,setTool]=useState('Concepts');
  const [graphEdit,setGraphEdit]=useState<RelationshipEditSeed>();

  const [historyView,setHistoryView]=useState('Revisions');
  const [queryTask,setQueryTask]=useState('Visual query');
  const [compareTask,setCompareTask]=useState('Compare snapshots');
  const [timeRecipe,setTimeRecipe]=useState<QueryRecipe & {graph:unknown;runs:string[];stale:boolean}>();
  useEffect(()=>{setTimeRecipe(undefined);setCompareTask('Compare snapshots');},[lakeId]);
  const [browseConcept,setBrowseConcept]=useState(''),[browseRelation,setBrowseRelation]=useState(''),[browseOffset,setBrowseOffset]=useState(0);
  const [browsePage,setBrowsePage]=useState<{items:Instance[];total:number}>(),[browseSelected,setBrowseSelected]=useState<Instance>();
  const [pathSeed,setPathSeed]=useState<Instance>();
  const [answerTraversal,setAnswerTraversal]=useState<Witness>();
  const [contributionPage,setContributionPage]=useState(0);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const [saving,setSaving]=useState(false);
  const [exporting,setExporting]=useState(false);
  const [loading,setLoading]=useState(false);
  const [epoch,setEpoch]=useState(0);
  const [relationshipMode,setRelationshipMode]=useState<'exact'|'aligned'>(()=>{try{return sessionStorage.getItem('idun-kg-relationship-mode:'+lakeId)==='aligned'?'aligned':'exact';}catch{return 'exact';}});
  useEffect(()=>{try{sessionStorage.setItem('idun-kg-relationship-mode:'+lakeId,relationshipMode);}catch{}},[lakeId,relationshipMode]);
  const [concept,setConcept]=useState('');
  const [conceptMode,setConceptMode]=useState<'exact'|'aligned'>(()=>{try{return sessionStorage.getItem('idun-kg-concept-mode:'+lakeId)==='aligned'?'aligned':'exact';}catch{return 'exact';}});
  useEffect(()=>{try{sessionStorage.setItem('idun-kg-concept-mode:'+lakeId,conceptMode);}catch{}},[lakeId,conceptMode]);
  const [attributeFilter,setAttributeFilter]=useState<AttributeCondition>();
  const [relation,setRelation]=useState('');
  const [offset,setOffset]=useState(0);
  const [page,setPage]=useState<{items:Instance[];total:number;concept_scope?:ConceptScope;relationship_scope?:RelationshipScope;attribute_scope?:AttributeScope}>();
  const [selected,setSelected]=useState<Instance>();
  useEffect(()=>setGraphEdit(undefined),[lakeId,JSON.stringify(runs)]);
  const post=useCallback(<T,>(path:string,body:unknown)=>api<T>('/knowledge/automatic/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)},lakeId),[lakeId]);
  useEffect(()=>{
    let live=true;
    api<Overview>('/knowledge',undefined,lakeId).then(o=>{
      if(!live)return;
      setOverview(o);setBusy(o.job?.status==='running');
      let saved:unknown;try{saved=JSON.parse(localStorage.getItem('idun-kg-scopes:'+lakeId)||'null');}catch{/* Storage may be unavailable. */}
      const scopes=restoreScopes(saved,o.runs.filter(r=>r.supported).map(r=>r.id));setRuns(scopes.visible);setQueryRuns(scopes.query);setScopesReady(true);
    }).catch(e=>live&&setError(String(e)));
    return ()=>{live=false;};
  },[lakeId]);
  useEffect(()=>{
    let live=true;setLoading(true);setError('');setPreview(undefined);setRetention(undefined);setCleanupNotice('');setGraph(undefined);setSelected(undefined);setPage(undefined);setBrowsePage(undefined);setBrowseSelected(undefined);setPathSeed(undefined);
    post<Graph>('sync',{runs}).then(g=>{if(live)setGraph(g);}).catch(e=>live&&setError(String(e))).finally(()=>live&&setLoading(false));
    return ()=>{live=false;};
  },[post,runs,epoch]);
  useEffect(()=>{
    if(scopesReady)try{localStorage.setItem('idun-kg-scopes:'+lakeId,JSON.stringify({visible:runs,query:queryRuns}));}catch{/* Session state remains usable without storage. */}
  },[lakeId,runs,queryRuns,scopesReady]);
  useEffect(()=>{
    let live=true;setQueryLoading(true);setQueryGraph(undefined);
    post<Graph>('sync',{runs:queryRuns}).then(g=>{if(live)setQueryGraph(g);}).catch(e=>live&&setError(String(e))).finally(()=>live&&setQueryLoading(false));
    return()=>{live=false;};
  },[post,queryRuns,epoch,graph?.revision]);
  useEffect(()=>{
    if(!busy)return;
    let live=true;
    const timer=setInterval(()=>{
      api<Overview>('/knowledge',undefined,lakeId).then(o=>{
        if(!live)return;setOverview(o);
        if(o.job?.status!=='running'){
          setBusy(false);if(o.job?.status==='completed')setEpoch(v=>v+1);
          if(o.job?.status==='failed')setError(o.job.phase);
        }
      }).catch(e=>{if(live){setError(String(e));setBusy(false);}});
    },1200);
    return()=>{live=false;clearInterval(timer);};
  },[busy,lakeId]);
  useEffect(()=>{
    let live=true;
    const browsing=tab==='Instances',matching=tab==='Queries'&&queryTask==='Find records';
    if(!browsing&&!matching)return;
    if(browsing){setBrowsePage(undefined);}else{setPage(undefined);setSelected(undefined);}
    if(queryGraph&&queryGraph.layers.map(l=>l.run).join(',')===queryRuns.join(',')){
      const q=new URLSearchParams({runs:queryRuns.join(','),concept:browsing?browseConcept:concept,concept_mode:browsing?'exact':conceptMode,revision:queryGraph.revision,relationship:browsing?browseRelation:relation,relationship_mode:browsing?'exact':relationshipMode,offset:String(browsing?browseOffset:offset)});
      if(browsing&&answerTraversal)q.set('assertions',answerTraversal.steps.map(s=>s.id).join(','));
      if(!browsing&&attributeFilter){q.set('attribute',attributeFilter.attribute);q.set('attribute_mode',attributeFilter.mode);q.set('attribute_op',attributeFilter.operator);q.set('attribute_value',attributeFilter.value);q.set('attribute_values',attributeFilter.values??'original');}
      api<{items:Instance[];total:number;concept_scope?:ConceptScope;relationship_scope?:RelationshipScope;attribute_scope?:AttributeScope}>('/knowledge/automatic/instances?'+q,undefined,lakeId).then(p=>{if(live){if(browsing){setBrowsePage(p);setBrowseSelected(old=>p.items.find(a=>a.id===old?.id&&a.run_id===old?.run_id)||(answerTraversal?p.items[0]:undefined));}else setPage(p);}}).catch(e=>live&&setError(String(e)));
    }
    return()=>{live=false;};
  },[tab,queryTask,queryGraph,queryRuns,concept,conceptMode,relation,relationshipMode,attributeFilter,offset,browseConcept,browseRelation,browseOffset,answerTraversal,lakeId]);
  useEffect(()=>{setBrowseOffset(0);setBrowseSelected(undefined);setPathSeed(undefined);setAnswerTraversal(undefined);},[queryRuns,queryGraph?.revision]);
  const inspect=useCallback((c:string,r:string)=>{setAnswerTraversal(undefined);setBrowseConcept(c);setBrowseRelation(r);setBrowseOffset(0);setTab('Instances');},[]);
  useEffect(()=>{
    let live=true;setHistory([]);
    if(graph)post<{items:SavedRevision[]}>('history',{runs}).then(r=>{if(live)setHistory(r.items);}).catch(e=>live&&setError(String(e)));
    return()=>{live=false;};
  },[graph,post,runs]);
  async function historyCleanup(apply=false){
    setSaving(true);setError('');setCleanupNotice('');
    try{
      if(!apply)setRetention(await post<RetentionPreview>('preview-retention',{runs,keep:Number(keepHistory)}));
      else {
        const result=await post<{removed:number}>('apply-retention',{runs,keep:retention?.keep,token:retention?.token});
        setRetention(undefined);setCleanupNotice(`Removed ${result.removed} historical revisions. Current graph and Integration runs were preserved.`);
        setHistory((await post<{items:SavedRevision[]}>('history',{runs})).items);
      }
    }catch(e){setError(String(e));setRetention(undefined);}finally{setSaving(false);}
  }
  async function revisionAction(action:'preview-update'|'apply-update'|'restore',revision?:SavedRevision){
    setSaving(true);setError('');
    try{
      if(action==='preview-update')setPreview(await post<UpdatePreview>(action,{runs}));
      else {setGraph(await post<Graph>(action,{runs,token:preview?.token,run:revision?.run,revision:revision?.revision,graph_revision:graph?.revision}));setPreview(undefined);setRetention(undefined);setConcept('');setRelation('');setOffset(0);}
    }catch(e){setError(String(e));setPreview(undefined);}finally{setSaving(false);}
  }
  async function suggest(type:string){
    setError('');setBusy(true);
    try{await post('suggest',{runs,type});}catch(e){setError(String(e));setBusy(false);}
  }
  async function refineConcepts(){
    setError('');setBusy(true);
    try{await post('concepts',{runs});}catch(e){setError(String(e));setBusy(false);}
  }
  async function renameConcept(id:string,label:string){
    setError('');setSaving(true);
    try{setGraph(await post<Graph>('rename-concept',{runs,concept:id,label,revision:graph?.revision}));}catch(e){setError(String(e));}finally{setSaving(false);}
  }
  async function refresh(){
    setError('');
    try {
      const o=await api<Overview>('/knowledge',undefined,lakeId);
      setOverview(o);setRuns(old=>old.filter(id=>o.runs.some(r=>r.id===id&&r.supported)));setQueryRuns(old=>old.filter(id=>o.runs.some(r=>r.id===id&&r.supported)));
      setConcept('');setRelation('');setOffset(0);setEpoch(v=>v+1);
    } catch(e){setError(String(e));}
  }
  async function decide(type:string,signature:string,status:string){
    setError('');setSaving(true);
    try{setGraph(await post<Graph>('direction',{runs,type,signature,status,proposal_revision:graph?.types.find(t=>t.label===type)?.proposal?.revision}));}catch(e){setError(String(e));}finally{setSaving(false);}
  }
  async function override(type:Graph['types'][number],edges:Proposal['edges']){
    setError('');setSaving(true);
    try{setGraph(await post<Graph>('override',{runs,type:type.label,signature:type.signature,proposal_revision:type.proposal?.revision,edges}));}catch(e){setError(String(e));}finally{setSaving(false);}
  }
  async function download(format:string){
    setError('');setExporting(true);
    try {
      const result=await post<{filename:string;media_type:string;content:string}>('export',{runs:tab==='Schema'?runs:queryRuns,box:tab==='Schema'?'tbox':'abox',format});
      const url=URL.createObjectURL(new Blob([result.content],{type:result.media_type+';charset=utf-8'}));
      const a=document.createElement('a');a.href=url;a.download=result.filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    }catch(e){setError(String(e));}finally{setExporting(false);}
  }
  const name=(id:string)=>graph?.concepts.find(c=>c.id===id)?.label||id;
  const contributionPages=Math.max(1,Math.ceil((graph?.layers.length||0)/6));
  const visibleContributionPage=Math.min(contributionPage,contributionPages-1);
  const steps=['Runs','Schema','Refine','Instances','Queries','History'];
  const descriptions=['Choose integrated results','Explore your connected schema','Improve concepts & mappings','Inspect records & evidence','Ask questions & follow paths','Review changes & revisions'];
  const browsing=tab==='Instances';
  const displayPage=browsing?browsePage:page,displaySelected=browsing?browseSelected:selected;
  const displayConcept=browsing?browseConcept:concept,displayRelation=browsing?browseRelation:relation,displayOffset=browsing?browseOffset:offset;
  const chooseRecord=browsing?setBrowseSelected:setSelected,changeConcept=browsing?setBrowseConcept:setConcept,changeRelation=browsing?setBrowseRelation:setRelation,changeOffset=browsing?setBrowseOffset:setOffset;
  const recordsPanel=<section className="kg-real-panel"><div className="kg-auto-filters"><label>Concept<select value={displayConcept} onChange={e=>{changeConcept(e.target.value);changeOffset(0);}}><option value="">All concepts</option>{displayConcept&&!queryGraph?.concepts.some(c=>c.id===displayConcept)&&<option value={displayConcept}>Selected concept outside query scope</option>}{(queryGraph?.concepts||[]).map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select></label><label>Relationship<select value={displayRelation} onChange={e=>{changeRelation(e.target.value);changeOffset(0);}}><option value="">All relationships</option>{displayRelation&&!queryGraph?.relationships.some(r=>r.id===displayRelation)&&<option value={displayRelation}>Selected relationship outside query scope</option>}{(queryGraph?.relationships||[]).map(e=><option key={e.id} value={e.id}>{e.label} · {queryGraph?.concepts.find(c=>c.id===e.source)?.label} / {queryGraph?.concepts.find(c=>c.id===e.target)?.label}</option>)}</select></label><span>{displayPage?.total??'…'} assertions</span></div>
        <div className="kg-auto-instance-layout"><section className="kg-instance-browser" aria-label="Integrated record pairs"><header className="kg-panel-heading"><h4>Connected records</h4><small>Select a pair to inspect its evidence</small></header><div className="kg-auto-instance-list">{displayPage?.items.map(a=><button aria-pressed={displaySelected?.id===a.id&&displaySelected?.run_id===a.run_id} className={displaySelected?.id===a.id&&displaySelected?.run_id===a.run_id?'active':''} key={a.run_id+a.id} onClick={()=>{chooseRecord(a);setPathSeed(a);}}><strong>{a.subject.label} {a.direction==='directed'?'→':a.direction==='bidirectional'?'↔':'---'} {a.object.label}</strong><span>{a.relationship_match?.label??a.relation}</span>{!!a.relationship_match?.via.length&&<span className="kg-query-mapped-badge">{a.relationship_match.matched_label}{a.relationship_match.reversed?' · inverse match':' · equivalent match'}</span>}{a.concept_matches?.some(m=>m.via.length>0)&&<span className="kg-query-mapped-badge">Includes reviewed concept mapping</span>}<small>{a.contributions.map(c=>c.run_title).join(" · ")} · {a.contributions.length} run contribution{a.contributions.length===1?"":"s"}</small></button>)}{displayPage&&!displayPage.total&&<p>No instances match these filters.</p>}</div></section><section className="kg-auto-detail" aria-label="Record details and evidence"><header className="kg-panel-heading"><h4>Records & evidence</h4><small>Original values and supporting passages</small></header>{displaySelected?<><h3>{displaySelected.relationship_match?.label??displaySelected.relation}</h3><p>{displaySelected.contributions.length} contributing run(s) · {displaySelected.document}</p><div className="kg-auto-records">{[displaySelected.subject,displaySelected.object].map((r,i)=><section key={i}><h4>{r.concept} · {r.label}</h4><p>{r.concept_reason}</p><small>{r.source} · Row {Math.max(1,r.row-1)}</small><dl>{r.columns.map((c,j)=><div key={j}><dt>{c}</dt><dd>{String(r.cells[j]??'—')}</dd></div>)}</dl>{!!r.augmentation_claims?.length&&<section className="kg-record-claims"><h4>Reviewed attribute claims</h4>{r.augmentation_claims.map(c=><div key={c.layer+c.id}><strong>{c.column}: {String(c.value)}{c.unit?' · unit '+c.unit:''}</strong><p>{c.origin==='manual'?'Manually entered · no textual grounding asserted':'Accepted extraction · '+c.grounding}{c.conflict?' · differs from original':''}</p><small>{c.layer_title}</small></div>)}</section>}</section>)}</div>{displaySelected.attribute_matches&&<AttributeMatchExplanation matches={displaySelected.attribute_matches}/>} {displaySelected.relationship_match&&<RelationshipMatchExplanation match={displaySelected.relationship_match}/>} {displaySelected.concept_matches&&<ConceptMatchExplanation matches={displaySelected.concept_matches}/>}<div className="kg-auto-actions"><button className="kg-primary" onClick={()=>{setPathSeed(displaySelected);setQueryTask('Follow paths');setTab('Queries');}}>Query from these records →</button><button onClick={()=>{setPathSeed(displaySelected);setTool('Valid time');setTab('Refine');}}>Review validity →</button></div><h4>Supporting evidence by run</h4>{displaySelected.contributions.map(c=><section key={c.run_id}><strong>{c.run_title}</strong>{c.evidence.map((p,i)=><blockquote key={i}>{p.context_text||p.text}</blockquote>)}</section>)}</>:<div className="kg-panel-empty"><strong>Follow a connection</strong><p>Select an assertion to inspect both records and their supporting evidence.</p></div>}</section></div>
        <div className="kg-auto-actions"><button disabled={!displayPage||displayOffset===0} onClick={()=>changeOffset(Math.max(0,displayOffset-25))}>Previous</button><span>Page {Math.floor(displayOffset/25)+1} of {Math.max(1,Math.ceil((displayPage?.total||0)/25))}</span><button disabled={!displayPage||displayOffset+25>=displayPage.total} onClick={()=>changeOffset(displayOffset+25)}>Next</button></div>
      </section>;
  const queryScopeSummary=<div className="kg-query-scope-status"><strong>Query scope · {queryRuns.length} {queryRuns.length===1?'run':'runs'}</strong><p>{queryGraph?.layers.map(l=>l.title).join(' · ')||'No query runs selected.'}</p><small>{queryLoading?'Loading query schema…':`${queryGraph?.count??0} unique assertions before filters`}</small></div>;
  return <section className="kg kg-workspace kg-auto kg-guided">
    <header className="kg-heading journey-workspace-heading"><div><span className="kg-eyebrow">KNOWLEDGE GRAPH · {lakeName}</span><h2>From integrated records. <em>To connected knowledge.</em></h2><p>Build your view, explore its structure, and follow every relationship to its evidence.</p></div>{!savedDemo&&<DataJourneyButton stage="Knowledge Graph"><KnowledgeJourney lakeId={lakeId} graph={graph} instanceGraph={queryGraph}/></DataJourneyButton>}</header>
    <nav className="lake-flow-steps kg-workflow-steps" role="tablist" aria-label="Knowledge Graph steps" onKeyDown={event=>{
      if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
      const buttons=[...event.currentTarget.querySelectorAll<HTMLButtonElement>('button')];const current=buttons.indexOf(document.activeElement as HTMLButtonElement);
      const next=event.key==='Home'?0:event.key==='End'?buttons.length-1:(current+(event.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length;
      event.preventDefault();buttons[next]?.focus();buttons[next]?.click();
    }}>{steps.map((step,i)=><button key={step} role="tab" id={'kg-step-'+step} aria-controls={'kg-panel-'+step} aria-selected={tab===step} tabIndex={tab===step?0:-1} onClick={()=>{if(step==='Queries')setQueryTask('Visual query');setTab(step);}}><b>{String(i+1).padStart(2,'0')}</b><span>{step}<small>{descriptions[i]}</small></span></button>)}</nav>
    <div className="kg-workflow-status"><span>{runs.length} schema runs · {queryRuns.length} instance-query runs</span><span>{busy?overview?.job?.phase:loading?'Loading saved graph…':graph?.layers.some(l=>l.update_available)?'Updates available · review in Runs':'Saved graph ready'}</span></div>
    {error&&<p role="alert" className="kg-real-notice">{error}</p>}
    <section role="tabpanel" id="kg-panel-Runs" aria-labelledby="kg-step-Runs" hidden={tab!=='Runs'}>
    <RunPicker catalog={overview?.runs||[]} schemaRuns={runs} queryRuns={queryRuns} disabled={busy||saving||loading||!scopesReady} post={post} onApply={(scope,ids)=>{if(scope==='schema')setRuns([...ids]);else{const next=applyRecordSelection({visible:runs,query:queryRuns},ids);setRuns(next.visible);setQueryRuns(next.query);setQueryGraph(undefined);setPage(undefined);setSelected(undefined);setAttributeFilter(undefined);setOffset(0);setConcept('');setRelation('');}}}/>
    <button disabled={loading||busy||saving} onClick={()=>void refresh()}>Refresh saved runs & updates</button>
    {graph&&<>      {<section className="kg-revision-notice"><strong>{graph.layers.some(l=>l.update_available)?'Graph updates available':'Saved graph revisions · up to date'}</strong><p>You are viewing saved graph revisions. Updates may include Integration changes or improved schema projection. Preview changes before replacing them; instances and downloads still use the displayed revisions.</p><button disabled={busy||saving||loading||!graph.layers.some(l=>l.update_available)} onClick={()=>void revisionAction('preview-update')}>Preview updates</button></section>}
      {preview&&<section className="kg-revision-notice"><strong>Review graph update</strong>{preview.updates.map(u=><div key={u.run}><h4>{u.title}</h4><p>{u.before} → {u.after} assertions · {u.added} added · {u.removed} removed · {u.retained} retained · {u.evidence_changed} evidence changes</p>{u.semantic_reset&&<p>Semantic classifications belong to the previous Integration revision. This update returns to provisional concepts until you infer them again.</p>}</div>)}<p>These are projection differences, not claims that facts became true or false. A previous projection is saved before replacement.</p><button disabled={busy||saving||!preview.updates.length} onClick={()=>void revisionAction('apply-update')}>Apply previewed updates</button><button disabled={saving} onClick={()=>setPreview(undefined)}>Keep current graph</button></section>}
      <div className="kg-auto-summary"><span><b>{graph.concepts.length}</b> concepts</span><span><b>{graph.types.length}</b> relationship types</span><span><b>{graph.count}</b> unique assertions</span><span><b>{graph.layers.length}</b> visible schema layers</span></div>
      <section className="kg-layer-comparison"><h3>Compare run contributions · {graph.contribution_count} contributions / {graph.shared_count} shared assertions</h3>
        <p>Repeated assertions count once when the versioned records, projected values, concept assignments, curated relationship and evidence document version match. Different evidence passages remain attached to their contributing runs.</p>
        <div className="kg-layer-cards">{graph.layers.slice(visibleContributionPage*6,visibleContributionPage*6+6).map(l=><article key={l.run}><strong>{l.title}</strong><dl><div><dt>Contributed</dt><dd>{l.count}</dd></div><div><dt>Only in this selected run</dt><dd>{l.exclusive}</dd></div><div><dt>Also in another selected run</dt><dd>{l.shared}</dd></div></dl><button disabled={busy||saving||loading} onClick={()=>{const next=excludeFromViews({visible:runs,query:queryRuns},l.run);setRuns(next.visible);setQueryRuns(next.query);setQueryGraph(undefined);setPage(undefined);setSelected(undefined);setAttributeFilter(undefined);setConcept('');setRelation('');setOffset(0);}}>Exclude from all views</button><small>Removes this run from the schema and instance query scopes. Assertions supported by remaining runs stay available.</small></article>)}</div>
        <div className="kg-picker-pagination"><span>Contributions · Page {visibleContributionPage+1} / {contributionPages}</span><div><button disabled={!visibleContributionPage} onClick={()=>setContributionPage(visibleContributionPage-1)}>Previous contributions</button><button disabled={visibleContributionPage+1>=contributionPages} onClick={()=>setContributionPage(visibleContributionPage+1)}>Next contributions</button></div></div>
        <p>Counts compare the selected runs, not time periods. Absence from a run does not mean a fact was withdrawn.</p>
      </section>
</>}
    <div className="lake-flow-next"><p>Select at least one Integration run. Existing graph revisions stay available until you approve an update.</p><button disabled={loading||!runs.length} onClick={()=>setTab('Schema')}>Explore schema →</button></div>
    </section>
    {graph&&<>
    <section role="tabpanel" id="kg-panel-Schema" aria-labelledby="kg-step-Schema" hidden={tab!=='Schema'}>
      <div className="kg-step-intro"><div><h3>Your schema at a glance</h3><p>Concepts describe entity classes. Select a concept to reveal attributes; follow a relationship to inspect its instances.</p></div><div className='kg-auto-actions'><button onClick={()=>{setTool('Relationships');setTab('Refine');}}>Edit relationships</button><button onClick={()=>setTab('Refine')}>Refine this schema →</button></div></div>
      <div className="kg-auto-summary"><span><b>{graph.concepts.length}</b> concepts</span><span><b>{graph.types.length}</b> relationship types</span><span><b>{graph.count}</b> unique assertions</span><span><b>{graph.layers.length}</b> visible schema layers</span></div>
{tab==='Schema'&&<>      <div className="kg-auto-exports"><span>Download {'T-Box · schema'}</span><button disabled={exporting||saving||loading} onClick={()=>void download('ttl')}>Turtle (.ttl)</button><button disabled={exporting||saving||loading} onClick={()=>void download('jsonld')}>JSON-LD (.jsonld)</button>{exporting&&<small role="status">Preparing download…</small>}</div>
        <RelationshipEditor graph={graph} runs={runs} post={post} seed={graphEdit} disabled={busy||saving||loading} onChanged={()=>setEpoch(v=>v+1)} graphView={(host,onEditingChange)=><SchemaCanvas workspace={{...graph,layers:graph.layers.map(l=>({...l,snapshot:''}))}} onInspect={inspect} onEdit={seed=>setGraphEdit(seed)} editControlsHost={host} onEditingChange={onEditingChange}/>}/>
</>}
    <div className="lake-flow-next"><p>Ready to inspect the underlying records?</p><button onClick={()=>setTab('Instances')}>Explore instances →</button></div>
    </section>
    <section role="tabpanel" id="kg-panel-Refine" aria-labelledby="kg-step-Refine" hidden={tab!=='Refine'}>
      <div className="kg-step-intro"><div><h3>Refine with evidence</h3><p>Start with concept names and assignments. Directions and alignment are optional; review their effects before applying.</p></div><button onClick={()=>setTab('Schema')}>View schema</button></div>
      <nav className="kg-task-tabs" aria-label="Schema refinement tasks">{['Concepts','Assignments','Entity keys','Identity review','Augmentation layers','Valid time','Relationships','Directions','Suggestions','Class mappings','Relationship mappings','Attribute mappings'].map(t=><button key={t} aria-pressed={tool===t} onClick={()=>setTool(t)}>{t}</button>)}</nav>
{tab==='Refine'&&tool==='Valid time'&&queryGraph&&<ValidityReview graph={queryGraph} runs={queryRuns} seed={pathSeed} post={post} disabled={busy||saving||loading} onChoose={()=>setTab('Instances')}/>}
      <div hidden={tool!=='Concepts'}>{graph.layers.some(l=>l.update_available)&&<p className="kg-flow-guide">Review pending updates in Runs before inferring concepts.<button onClick={()=>setTab('Runs')}>Review updates</button></p>}        <section className="kg-concept-refinement"><div><strong>{graph.layers.every(l=>l.semantic)?'Semantic concepts · inferred from records and evidence':'Provisional concepts · grouped by source columns'}</strong><p>Infer entity classes from actual values and text, including different classes within one column. LLM classifications remain inspectable; they are not a validated ontology.</p></div><button className="kg-primary" disabled={inferenceUnavailable||busy||saving||loading||!graph.count||graph.layers.some(l=>l.update_available)} onClick={()=>void refineConcepts()}>{graph.layers.every(l=>l.semantic)?'Refine concepts again':'Infer semantic concepts'}</button>{busy&&<p role="status">{overview?.job?.phase||'Preparing semantic task…'}</p>}</section>
        <p className="kg-predicate-note">Relationship labels below follow your Integration merges and renames exactly. Concept inference and direction suggestions do not rename them.</p>
        <section className="kg-concept-definitions"><h3>Concept names & definitions · Rename</h3><p>Names apply throughout this lake for the same concept ID, including instances and exports. Renaming does not merge concepts or change their definitions.</p>{graph.concepts.map(c=><ConceptName key={c.id} concept={c} disabled={busy||saving} onSave={label=>renameConcept(c.id,label)}/>)}</section>
</div>
      <div hidden={tool!=='Assignments'}><AssignmentReview graph={graph} runs={runs} disabled={busy||saving||loading} post={post} onChanged={()=>setEpoch(v=>v+1)}/></div>
      {tab==='Refine'&&tool==='Relationships'&&<RelationshipEditor graph={graph} runs={runs} post={post} disabled={busy||saving||loading} onChanged={()=>setEpoch(v=>v+1)}/>}
      <div hidden={tool!=='Directions'}>        <section className="kg-auto-directions"><header><div><strong>Optional · Give relationships a direction</strong><p>Dashed lines start undirected. Ask your configured LLM to review the schema and a few examples, then approve once per relationship type.</p></div>{busy&&<span role="status">{overview?.job?.phase||'Asking the LLM…'}</span>}</header>
          <div className="kg-auto-direction-grid">{graph.types.map(t=><article key={t.label}><header><strong>{t.label}</strong><small>{t.proposal?.status==='accepted'?'Direction applied':'Undirected'}</small></header>
            {t.proposal?.status==='suggested'?<><div>{t.proposal.edges.map(p=>{const e=graph.relationships.find(e=>e.id===p.id)!;return <div className="kg-auto-suggestion" key={p.id}><b>{name(p.direction==='reverse'?e.target:e.source)} {p.direction==='undirected'?'---':p.direction==='both'?'↔':'→'} {name(p.direction==='reverse'?e.source:e.target)}</b><p>{p.reason}</p></div>;})}</div><small>Suggested by {t.proposal.model}</small><div className="kg-auto-actions"><button className="kg-primary" disabled={busy||saving} onClick={()=>void decide(t.label,t.signature,'accepted')}>Apply to {t.label}</button><button disabled={busy||saving} onClick={()=>void decide(t.label,t.signature,'dismissed')}>Keep undirected</button></div></>:
              t.proposal?.status==='accepted'?<button disabled={busy||saving} onClick={()=>void decide(t.label,t.signature,'dismissed')}>Reset to undirected</button>:<button disabled={inferenceUnavailable||busy||saving} onClick={()=>void suggest(t.label)}>Suggest direction</button>}
            <DirectionOverride key={t.label+(t.proposal?.revision||t.signature)} graph={graph} type={t} disabled={busy||saving} onSave={edges=>override(t,edges)}/>
          </article>)}</div>
        </section>
</div>
      <div hidden={tool!=='Suggestions'}><AlignmentSuggestions activeRequest={busy&&overview?.job?.kind==='alignment'} graph={graph} runs={runs} disabled={busy||saving||loading} post={post} onStarted={()=>setBusy(true)} onChanged={()=>setEpoch(v=>v+1)}/></div>
      <div hidden={tool!=='Class mappings'}><ConceptAlignment graph={graph} runs={runs} disabled={busy||saving||loading} post={post} onChanged={()=>setEpoch(v=>v+1)}/></div>
      <div hidden={tool!=='Relationship mappings'}><PropertyAlignment graph={graph} runs={runs} disabled={busy||saving||loading} post={post} onChanged={()=>setEpoch(v=>v+1)}/></div>
      <div hidden={tool!=='Augmentation layers'}><AugmentationLayers graph={graph} runs={runs} active={tool==='Augmentation layers'&&tab==='Refine'} disabled={busy||saving||loading} post={post}/></div>
      <div hidden={tool!=='Identity review'}><IdentityReview graph={graph} runs={runs} active={tool==='Identity review'&&tab==='Refine'} disabled={busy||saving||loading} post={post}/></div>
      <div hidden={tool!=='Entity keys'}><EntityKeys graph={graph} runs={runs} active={tool==='Entity keys'&&tab==='Refine'} disabled={busy||saving||loading} post={post}/></div>
      <div hidden={tool!=='Attribute mappings'}><AttributeAlignment graph={graph} runs={runs} disabled={busy||saving||loading} post={post} onChanged={()=>setEpoch(v=>v+1)}/></div>
    </section>
    <section role="tabpanel" id="kg-panel-Instances" aria-labelledby="kg-step-Instances" hidden={tab!=='Instances'}>
      <div className="kg-step-intro"><div><h3>Inspect your integrated records</h3><p>Choose a concept or relationship, then open a record pair to see its source values and evidence.</p></div><button onClick={()=>setTab('Runs')}>Choose runs</button></div>
      {tab==='Instances'&&<><div className="kg-auto-exports"><span>A-Box · all instances in {queryRuns.length} selected runs</span><button disabled={exporting||saving||queryLoading} onClick={()=>void download('ttl')}>Turtle (.ttl)</button><button disabled={exporting||saving||queryLoading} onClick={()=>void download('jsonld')}>JSON-LD (.jsonld)</button></div>
      {answerTraversal&&<section className="kg-answer-traversal" aria-label="Selected query traversal"><div className="kg-auto-actions"><strong>Query answer · full traversal</strong><button onClick={()=>{setTab('Queries');}}>Back to {queryTask==='Compare views'?'time query':'visual query'}</button><button onClick={()=>{setAnswerTraversal(undefined);setBrowseSelected(undefined);setBrowseOffset(0);}}>Browse all instances</button></div><p>The instance list below contains only this answer’s connections. Select a pair to inspect its full source records.</p><QueryWitnessDetails witness={answerTraversal}/></section>}
      <p className="kg-record-scope"><strong>Instance scope · {queryRuns.length} runs</strong> · {queryLoading?'Loading records…':`${queryGraph?.count??0} unique assertions`} · {queryGraph?.layers.map(l=>l.title).join(' · ')||'No runs selected'}</p>{recordsPanel}</>}
    </section>
    <section role="tabpanel" id="kg-panel-Queries" aria-labelledby="kg-step-Queries" hidden={tab!=='Queries'}>
      <div className="kg-step-intro"><div><h3>Ask questions of your connected data</h3><p>Find records by their values, follow a chain of relationships, or revisit a captured graph.</p></div><button onClick={()=>setTab('Runs')}>Choose query runs</button></div>
      <nav className="kg-task-tabs" aria-label="Query tasks">{['Visual query','Find records','Follow paths','Identity bridges','Saved views','Compare views'].map(t=><button key={t} aria-pressed={queryTask===t} onClick={()=>setQueryTask(t)}>{t}</button>)}</nav>
      {tab==='Queries'&&!['Visual query','Saved views','Compare views'].includes(queryTask)&&queryScopeSummary}
      {queryTask==='Visual query'&&queryGraph&&<VisualQuery onTemporalRecipe={recipe=>{setTimeRecipe(recipe);setCompareTask('Query by time');setQueryTask('Compare views');}} graph={queryGraph} runs={queryRuns} post={post} disabled={tab!=='Queries'||queryLoading||busy||saving} scopeSummary={queryScopeSummary} onOpenAnswer={w=>{setAnswerTraversal(w);setBrowseConcept('');setBrowseRelation('');setBrowseOffset(0);setBrowseSelected(undefined);setTab('Instances');}}/>}
      {tab==='Queries'&&queryTask==='Find records'&&<><div className="kg-query-matching-grid"><ConceptQueryScope mode={conceptMode} onMode={m=>{setConceptMode(m);setOffset(0);}} concept={concept} scope={page?.concept_scope} loading={!page||queryLoading}/><RelationshipQueryScope mode={relationshipMode} onMode={m=>{setRelationshipMode(m);setOffset(0);}} relationship={relation} scope={page?.relationship_scope} loading={!page||queryLoading}/></div><AttributeQueryFilter attributes={queryGraph?.attributes??[]} concepts={queryGraph?.concepts??[]} applied={attributeFilter} scope={page?.attribute_scope} disabled={queryLoading} onApply={c=>{setAttributeFilter(c);setOffset(0);setError('');}} onClear={()=>{setAttributeFilter(undefined);setOffset(0);setError('');}}/>{recordsPanel}</>}
      {tab==='Queries'&&queryTask==='Follow paths'&&queryGraph&&<><div className="kg-query-start"><div><strong>{pathSeed?`Starting assertion · ${pathSeed.relation}`:'Choose a starting record'}</strong><p>{pathSeed?`${pathSeed.subject.label} / ${pathSeed.object.label}`:'Inspect a record pair in Instances or Find records, then follow its connections.'}</p></div><button onClick={()=>setTab('Instances')}>Choose another record pair</button></div><PathWorkspace graph={queryGraph} records={pathSeed?[pathSeed.subject,pathSeed.object]:[]} runs={queryRuns} disabled={queryLoading||busy||saving} post={post}/></>}
      {tab==='Queries'&&queryTask==='Identity bridges'&&queryGraph&&<IdentityBridges graph={queryGraph} runs={queryRuns} disabled={queryLoading||busy||saving} post={post}/>}
      {tab==='Queries'&&queryTask==='Saved views'&&<QueryCheckpoints graph={graph} runs={runs} post={post}/>}
      {queryTask==='Compare views'&&<>
        <nav className="kg-task-tabs" aria-label="Compare view tasks">{['Compare snapshots','Query by time'].map(t=><button key={t} aria-pressed={compareTask===t} onClick={()=>setCompareTask(t)}>{t}</button>)}</nav>
        {tab==='Queries'&&compareTask==='Compare snapshots'&&<CompareCheckpoints post={post} onSavedViews={()=>setQueryTask('Saved views')}/>}
        {compareTask==='Query by time'&&queryGraph&&<VisualQuery temporalQueries initialRecipe={timeRecipe} graph={queryGraph} runs={queryRuns} post={post} disabled={tab!=='Queries'||queryLoading||busy||saving} scopeSummary={queryScopeSummary} onOpenAnswer={w=>{setAnswerTraversal(w);setBrowseConcept('');setBrowseRelation('');setBrowseOffset(0);setBrowseSelected(undefined);setTab('Instances');}}/>}
      </>}
    </section>
    <section role="tabpanel" id="kg-panel-History" aria-labelledby="kg-step-History" hidden={tab!=='History'}>
      <div className="kg-step-intro"><div><h3>Your graph's history</h3><p>Review saved projections and mapping decisions. Restoring a projection or clearing history requires an explicit action.</p></div></div>
      <nav className="kg-task-tabs" aria-label="History views">{['Revisions','Decisions'].map(t=><button key={t} aria-pressed={historyView===t} onClick={()=>setHistoryView(t)}>{t}</button>)}</nav>
      <div hidden={historyView!=='Revisions'}>      {<section className="kg-layer-comparison"><h3>Saved projection history · {history.length} revisions</h3><p>Restores records and schema membership. Current concept name overrides and compatible direction choices still apply.</p>{!history.length&&<p>No earlier projections yet. Applying an update will preserve the current projection here.</p>}<section className="kg-retention"><strong>Manage saved history</strong><p>Cleanup affects only the selected runs. The displayed revision is always protected. Nothing is deleted automatically.</p><label>Keep newest inactive revisions per run<input type="number" min="0" max="1000" step="1" value={keepHistory} disabled={saving||busy} onChange={e=>{setKeepHistory(e.target.value);setRetention(undefined);setCleanupNotice('');}}/></label><button disabled={saving||busy||!history.length||keepHistory===''||!Number.isInteger(Number(keepHistory))||Number(keepHistory)<0||Number(keepHistory)>1000} onClick={()=>void historyCleanup()}>Preview history cleanup</button>
        {retention&&<div className="kg-retention-preview" role="region" aria-label="History cleanup preview"><strong>{retention.candidates.length} revisions to delete · {(retention.bytes/1024).toFixed(1)} KiB of stored payload</strong><p>{retention.retained} inactive revisions retained · {retention.protected} archived copies of displayed revisions protected.</p>{retention.candidates.slice(0,30).map(c=><p key={c.run+c.revision}>{c.title} · {c.count} assertions · {new Date(c.recorded*1000).toLocaleString()}</p>)}{retention.candidates.length>30&&<p>And {retention.candidates.length-30} more revisions.</p>}<p>Deleted revisions cannot be restored. SQLite can reuse the space; the database file may not immediately become smaller.</p><button disabled={saving||busy||!retention.candidates.length} onClick={()=>void historyCleanup(true)}>Permanently delete {retention.candidates.length} historical revisions</button><button disabled={saving} onClick={()=>setRetention(undefined)}>Cancel cleanup</button></div>}{cleanupNotice&&<p role="status">{cleanupNotice}</p>}
      </section>{history.map(h=><div className="kg-history-item" key={h.run+h.revision}><span>{h.title} · {h.count} assertions · Saved {new Date(h.recorded*1000).toLocaleString()}</span><button disabled={busy||saving||graph.layers.some(l=>l.run===h.run&&l.revision===h.revision)} onClick={()=>void revisionAction('restore',h)}>Restore projection</button></div>)}</section>}
</div>
      <div hidden={historyView!=='Decisions'}><MappingHistory revision={graph.revision} post={post}/></div>
    </section>
    </>}
    {!graph&&tab!=='Runs'&&<p className="kg-flow-guide">{loading?'Loading saved graph…':'Choose Integration runs to begin.'}<button onClick={()=>setTab('Runs')}>Go to Runs</button></p>}
  </section>;
}
