import {publicBase,publicFile} from './paths';
type Lake={id:string;name:string;files:number;workspace:string;workspace_parts?:string[];metadata:string;sha256:string};
type Manifest={default_id:string;lakes:Lake[]};
let manifest:Promise<Manifest>|undefined,worker:Worker|undefined,sequence=0;
const waiting=new Map<number,{resolve:(v:unknown)=>void;reject:(e:Error)=>void}>();
function start(){
  if(!worker){worker=new Worker(new URL('./browser-worker.js',import.meta.url),{type:'module'});
    worker.onmessage=e=>{const p=waiting.get(e.data.id);if(!p)return;waiting.delete(e.data.id);e.data.error?p.reject(Error(e.data.error)):p.resolve(e.data.data);};
    worker.onerror=()=>{for(const p of waiting.values())p.reject(Error('Browser workspace could not start. Reload to retry.'));waiting.clear();worker?.terminate();worker=undefined;};
  }return worker;
}
export async function browserApi<T>(path:string,init?:RequestInit,lake=''):Promise<T>{
  const m=await (manifest ||=fetch(publicFile('demo/lakes.json')).then(async r=>{if(!r.ok)throw Error('Saved lakes unavailable');return r.json() as Promise<Manifest>;}));
  if(path==='/lakes'){
    if(init?.method && init.method!=='GET')throw Error('Select one of the published lakes. Importing new sources requires an inference backend.');
    return m as T;
  }
  const selected=m.lakes.find(l=>l.id===(lake||m.default_id));if(!selected)throw Error('Select a saved data lake.');
  const id=++sequence;const response=new Promise<unknown>((resolve,reject)=>waiting.set(id,{resolve,reject}));
  start().postMessage({id,base:new URL(publicBase,location.href).href,lake:selected,path,method:init?.method||'GET',body:init?.body?JSON.parse(String(init.body)):{}});
  return response as Promise<T>;
}
export async function browserDownload(path:string,lake:string){
  const result=await browserApi<{download:string;content_type:string}>(path,undefined,lake);
  const url=URL.createObjectURL(new Blob([result.download],{type:result.content_type}));
  const a=document.createElement('a');a.href=url;a.download=path.includes('format=json')?'idun-export.json':'idun-export.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export function installBrowserDownloads(){
  document.addEventListener('click',event=>{
    const a=(event.target as Element)?.closest<HTMLAnchorElement>('a[href]');if(!a)return;
    const url=new URL(a.href,location.href);if(url.origin!==location.origin||!url.pathname.startsWith('/api/v1/'))return;
    const parts=url.pathname.slice('/api/v1/'.length).split('/');
    if(parts[0]!=='lakes'||!parts[1])return;
    event.preventDefault();void browserDownload('/'+parts.slice(2).join('/')+url.search,parts[1]).catch(e=>alert(e.message));
  });
}
