import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mappingPreview,type MappingGraph} from './mappingPreviewModel.ts';
const graph:MappingGraph={concepts:[{id:'a',label:'Organization'},{id:'b',label:'City'}],relationships:[{id:'r1',label:'LOCATED_IN',source:'a',target:'b',direction:'directed'},{id:'r2',label:'HOSTS',source:'b',target:'a',direction:'directed'}],attributes:[{id:'x',concept:'a',name:'name',datatype:'string'},{id:'y',concept:'b',name:'title',datatype:'string'}]};
test('inverse preview crosses roles without rewriting original relationships',()=>{
 const before=JSON.stringify(graph);
 const data=mappingPreview(graph,{family:'property',source:'r1',target:'r2',kind:'inverse'}).map(e=>e.data);
 assert.equal(data.find(e=>e.id==='proposal-source')?.target,'1t');
 assert.equal(data.find(e=>e.id==='proposal-target')?.target,'1s');
 assert.equal(data.find(e=>e.id==='existing1')?.label,'HOSTS');
 assert.equal(JSON.stringify(graph),before);
});
test('equivalent properties preserve role correspondence',()=>{
 const data=mappingPreview(graph,{family:'property',source:'r1',target:'r2',kind:'equivalent'}).map(e=>e.data);
 assert.equal(data.find(e=>e.id==='proposal-source')?.target,'1s');
 assert.equal(data.find(e=>e.id==='proposal-target')?.target,'1t');
});
test('attribute preview keeps owners distinct',()=>{
 const data=mappingPreview(graph,{family:'attribute',source:'x',target:'y',kind:'equivalent'}).map(e=>e.data);
 assert.equal(data.filter(e=>e.kind==='concept').length,2);
 assert.equal(data.find(e=>e.id==='proposal')?.source,'0a');
 assert.equal(data.find(e=>e.id==='proposal')?.target,'1a');
});
test('subclass arrow goes from specific to general; missing references render no invented graph',()=>{
 const proposal={source:'a',target:'b',kind:'subclass'};
 assert.equal(mappingPreview(graph,proposal).find(e=>e.data.id==='proposal')?.data.directed,1);
 assert.deepEqual(mappingPreview(graph,{...proposal,target:'missing'}),[]);
});
