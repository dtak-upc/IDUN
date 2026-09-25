import { publicFile } from "./paths";
import type { SemanticPlan, DiffData } from "../integration/SemanticResults";
export type Link = {
  id: string;
  table: string;
  text: string;
  row_index: number;
  row_version: string;
  text_version: string;
  context: string;
  start: number;
  end: number;
  score: number;
  text_preview: string;
};
type Row = { index: number; record_id: string; cells: string[] };
export type Source = {
  id: string;
  name: string;
  kind: string;
  columns: string[];
  rows: Row[];
  text: string;
  total: number;
  excluded_columns: number;
};
export type Snapshot = {
  lake_id?: string;
  link_storage?: {total:number;page_size:number;pages:string[];sources:Record<string,string>;candidates:Record<string,{id:string;name:string;score:number;links:number}[]>};
  assets: import("../storage/api").Job[];
  routes: Record<string, unknown>;
  bridges: (Link & {left: string; right: string})[];
  version: number;
  state: {
    revision: string;
    status: string;
    sources: { id: string; name: string }[];
  };
  sources: Record<string, Source>;
  links: Link[];
  plan: SemanticPlan;
  plans?: (SemanticPlan & {created?: number; stale?: boolean})[];
  suggestions?: Record<string, unknown>;
};
type LakeManifest = { default_id: string; lakes: {id:string;name:string;files:number;snapshot:string}[] };
let manifestPromise: Promise<LakeManifest> | undefined;
const loaded = new Map<string, Promise<Snapshot>>();
const linkCache = new Map<string, Promise<Link[]>>();
async function linksFile(s: Snapshot, file: string): Promise<Link[]> {
  const url = publicFile(`demo/${s.lake_id}/${file}`);
  if (!linkCache.has(url)) {
    if(linkCache.size >= 12) linkCache.delete(linkCache.keys().next().value!);
    linkCache.set(url, fetch(url).then(async r => {if(!r.ok || !r.body) throw Error('Saved evidence unavailable');return new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).json() as Promise<Link[]>;}).catch(e=>{linkCache.delete(url);throw e;}));
  }
  return linkCache.get(url)!;
}
async function findLink(s: Snapshot, id: string) {return (s.link_storage ? await linksFile(s,`evidence/${id.slice(0,2)}.json.gz`) : s.links).find(l=>l.id===id);}
async function sourceLinks(s: Snapshot, source: string) {return s.link_storage ? (s.link_storage.sources[source] ? linksFile(s,s.link_storage.sources[source]) : []) : s.links.filter(l=>l.table===source||l.text===source);}
const manifests = () => manifestPromise ||= fetch(publicFile('demo/lakes.json')).then(async r => {if (!r.ok) throw Error('Saved lakes unavailable');return r.json() as Promise<LakeManifest>;});
export async function snapshot(lake = '') {
  const manifest = await manifests();
  const entry = manifest.lakes.find(l => l.id === (lake || manifest.default_id));
  if (!entry) throw Error('Saved lake not found');
  if (!loaded.has(entry.id)) loaded.set(entry.id, fetch(publicFile('demo/'+entry.snapshot)).then(async r => {if(!r.ok)throw Error('Saved lake unavailable');return r.json() as Promise<Snapshot>;}));
  return loaded.get(entry.id)!;
}
export const savedCsvHref = (lake: string, plan: string, relation?: string) => publicFile(`demo/${lake || 'dummy'}/${plan}--${relation || 'all'}.csv`);

