import {test} from 'node:test';
import assert from 'node:assert/strict';
import {relationshipMergeScope} from './relationshipMergeScope.ts';
const pair=(candidate:string,a='a',b='b')=>({candidate,left:{source:a,name:'same.csv'},right:{source:b,name:'same.csv'}});
const row=(candidate:string,relation:string)=>({candidate,relation});
test('same source pair can merge regardless of case, record or endpoint order',()=>{
 const plan={cases:[pair('P1'),pair('P2','b','a')],output:[row('P1','ONE'),row('P2','TWO')]};
 const scope=relationshipMergeScope(plan,['ONE','TWO'],'NEW');assert.equal(scope.reason,'');assert.equal(scope.tables.length,2);
});
test('different table IDs, repeated filenames and a multi-pair label block global merges',()=>{
 const plan={cases:[pair('P1'),pair('P2','a','c')],output:[row('P1','ONE'),row('P2','TWO')]};
 assert.match(relationshipMergeScope(plan,['ONE','TWO']).reason,/different source-table pairs/);
 plan.output.push(row('P2','ONE'));assert.match(relationshipMergeScope(plan,['ONE','TWO']).reason,/different source-table pairs/);
});
test('rename into an existing target cannot bypass scope; unused rename remains available',()=>{
 const plan={cases:[pair('P1'),pair('P2','a','c')],output:[row('P1','ONE'),row('P2','TWO')]};
 assert.match(relationshipMergeScope(plan,['ONE'],'TWO').reason,/different source-table pairs/);
 assert.equal(relationshipMergeScope(plan,['ONE'],'NEW').reason,'');
});
test('missing source identity, same table and unsupported-only labels fail closed',()=>{
 assert.match(relationshipMergeScope({cases:[pair('P1','a','a')],output:[row('P1','ONE'),row('P1','TWO')]},['ONE','TWO']).reason,/distinct/);
 assert.match(relationshipMergeScope({cases:[],output:[row('P1','ONE'),row('P1','TWO')]},['ONE','TWO']).reason,/unavailable/);
 assert.match(relationshipMergeScope({cases:[pair('P1')],output:[row('P1','ONE')],decisions:[{relations:['TWO']}]},['ONE'],'TWO').reason,/every relationship/);
});
test('unrelated merge leaves table-pair conflicts unchanged and identifies their rows',()=>{
 const plan={cases:[pair('P1'),pair('P2','a','c'),pair('P3','d','e')],output:[row('P1','RISK'),row('P1','FACTOR'),row('P2','FACTOR'),row('P3','CONTROL'),row('P3','CONTROLS')]};
 const before=relationshipMergeScope(plan,['RISK','FACTOR']);
 assert.equal(before.conflicts?.length,2);
 assert.deepEqual(before.conflicts?.[1].candidates,['P2']);
 assert.deepEqual(before.conflicts?.[1].labels,['FACTOR']);
 assert.equal(relationshipMergeScope(plan,['CONTROL','CONTROLS']).reason,'');
 const updated={...plan,output:plan.output.map(r=>['CONTROL','CONTROLS'].includes(r.relation)?{...r,relation:'NEW_CONTROL'}:r)};
 assert.deepEqual(relationshipMergeScope(updated,['RISK','FACTOR']),before);
});
