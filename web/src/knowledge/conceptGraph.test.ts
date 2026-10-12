import {test} from 'node:test';
import assert from 'node:assert/strict';
import {groupConceptPreview} from './conceptGraph.ts';
test('same proposed concepts group nodes, retain attributes and all edge scopes',()=>{
 const result=groupConceptPreview([{id:'a',label:'City',attributes:[{name:'name',datatype:'string'}]},{id:'b',label:'city',attributes:[{name:'population',datatype:'number'}]},{id:'c',label:'Country'}],[{id:'e1',label:'PART_OF',source:'a',target:'c',direction:'directed',count:2},{id:'e2',label:'PART_OF',source:'b',target:'c',direction:'directed',count:3}]);
 assert.equal(result.classes.length,2);assert.equal(result.classes[0].attributes?.length,2);assert.equal(result.properties.length,1);assert.equal(result.properties[0].count,5);assert.deepEqual(result.properties[0].members,['e1','e2']);
});
test('directions and distinct predicate lineage remain separate; self-links remain visible',()=>{
 const r=groupConceptPreview([{id:'a',label:'City'},{id:'b',label:'City'}],[{id:'x',property_id:'p1',label:'RELATED_TO',source:'a',target:'b',direction:'directed'},{id:'y',property_id:'p2',label:'RELATED_TO',source:'a',target:'b',direction:'directed'}]);
 assert.equal(r.properties.length,2);assert.equal(r.properties[0].source,r.properties[0].target);
});
