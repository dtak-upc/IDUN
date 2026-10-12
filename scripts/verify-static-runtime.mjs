import {loadPyodide} from 'pyodide';
import {readFile,writeFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import assert from 'node:assert/strict';
try{
 const py=await loadPyodide();
 py.unpackArchive(new Uint8Array(await readFile('site-demo/runtime.zip')),'zip',{extractDir:'/app'});
 py.runPython("import sys,json;sys.path.insert(0,'/app/backend');import static_runtime");
 const manifest=JSON.parse(await readFile('site-demo/lakes.json','utf8'));const checks=[];
 for(const lake of manifest.lakes){
  const metadata=JSON.parse(await readFile('site-demo/'+lake.metadata,'utf8'));
  const compressed=Buffer.concat(await Promise.all((lake.workspace_parts?.length?lake.workspace_parts:[lake.workspace]).map(f=>readFile('site-demo/'+f))));
  py.FS.mkdirTree('/workspaces/'+lake.id);py.FS.writeFile('/workspaces/'+lake.id+'/catalog.sqlite3',new Uint8Array(gunzipSync(compressed)));
  py.globals.set('_slug',lake.id);py.globals.set('_metadata',JSON.stringify(metadata));py.runPython('static_runtime.install(_slug,json.loads(_metadata))');
  const request=(path,body={},method='GET')=>{py.globals.set('_req',JSON.stringify({slug:lake.id,path,method,body}));const v=JSON.parse(py.runPython("r=json.loads(_req);json.dumps(static_runtime.dispatch(r['slug'],r['path'],r['method'],r['body']))"));if(v.code>=400)throw Error(path+': '+v.data.error);return v.data;};
  for(const path of ['/assets','/datasets','/profile/status','/profile','/discovery','/discovery/landscape','/discovery/handoff','/integration','/augmentation/runs','/augmentation/workspace?scope=source','/knowledge']){request(path);checks.push({lake:lake.id,path});}
  const plans=request('/integration').plans;assert.ok(plans.length);
  console.log(lake.id,'scope preview');request('/discovery/scope/preview',{generation:request('/profile/graph').graph.generation,recipe:{mode:'all'}},'POST');console.log(lake.id,'scope passed');
  const graph=request('/knowledge/automatic/sync',{runs:plans.map(p=>p.id)},'POST');assert.ok(graph.concepts.length);assert.ok(graph.relationships.length);
  assert.ok(graph.layers.every(l=>l.update_available===!metadata.kg_current[l.run]),'Pending updates must match the local lake');
  const edge=graph.relationships[0],query={runs:plans.map(p=>p.id),revision:graph.revision,concept:edge.source,pattern:[{relationship:edge.id,target:edge.target,direction:'outgoing'}],limit:20,budget:1000,start_limit:100};
  const preview=request('/knowledge/automatic/preview-visual-path',query,'POST');
  const answers=request('/knowledge/automatic/visual-path',{...query,request_id:crypto.randomUUID(),preview_token:preview.token},'POST');assert.ok(answers.items.length,'Real saved assertions should answer a one-hop visual query');
  const recipe=request('/knowledge/automatic/save-visual-query',{title:'Static query validation',query,preview_token:preview.token},'POST');
  const delta=JSON.parse(py.runPython('json.dumps(static_runtime.patches(_slug))'));assert.ok(delta.kg_visual_recipes);
  py.globals.set('_saved',JSON.stringify(delta));py.runPython('static_runtime.restore(_slug,json.loads(_saved))');
  assert.equal(request('/knowledge/automatic/get-saved-visual-query',{id:recipe.id},'POST').title,'Static query validation');
  checks.push({lake:lake.id,visual_answers:answers.items.length,saved_query:true});
  request('/knowledge/automatic/instances?runs='+plans.map(p=>p.id).join(','));
  request('/integration/'+plans[0].id+'/journey');
  const before=graph.concepts[0];request('/knowledge/automatic/rename-concept',{runs:plans.map(p=>p.id),revision:graph.revision,concept:before.id,label:before.label+' reviewed'},'POST');
  const updatedGraph=request('/knowledge/automatic/sync',{runs:plans.map(p=>p.id)},'POST');
  for(const box of ['tbox','abox'])for(const format of ['ttl','jsonld'])assert.ok(request('/knowledge/automatic/export',{runs:plans.map(p=>p.id),revision:updatedGraph.revision,format,box},'POST'));
  request('/integration/'+plans[0].id+'/rename',{title:'Reviewed public run'},'POST');
  request('/integration/'+plans[0].id+'/materialize',{},'POST');
  request('/integration/'+plans[0].id+'/csv');
  checks.push({lake:lake.id,graph_concepts:graph.concepts.length,graph_relationships:graph.relationships.length,edit:true});
 }
 await writeFile('.idun/static-runtime-validation.json',JSON.stringify({status:'passed',checks},null,2));console.log('Static WASM runtime passed: '+checks.length+' checks');
}catch(e){console.error(String(e));process.exitCode=1;}
