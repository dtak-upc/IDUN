import {MappingExamples,type ExampleGroup} from './MappingExamples';
import {useEffect,useState} from 'react';
type Edge={id:string;label:string;source:string;target:string;direction:string};
type Mapping={id:string;source:string;target:string;kind:string;stale:boolean};
type Schema={revision:string;concepts:{id:string;label:string}[];relationships:Edge[];property_alignments?:Mapping[]};
type Preview={examples?:ExampleGroup[];token:string;mapping:Mapping;counts:number[];endpoints:{left:string;right:string;same:boolean}[]};
export function PropertyAlignment({graph,runs,disabled,post,onChanged}:{graph:Schema;runs:string[];disabled:boolean;post:<T>(path:string,body:unknown)=>Promise<T>;onChanged:()=>void}) {
 const [source,setSource]=useState(''),[target,setTarget]=useState(''),[kind,setKind]=useState('equivalent');
 const [preview,setPreview]=useState<Preview>(),[error,setError]=useState(''),[pending,setPending]=useState(false);
 useEffect(()=>{setPreview(undefined);setError('');},[graph.revision,source,target,kind]);
 const concept=(id:string)=>graph.concepts.find(c=>c.id===id)?.label||id;
 const name=(id:string)=>{const e=graph.relationships.find(e=>e.id===id);return e?`${e.label} · ${concept(e.source)} ${e.direction==='directed'?'→':'—'} ${concept(e.target)}`:id;};
 const locked=disabled||pending;
 async function action(path:string,id?:string){setPending(true);setError('');try{
 const result=await post<Preview>(path,{runs,revision:graph.revision,source,target,kind,token:preview?.token,id});
 if(path==='preview-property')setPreview(result);else{setPreview(undefined);onChanged();}
 }catch(e){setPreview(undefined);setError(String(e));}finally{setPending(false);}}
 return <section className="kg-layer-comparison kg-alignment"><h3>Align relationships · {graph.property_alignments?.length||0} reviewed mappings</h3>
 <p>Relate two schema properties without renaming your Integration tables. Set a single direction for each using the direction controls below first. A mapping applies to the selected endpoint-specific properties, wherever they appear in this lake.</p>
 <div className="kg-alignment-fields">
 <label>Relationship<select aria-label="Property alignment source" value={source} disabled={locked} onChange={e=>setSource(e.target.value)}><option value="">Choose relationship</option>{graph.relationships.map(e=><option key={e.id} value={e.id}>{name(e.id)}</option>)}</select></label>
 <label>Property statement<select aria-label="Property mapping kind" value={kind} disabled={locked} onChange={e=>setKind(e.target.value)}><option value="equivalent">is equivalent to</option><option value="inverse">is inverse of</option></select></label>
 <label>Other relationship<select aria-label="Property alignment target" value={target} disabled={locked} onChange={e=>setTarget(e.target.value)}><option value="">Choose relationship</option>{graph.relationships.filter(e=>e.id!==source).map(e=><option key={e.id} value={e.id}>{name(e.id)}</option>)}</select></label>
 </div><button disabled={locked||!source||!target||source===target} onClick={()=>void action('preview-property')}>Preview property mapping</button>
 {error&&<p role="alert">{error}</p>}
 {preview&&<section className="kg-revision-notice" aria-label="Property mapping preview"><strong>{name(preview.mapping.source)} {preview.mapping.kind==='inverse'?'is inverse of':'is equivalent to'} {name(preview.mapping.target)}</strong>
 <p>{preview.counts[0]} and {preview.counts[1]} saved assertions use these properties. Counts may overlap; no records will be merged.</p>
 <p>{preview.mapping.kind==='inverse'?'Inverse interpretation: P(a,b) corresponds to Q(b,a).':'Equivalent interpretation: P(a,b) corresponds to Q(a,b).'} Instances can use this mapping when you choose Include equivalent & inverse. Source assertions remain available with their original relationship and evidence.</p>
 {preview.endpoints.map((e,i)=><p key={i}>{i===0?'Source role':'Target role'}: {e.left} ↔ {e.right}{!e.same?' · Different concept IDs; review this implication. No class equivalence is added.':''}</p>)}
 <MappingExamples groups={preview.examples}/><button disabled={locked} onClick={()=>void action('apply-property')}>Accept property mapping</button><button disabled={locked} onClick={()=>setPreview(undefined)}>Cancel property mapping</button></section>}
 {graph.property_alignments?.map(a=><div className="kg-history-item" key={a.id}><span>{name(a.source)} {a.kind==='inverse'?'inverse of':'equivalent to'} {name(a.target)}{a.stale?' · Stale: endpoint roles changed. Excluded from export; undo and review again.':''}</span><button disabled={locked} onClick={()=>void action('undo-property',a.id)}>Undo property mapping</button></div>)}
 </section>;
}
