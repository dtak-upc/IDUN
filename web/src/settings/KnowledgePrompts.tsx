import {useEffect,useState} from 'react';
import {api} from '../storage/api';
type Operation='concepts'|'directions'|'alignment'|'property_alignment'|'attribute_alignment';
type Prompt={operation:Operation;instruction:string;system:string;custom:boolean;revision:string;sequence:number};
type Catalog={version:string;current:Record<Operation,Prompt>;defaults:Record<Operation,string>;history:{sequence:number;operation:Operation;instruction:string|null;created:number}[]};
type Preview={prompt:Prompt;token:string};
const names:Record<Operation,string>={concepts:'Concept inference',directions:'Relationship direction suggestions',alignment:'Concept alignment suggestions',property_alignment:'Relationship alignment suggestions',attribute_alignment:'Attribute alignment suggestions'};
export function KnowledgePrompts({lakeId}:{lakeId:string}){
 const [catalog,setCatalog]=useState<Catalog>(),[operation,setOperation]=useState<Operation>('concepts');
 const [instruction,setInstruction]=useState(''),[useDefault,setUseDefault]=useState(true),[preview,setPreview]=useState<Preview>();
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[epoch,setEpoch]=useState(0);
 useEffect(()=>{let live=true;setBusy(true);setError('');void api<Catalog>('/knowledge/automatic/prompts',undefined,lakeId).then(c=>{if(live)setCatalog(c);}).catch(e=>{if(live)setError(String(e));}).finally(()=>{if(live)setBusy(false);});return()=>{live=false;};},[lakeId,epoch]);
 useEffect(()=>{if(catalog){const p=catalog.current[operation];setInstruction(p.instruction);setUseDefault(!p.custom);setPreview(undefined);}},[catalog,operation]);
 function draft(text:string,defaults=false){setInstruction(text);setUseDefault(defaults);setPreview(undefined);setNotice('');}
 async function action(save=false){if(!catalog)return;setBusy(true);setError('');setNotice('');try{
 const result=await api<Catalog|Preview>('/knowledge/automatic/'+(save?'save-prompt':'preview-prompt'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({version:catalog.version,operation,instruction,use_default:useDefault,token:preview?.token})},lakeId);
 if(save){setCatalog(result as Catalog);setNotice('KG prompt saved for this lake. Future explicit requests will use it; saved graph results stay unchanged.');}else setPreview(result as Preview);
 }catch(e){setError(String(e));setPreview(undefined);}finally{setBusy(false);}}
 return <section className="settings-card kg-prompt-settings" aria-label="Knowledge Graph prompts">
 <div className="settings-card-title"><span>KG</span><div><h2>Knowledge Graph prompts</h2><p>Guide concept inference, directions and alignment suggestions for the active lake. These prompts are separate from Integration prompts.</p></div></div>
 <p>Defaults work across domains. Customize when your lake needs more precise terminology or distinctions. Instructions apply to future requests only; output validation remains enforced.</p>
 {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
 {!catalog&&<button type="button" disabled={busy} onClick={()=>setEpoch(v=>v+1)}>{busy?'Loading KG prompts…':'Retry loading KG prompts'}</button>}
 {catalog&&<><label>KG operation<select aria-label="KG operation" value={operation} disabled={busy} onChange={e=>{setOperation(e.target.value as Operation);setNotice('');setError('');}}>{Object.entries(names).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
 <p>Saved: {catalog.current[operation].custom?'Lake override':'Built-in default'} · {catalog.current[operation].sequence?`revision ${catalog.current[operation].sequence}`:'original instructions'}</p>
 <label>KG instructions<textarea aria-label="KG instructions" rows={10} maxLength={12000} value={instruction} disabled={busy} onChange={e=>draft(e.target.value)}/></label>
 <small>{instruction.length.toLocaleString()} / 12,000 characters · Plain instructions; no template placeholders. Projected records and evidence are sent separately.</small>
 <div className="settings-actions"><button type="button" disabled={busy} onClick={()=>draft(catalog.defaults[operation],true)}>Use default instructions</button><button type="button" disabled={busy||!instruction.trim()} onClick={()=>void action()}>Preview KG prompt</button></div>
 {preview&&<div className="prompt-preview-box"><h3>Effective KG system prompt</h3><pre className="prompt-preview-text">{preview.prompt.system}</pre><p>No model call was made. Saving does not rerun inference.</p><button type="button" className="settings-save-btn" disabled={busy} onClick={()=>void action(true)}>Save KG prompt to this lake</button></div>}
 <details><summary>KG prompt history · last 20 saved changes</summary>{catalog.history.filter(h=>h.operation===operation).map(h=><div className="kg-prompt-history" key={h.sequence}><span>Revision {h.sequence} · {new Date(h.created*1000).toLocaleString()} · {h.instruction===null?'Default':'Custom'}</span><button type="button" disabled={busy} onClick={()=>draft(h.instruction??catalog.defaults[operation],h.instruction===null)}>Load as draft</button></div>)}{!catalog.history.some(h=>h.operation===operation)&&<p>No saved changes for this operation.</p>}</details>
 <button type="button" disabled={busy} onClick={()=>{setPreview(undefined);setEpoch(v=>v+1);}}>Reload saved KG prompts</button></>}
 </section>;
}
