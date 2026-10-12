// Same-origin runtime assets; serial execution protects SQLite transactions.
let runtime;
const initialized=new Set();
const changes=new Map();
let queue=Promise.resolve();
async function start(base){
  if(!runtime) runtime=(async()=>{
    const {loadPyodide}=await import(/* @vite-ignore */ base+'runtime/pyodide.mjs');
    const py=await loadPyodide({indexURL:base+'runtime/'});
    const code=await fetch(base+'demo/runtime.zip').then(r=>{if(!r.ok)throw Error('Workspace runtime unavailable');return r.arrayBuffer();});
    py.unpackArchive(code,'zip',{extractDir:'/app'});
    py.runPython("import sys, json; sys.path.insert(0, '/app/backend'); import static_runtime");
    return py;
  })();
  return runtime;
}
function database(){return new Promise((resolve,reject)=>{const r=indexedDB.open('idun-public-workspaces',1);r.onupgradeneeded=()=>r.result.createObjectStore('lakes');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
async function saved(key){const db=await database();try{return await new Promise((resolve,reject)=>{const r=db.transaction('lakes').objectStore('lakes').get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}finally{db.close();}}
async function persist(key,data){const db=await database();try{await new Promise((resolve,reject)=>{const tx=db.transaction('lakes','readwrite');tx.objectStore('lakes').put(data,key);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}finally{db.close();}}
async function execute(message){
  if(self.IDUN_DEBUG)console.log('workspace start',message.lake.id,message.path);
  const {base,lake,path,method,body}=message;const py=await start(base);
  const key=lake.id+':'+lake.sha256;
  if(!initialized.has(key)){
    const metadata=await fetch(base+'demo/'+lake.metadata).then(r=>r.json());
    const previous=await saved(key);
    let bytes;
    if(!bytes){
      const pieces=[];
      for(const file of lake.workspace_parts?.length?lake.workspace_parts:[lake.workspace]){
        const response=await fetch(base+'demo/'+file);if(!response.ok)throw Error('Saved lake unavailable');pieces.push(await response.arrayBuffer());
      }
      const compressed=await new Blob(pieces).arrayBuffer();
      const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',compressed)),b=>b.toString(16).padStart(2,'0')).join('');
      if(hash!==lake.sha256)throw Error('Saved lake integrity check failed');
      bytes=new Uint8Array(await new Response(new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
    }
    py.FS.mkdirTree('/workspaces/'+lake.id);
    py.FS.writeFile('/workspaces/'+lake.id+'/catalog.sqlite3',bytes);
    py.globals.set('_slug',lake.id);py.globals.set('_metadata',JSON.stringify({...metadata,files:previous?.files||metadata.files}));
    py.runPython('static_runtime.install(_slug, json.loads(_metadata))');
    py.globals.set('_patches',JSON.stringify(previous?.patches||{}));py.runPython('static_runtime.restore(_slug,json.loads(_patches))');
    changes.set(key,previous?.patches||{});initialized.add(key);
  }
  py.globals.set('_request',JSON.stringify({slug:lake.id,path,method,body}));
  const result=JSON.parse(py.runPython("import json; r=json.loads(_request); json.dumps(static_runtime.dispatch(r['slug'],r['path'],r['method'],r['body']),ensure_ascii=False)"));
  if(result.code>=400)throw Error(result.data.error||'Workspace operation failed');
  py.globals.set('_slug',lake.id);
  const delta=JSON.parse(py.runPython('json.dumps(static_runtime.patches(_slug))'));
  if(Object.keys(delta).length||method!=='GET'&&['/config','/context','/thor/config'].includes(path)){
    const files=JSON.parse(py.runPython("s=static_runtime.stores[_slug]; json.dumps({p.name:json.loads(p.read_text()) for p in s.root.glob('*.json')})"));
    const patches={...changes.get(key),...delta};await persist(key,{patches,files});changes.set(key,patches);
  }
  if(self.IDUN_DEBUG)console.log('workspace done',lake.id,path);
  return result.data;
}
self.onmessage=event=>{const message=event.data;queue=queue.then(async()=>{try{self.postMessage({id:message.id,data:await execute(message)});}catch(e){self.postMessage({id:message.id,error:String(e.message||e)});}});};
