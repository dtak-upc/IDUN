import {test} from 'node:test';
import assert from 'node:assert/strict';
import {restoreScopes,toggleScope,excludeFromViews,applyRecordSelection} from './scopes.ts';

test('hiding a visible run keeps the independent query selection',()=>{
  const scope=restoreScopes({visible:['a','b'],query:['a','b']},['a','b']);
  scope.visible=toggleScope(scope.visible,'a',false);
  assert.deepEqual(scope.visible,['b']);assert.deepEqual(scope.query,['a','b']);
});
test('exclude from all views removes a run from both persisted selections without changing other selections',()=>{
 const current={visible:['a','b'],query:['a','c']};
 const next=excludeFromViews(current,'a');
 assert.deepEqual(next,{visible:['b'],query:['c']});
 assert.deepEqual(current,{visible:['a','b'],query:['a','c']});
 assert.deepEqual(restoreScopes(next,['a','b','c']),next);
 assert.deepEqual(excludeFromViews({visible:['a'],query:['a']},'a'),{visible:[],query:[]});
});
test('adding records restores schema contributions; narrowing records preserves the schema',()=>{
 const excluded={visible:['b'],query:['b']};
 const restored=applyRecordSelection(excluded,['b','a','a']);
 assert.deepEqual(restored,{visible:['b','a'],query:['b','a']});
 assert.deepEqual(excluded,{visible:['b'],query:['b']});
 assert.deepEqual(applyRecordSelection(restored,['a']),{visible:['b','a'],query:['a']});
 assert.deepEqual(applyRecordSelection(restored,[]),{visible:['b','a'],query:[]});
});
test('restoring selections prunes deleted runs independently without filling empty scope',()=>{
  assert.deepEqual(restoreScopes({visible:[],query:['deleted','b','b']},['a','b']),{visible:[],query:['b']});
  assert.deepEqual(restoreScopes({visible:['a'],query:[]},['a']),{visible:['a'],query:[]});
});
test('first visit defaults both scopes to the same run without aliasing',()=>{
  const value=restoreScopes(null,['a','b']);value.visible.push('b');
  assert.deepEqual(value.query,['a']);
  assert.deepEqual(restoreScopes(null,[]),{visible:[],query:[]});
});
test('malformed persisted values and repeated selection are handled',()=>{
  assert.deepEqual(restoreScopes({visible:'bad',query:[null,4,'a','a']},['a']),{visible:['a'],query:['a']});
  assert.deepEqual(toggleScope(['a'],'a',true),['a']);
});
