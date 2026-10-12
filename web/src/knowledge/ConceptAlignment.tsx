import {MappingExamples,type ExampleGroup} from './MappingExamples';
import {useEffect,useState} from 'react';

type Axiom={id:string;source:string;target:string;kind:string};
type Schema={revision:string;concepts:{id:string;label:string}[];alignments?:Axiom[]};
type Preview={examples?:ExampleGroup[];token:string;mapping:Axiom;relationships:number;attribute_conflicts:string[]};
export function ConceptAlignment({graph,runs,disabled,post,onChanged}:{graph:Schema;runs:string[];disabled:boolean;post:<T>(path:string,body:unknown)=>Promise<T>;onChanged:()=>void}) {
  const [source,setSource]=useState(''),[target,setTarget]=useState(''),[kind,setKind]=useState('subclass');
  const [preview,setPreview]=useState<Preview>(),[error,setError]=useState(''),[pending,setPending]=useState(false);
  useEffect(()=>{setPreview(undefined);setError('');},[graph.revision,source,target,kind]);
  const name=(id:string)=>graph.concepts.find(c=>c.id===id)?.label||id;
  async function action(path:string,id?:string) {
    setPending(true);setError('');
    try {const result=await post<Preview>(path,{runs,revision:graph.revision,source,target,kind,token:preview?.token,id});
      if(path==='preview-alignment')setPreview(result);else {setPreview(undefined);onChanged();}
    }catch(e){setError(String(e));setPreview(undefined);}finally{setPending(false);}
  }
  const locked=disabled||pending;
  return <section className="kg-layer-comparison kg-alignment"><h3>Align concepts · {graph.alignments?.length||0} reviewed mappings</h3>
    <p>Add a schema statement across these concepts. Source records, Integration relationships and instance counts stay unchanged. Mappings apply lake-wide wherever both concepts appear.</p>
    <div className="kg-alignment-fields">
      <label>Concept<select aria-label="Alignment concept" value={source} disabled={locked} onChange={e=>setSource(e.target.value)}><option value="">Choose concept</option>{graph.concepts.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select></label>
      <label>Schema statement<select value={kind} disabled={locked} onChange={e=>setKind(e.target.value)}><option value="subclass">is a subclass of</option><option value="equivalent">is equivalent to</option></select></label>
      <label>Other concept<select aria-label="Alignment other concept" value={target} disabled={locked} onChange={e=>setTarget(e.target.value)}><option value="">Choose concept</option>{graph.concepts.filter(c=>c.id!==source).map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select></label>
    </div>
    <button disabled={locked||!source||!target||source===target} onClick={()=>void action('preview-alignment')}>Preview schema mapping</button>
    {error&&<p role="alert">{error}</p>}
    {preview&&<section className="kg-revision-notice" aria-label="Schema mapping preview"><strong>{name(preview.mapping.source)} {preview.mapping.kind==='subclass'?'is a subclass of':'is equivalent to'} {name(preview.mapping.target)}</strong><p>Adds one schema link. {preview.relationships} integrated schema relationships touch these concepts; their labels and endpoints are preserved. No records are merged or reversed.</p><p>Instances can include this mapping when you choose Include reviewed mappings. Exact assignments remain available.</p>{!!preview.attribute_conflicts.length&&<p>Review differing attribute types: {preview.attribute_conflicts.join(', ')}. No attribute mapping or conversion will be applied.</p>}<MappingExamples groups={preview.examples}/><button disabled={locked} onClick={()=>void action('apply-alignment')}>Accept schema mapping</button><button disabled={locked} onClick={()=>setPreview(undefined)}>Cancel mapping</button></section>}
    {graph.alignments?.map(a=><div className="kg-history-item" key={a.id}><span>{name(a.source)} {a.kind==='subclass'?'⊆':'≡'} {name(a.target)}</span><button disabled={locked} onClick={()=>void action('undo-alignment',a.id)}>Undo mapping</button></div>)}
  </section>;
}
