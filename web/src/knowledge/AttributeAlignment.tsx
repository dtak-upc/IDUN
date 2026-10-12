import {MappingExamples,type ExampleGroup} from './MappingExamples';
import {useEffect,useState} from 'react';
type Attribute={id:string;concept:string;name:string;datatype:string};
type Mapping={id:string;attributes:Attribute[];stale?:boolean};
type Schema={revision:string;concepts:{id:string;label:string}[];attributes?:Attribute[];attribute_alignments?:Mapping[]};
type Preview={examples?:ExampleGroup[];token:string;mapping:Mapping};
export function AttributeAlignment({graph,runs,disabled,post,onChanged}:{graph:Schema;runs:string[];disabled:boolean;post:<T>(path:string,body:unknown)=>Promise<T>;onChanged:()=>void}){
 const [source,setSource]=useState(''),[target,setTarget]=useState(''),[compatible,setCompatible]=useState(false);
 const [preview,setPreview]=useState<Preview>(),[error,setError]=useState(''),[pending,setPending]=useState(false);
 useEffect(()=>{setPreview(undefined);setCompatible(false);setError('');},[graph.revision,source,target]);
 const name=(a:Attribute)=>`${graph.concepts.find(c=>c.id===a.concept)?.label||a.concept} · ${a.name} (${a.datatype})`;
 const locked=disabled||pending;
 async function action(path:string,id?:string){setPending(true);setError('');try{const result=await post<Preview>(path,{runs,revision:graph.revision,source,target,compatible,token:preview?.token,id});if(path==='preview-attribute')setPreview(result);else{setPreview(undefined);onChanged();}}catch(e){setError(String(e));setPreview(undefined);}finally{setPending(false);}}
 return <section className="kg-layer-comparison kg-alignment"><h3>Align attributes · {graph.attribute_alignments?.length||0} reviewed mappings</h3><p>Declare two attributes equivalent. Matching declared types are required; matching meanings and units need your review. Source values and columns stay intact.</p><div className="kg-alignment-fields">
 <label>Attribute<select aria-label="Attribute alignment source" value={source} disabled={locked} onChange={e=>setSource(e.target.value)}><option value="">Choose attribute</option>{graph.attributes?.map(a=><option key={a.id} value={a.id}>{name(a)}</option>)}</select></label>
 <label>Equivalent attribute<select aria-label="Attribute alignment target" value={target} disabled={locked} onChange={e=>setTarget(e.target.value)}><option value="">Choose attribute</option>{graph.attributes?.filter(a=>a.id!==source).map(a=><option key={a.id} value={a.id}>{name(a)}</option>)}</select></label></div>
 <button disabled={locked||!source||!target||source===target} onClick={()=>void action('preview-attribute')}>Preview attribute mapping</button>{error&&<p role="alert">{error}</p>}
 {preview&&<section className="kg-revision-notice" aria-label="Attribute mapping preview"><strong>{preview.mapping.attributes.map(name).join(' ≡ ')}</strong><p>Exports an equivalent-property schema statement. No values are converted, filled, copied or merged. Instance browsing continues to show original attributes.</p><p>Identical types do not prove identical units or meaning. RDF reasoning may infer both properties and their domain types for the same record.</p><MappingExamples groups={preview.examples}/><label><input type="checkbox" checked={compatible} disabled={locked} onChange={e=>setCompatible(e.target.checked)}/>I confirm matching meaning, units and value representation.</label><button disabled={locked||!compatible} onClick={()=>void action('apply-attribute')}>Accept attribute mapping</button><button disabled={locked} onClick={()=>setPreview(undefined)}>Cancel attribute mapping</button></section>}
 {graph.attribute_alignments?.map(a=><div className="kg-history-item" key={a.id}><span>{a.attributes.map(name).join(' ≡ ')}{a.stale?' · Stale attribute definition; excluded from export. Undo and review again.':''}</span><button disabled={locked} onClick={()=>void action('undo-attribute',a.id)}>Undo attribute mapping</button></div>)}
 </section>;
}