export async function savedApi<T>(path: string, init?: RequestInit, lake = ''): Promise<T> {
  const manifest = await manifests(), url = new URL(path, 'https://saved.invalid');
  const method = (init?.method || 'GET').toUpperCase();
  if (url.pathname === '/lakes' && method === 'GET') return manifest as T;
  const s = await snapshot(lake), plans = s.plans || [s.plan];
  const offset = Math.max(0, Number(url.searchParams.get('offset') || 0));
  const source = url.searchParams.get('source') || '', candidate = url.searchParams.get('candidate') || '';
  const revision = s.state.revision;
  const id = url.pathname.split('/').at(-1)!;
  // Static hosting serves saved outputs. It never fabricates successful model calls.
  if (method !== 'GET') throw Error('This action needs the connected inference service. Saved results remain available.');
  let result: unknown;
  if (url.pathname === '/integration') result = {discovery_ready:true,plans:plans.map(p=>({...p, stale:('stale' in p && p.stale) || false})),job:null};
  else if (url.pathname === '/integration/schema') result = s.plan.schema_config || {mode:'open',labels:[],definitions:{}};
  else if (/^\/integration\/[^/]+\/relationship-suggestions$/.test(url.pathname)) result = s.suggestions?.[url.pathname.split('/')[2]] || {saved:false,groups:[],reviewed_labels:0};
  else if (/^\/integration\/[^/]+\/diff$/.test(url.pathname)) result = s.routes[url.pathname] || {has_previous:false,rows:[],counts:{added:0,changed:0,withdrawn:0,unchanged:0,total_current:0,total_previous:0}};
  else if (/^\/integration\/[^/]+$/.test(url.pathname)) result = plans.find(p=>p.id===id);
  else if (url.pathname === '/assets') {
    const query=(url.searchParams.get('q')||'').toLowerCase(),dataset=url.searchParams.get('dataset');
    const assets=s.assets.filter(a=>a.name.toLowerCase().includes(query)&&(!dataset||dataset===a.dataset_id)).map(a=>({...a,path:a.name}));
    result={total:s.assets.length,matched:assets.length,offset,assets:assets.slice(offset,offset+25)};
  } else if (/^\/assets\/[^/]+\/preview$/.test(url.pathname)) {
    const src=s.sources[url.pathname.split('/')[2]];
    if(src) result={version:'saved',total:src.total,offset,offsetUnit:'records',records:src.kind==='csv'?src.rows.slice(offset,offset+20).map(r=>({id:r.record_id,index:r.index,start:null,end:null,value:r.cells,clipped:false})):[{id:src.id,index:1,start:0,end:src.text.length,value:src.text,clipped:false}]};
  } else if (url.pathname === '/discovery') result=s.state;
  else if (url.pathname === '/discovery/links' || url.pathname === '/discovery/bridges') {
    if (s.link_storage && url.pathname.endsWith('/links') && !source) {
      const storage=s.link_storage, file=storage.pages[Math.floor(offset/storage.page_size)];
      const items=file?await linksFile(s,file):[];
      return {revision,total:storage.total,offset,items:items.slice(offset%storage.page_size,offset%storage.page_size+20)} as T;
    }
    const items=url.pathname.endsWith('/links')?(source?await sourceLinks(s,source):s.links):s.bridges;
    result={revision,total:items.length,offset,items:items.slice(offset,offset+20)};
  } else if (url.pathname.startsWith('/discovery/links/')) result=await findLink(s,id);
  else if (url.pathname === '/discovery/workbench') {
    const k=Math.min(20,Math.max(1,Number(url.searchParams.get('k')||5)));
    if (s.link_storage) {const candidates=s.link_storage.candidates[source] || [];return {revision,source,kind:s.sources[source]?.kind,total:candidates.length,k,candidates:candidates.slice(0,k)} as T;}
    const groups=new Map<string,{id:string;name:string;score:number;links:number}>();
    for(const l of s.links){const other=l.table===source?l.text:l.text===source?l.table:'';if(!other)continue;const group=groups.get(other)||{id:other,name:s.sources[other]?.name||other,score:0,links:0};group.score=Math.max(group.score,l.score);group.links++;groups.set(other,group);}
    result={revision,source,kind:s.sources[source]?.kind,total:groups.size,k,candidates:[...groups.values()].sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id)).slice(0,k)};
  } else if(url.pathname === '/discovery/workbench-links') {
    const items=(await sourceLinks(s,source)).filter(l=>(l.table===source&&l.text===candidate)||(l.text===source&&l.table===candidate));result={revision,total:items.length,offset,items:items.slice(offset,offset+20)};
  } else if(url.pathname.startsWith('/discovery/evidence/')) {
    const first=await findLink(s,id);if(!first)throw Error('Saved evidence not found');
    const companion=url.searchParams.get('companion'), second=companion?await findLink(s,companion):undefined;
    if(companion&&(!second||second.text!==first.text))throw Error('Invalid saved evidence companion');
    const links=second?[first,second]:[first];const text=Array.from(s.sources[first.text].text);
    const start=Math.max(0,Math.min(...links.map(l=>l.start))-1200),end=Math.min(text.length,Math.max(...links.map(l=>l.end))+1200);
    if(text.slice(first.start,first.end).join('')!==first.text_preview)throw Error('Saved evidence offsets do not match');
    result={revision,links,tables:links.map(l=>{const src=s.sources[l.table];return {...src,selected:l.row_index,rows:src.rows.filter(r=>Math.abs(r.index-l.row_index)<=5)};}),document:{id:first.text,name:s.sources[first.text].name,text:text.slice(start,end).join(''),start,end,highlight_start:first.start,highlight_end:first.end,version:first.text_version}};
  } else if(s.routes[url.pathname]) result=s.routes[url.pathname];
  else if(url.pathname === '/health') result={status:'ok'};
  else if(url.pathname === '/storage') result={status:'idle'};
  else if(url.pathname === '/settings/hf/loaded') result={loaded:false,repo_id:'',vram_mb:0};
  else if(url.pathname === '/inference/readiness') result={ready:false,sources:[],blockers:[]};
  if(result===undefined)throw Error('This action needs the connected inference service.');
  return result as T;
}
