import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceDiagnostics} from '../lib/studio/source-diagnostics.mjs';
const doc={id:'d',name:'拉美资料',state:'ready',revision:1};
const chunk={id:'k',docId:'d',docRevision:1,title:'巴西收款',body:'巴西 拉美 收款条件',state:'approved',external:true,purpose:'fact'};
test('Sources diagnostics separates review, permissions, stale versions, dates and rules without changing eligibility',()=>{
 const cases=[['pending',{state:'pending'},{}],['source_missing',{},null],['source_pending',{}, {state:'review'}],['disabled',{}, {disabled:true}],['superseded',{}, {supersededBy:'new'}],['revision',{docRevision:0},{}],['future',{}, {effective:'2099-01-01'}],['expired',{}, {expires:'2000-01-01'}],['internal',{external:false},{}],['rule',{purpose:'rule'},{}]];
 for(const [reason,k,d] of cases){const r=sourceDiagnostics([{...chunk,...k}],d===null?[]:[{...doc,...d}],'拉美');assert.equal(r.eligible,0,reason);assert.equal(r.excluded[0].key,reason);assert.equal(r.excluded[0].count,1);assert.equal(r.suggestions.length,1);}
 const r=sourceDiagnostics([chunk,{...chunk,id:'excluded',state:'excluded'}],[doc],'拉美');assert.equal(r.total,1);assert.equal(r.eligible,1);assert.deepEqual(r.excluded,[]);assert.deepEqual(r.suggestions,[]);
});
test('Sources diagnostics counts each knowledge once and groups relevant blocked items by source',()=>{
 const r=sourceDiagnostics([{...chunk,state:'pending',external:false},{...chunk,id:'k2',state:'pending'}],[doc],'巴西');assert.equal(r.excluded[0].count,2);assert.equal(r.excluded.length,1);assert.equal(r.suggestions.length,1);assert.equal(r.suggestions[0].documentId,'d');
});
