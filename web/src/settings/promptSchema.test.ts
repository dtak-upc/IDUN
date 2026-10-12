import {test} from 'node:test';
import assert from 'node:assert/strict';
import {effectivePromptSchema,presetSchema,type PromptSchema} from './promptSchema.ts';
const clinical:PromptSchema={mode:'strict',labels:['TREATS','ADVERSE_EFFECT','NEGATIVE','UNRESOLVED'],definitions:{TREATS:'Treats diagnosis'}};
const generic:PromptSchema={mode:'open',labels:['NEGATIVE','UNRESOLVED'],definitions:{}};
test('open mode discards leaked domain labels and definitions for any preset',()=>{
 for(const pid of ['clinical-preset-v1','generic-evidence-v1','open-discovery-v1']){
  const result=presetSchema(pid,clinical,'open');assert.deepEqual(result.labels,generic.labels);assert.equal(result.definitions.TREATS,undefined);
 }
 assert.equal(clinical.definitions.TREATS,'Treats diagnosis');
});
test('restore retains chosen mode and only the clinical preset supplies clinical defaults',()=>{
 assert.deepEqual(presetSchema('generic-evidence-v1',generic,'hybrid').labels,generic.labels);
 assert.equal(presetSchema('generic-evidence-v1',generic,'strict').mode,'strict');
 assert.ok(presetSchema('clinical-preset-v1',clinical,'hybrid').labels.includes('TREATS'));
});
test('explicit custom strict and hybrid schemas retain labels and meanings',()=>{
 for(const mode of ['strict','hybrid'] as const)assert.deepEqual(effectivePromptSchema({...clinical,mode}).labels,clinical.labels);
});
test('preset metadata does not leak into the schema save payload',()=>{
 const catalogEntry={...clinical,name:'Clinical',template:'A prompt template'};
 assert.deepEqual(Object.keys(presetSchema('clinical-preset-v1',catalogEntry)).sort(),['definitions','labels','mode','prompt_id']);
});
