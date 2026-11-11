import test from 'node:test';import assert from 'node:assert/strict';
import {sourceUsage,withSourceUsage,inheritUsage,publicReferenceURL} from '../lib/studio/usage-scope.mjs';
import {validatePublicReferences,readPublicPage} from '../lib/studio/public-evidence.mjs';
import {citationCheck} from '../lib/studio/knowledge.mjs';
test('source scope overrides stale document and chunk permissions through aliases',()=>{
 const docs=[{id:'doc',libraryId:'library',hash:'hash',usageScope:'reference',source:'https://www.payoneer.com/'}],libraries=[{id:'library',sha256:'hash'}],meta=[{sourceId:'library',usageScope:'writing',revision:3}];
 const updated=withSourceUsage(docs,libraries,meta),chunk=inheritUsage([{id:'chunk',docId:'doc',usageScope:'reference',external:true}],updated)[0];assert.equal(chunk.usageScope,'writing');assert.equal(chunk.usageRevision,3);assert.equal(chunk.canCite,false);assert.equal(chunk.referenceURL,'');assert.equal(docs[0].usageScope,'reference');
 assert.equal(withSourceUsage([{id:'alias',hash:'hash'}],libraries,meta)[0].usageScope,'writing');assert.equal(sourceUsage({external:true}).usageScope,'writing');
 assert.throws(()=>citationCheck('事实[S1]',[{...chunk,ref:'S1'}]),/不可作为参考引用/);
});
test('only public HTTPS reference URLs are accepted',()=>{for(const url of ['http://www.payoneer.com','https://127.0.0.1','https://localhost','https://user:pass@www.payoneer.com','https://[::1]/','https://host.internal'])assert.throws(()=>publicReferenceURL(url));assert.equal(publicReferenceURL('https://www.payoneer.com/path#section'),'https://www.payoneer.com/path');});
const quote='公开来源明确支持这项收款服务，且适用条件以官方说明为准。';
const fetcher=async()=>new Response('<html><title>公开产品说明</title><p>'+quote+'</p></html>',{headers:{'content-type':'text/html'}});
const materials=[{id:'m1',title:'内部资料名',body:'内部产品说明',usageScope:'writing'},{id:'m2',title:'无法核实',usageScope:'writing'}],proposal={url:'https://www.payoneer.com/page',quote,materialIds:['m1'],authorityReason:'官方产品原文支持同一事实'};
test('verified public quotes remain citations while unmatched writing materials are retained',async()=>{const result=await validatePublicReferences(materials,[proposal],{allowAlternativePublicSources:true},{fetcher});assert.equal(result.evidence.length,1);assert.equal(result.evidence[0].title,'公开产品说明');assert.equal(result.evidence[0].body,quote);assert.equal(result.evidence[0].usageScope,'reference');assert.equal(result.evidence[0].title.includes('内部'),false);assert.deepEqual(result.omitted,[]);assert.deepEqual(result.unreferenced.map(x=>x.id),['m2']);assert.equal(result.mappings[0].materialId,'m1');assert.deepEqual(citationCheck('事实[S1]',result.evidence),['S1']);});
test('unreadable, fabricated and disallowed alternative references do not become evidence',async()=>{
 assert.equal((await validatePublicReferences(materials,[{...proposal,quote:'完全未出现在公开网页中的编造事实内容。'}],{allowAlternativePublicSources:true},{fetcher})).evidence.length,0);
 assert.equal((await validatePublicReferences(materials,[proposal],{allowAlternativePublicSources:false},{fetcher})).evidence.length,0);
 assert.equal((await validatePublicReferences([{...materials[0],body:'原始出处：https://www.payoneer.com/page'}],[proposal],{allowAlternativePublicSources:false},{fetcher})).evidence.length,1);
 assert.equal((await validatePublicReferences(materials,[proposal],{allowAlternativePublicSources:true},{fetcher:async()=>new Response('',{status:403})})).evidence.length,0);
});
test('private redirects are rejected and no cookies or authorization are sent',async()=>{let calls=0;await assert.rejects(()=>readPublicPage(proposal.url,async(url,options)=>{calls++;assert.equal(options.headers.Authorization,undefined);assert.equal(options.headers.Cookie,undefined);return new Response('',{status:302,headers:{location:'https://127.0.0.1'}});}));assert.equal(calls,1);});
