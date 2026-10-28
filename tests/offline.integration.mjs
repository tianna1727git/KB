// Replaces v1 pre-generated draft import coverage with the current bound handoff protocol.
import {Miniflare,createFetchMock} from 'miniflare';
import {build} from 'esbuild';
import {mkdirSync,readdirSync,readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
mkdirSync('.sites-runtime/tests',{recursive:true});
await build({entryPoints:['tests/worker.ts'],bundle:true,format:'esm',platform:'browser',target:'es2022',outfile:'.sites-runtime/tests/handoff.mjs'});
const mock=createFetchMock();mock.disableNetConnect();
const mf=new Miniflare({modules:true,scriptPath:'.sites-runtime/tests/handoff.mjs',compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],r2Buckets:['BUCKET'],bindings:{AI_URL:'https://must-not-call.test/chat',AI_MODEL:'configured-but-unused',KNOWLEDGE_AI_URL:'https://must-not-call.test/chat',KNOWLEDGE_AI_MODEL:'configured-but-unused'},fetchMock:mock});
const identity={'oai-authenticated-user-id':'owner','oai-authenticated-user-email':'owner@example.com'};
async function req(path,body,uid='owner',extra={}){let payload,headers={...identity,'oai-authenticated-user-id':uid,...extra};if(body instanceof FormData){const r=new Request('https://test',{method:'POST',body});headers['content-type']=r.headers.get('content-type');payload=await r.arrayBuffer();}else if(body){payload=JSON.stringify(body);headers['content-type']='application/json';}const r=await mf.dispatchFetch('https://studio.test/api/studio/'+path,{method:body?'POST':'GET',headers,body:payload});return {status:r.status,j:await r.json()};}
const payload=p=>({...p.resultTemplate,reviewed:true});
try{
 const db=await mf.getD1Database('DB');for(const f of readdirSync('drizzle').filter(f=>f.endsWith('.sql')))await db.exec(readFileSync('drizzle/'+f,'utf8').replace(/--> statement-breakpoint/g,'').replace(/\n/g,' '));
 const form=new FormData();form.set('file',new File(['# 拉美市场\n拉美市场需要区分国家条件。'],'拉美.md'));for(const [k,v]of Object.entries({category:'市场研究',purpose:'fact',source:'测试资料',external:'true',effective:'2020-01-01'}))form.set(k,v);
 const did=(await req('upload',form)).j.document.id;let d=(await req('document/'+did)).j;await req('confirm',{ids:d.chunks.map(k=>k.id),riskConfirmed:true});d=(await req('document/'+did)).j;
 const brief={keyword:'拉美',platform:'官网',audience:'卖家',description:'入门介绍',writingRules:'不得编造'};
 let t=(await req('createTask',{...brief,demoFlow:true})).j;
 assert.equal(t.stage,'sources');assert.equal((await req('run',{id:t.id,revision:t.revision})).status,409);
 assert.equal((await req('ingestionRun',{id:t.id,revision:t.revision})).status,404);
 assert.equal((await req('offlineImport',{format:'payo-codex-v1',reviewed:true,package:{kind:'draft'}})).status,409);
 assert.equal((await req('handoffExport',{kind:'task',id:t.id,revision:t.revision})).status,400);
 t=(await req('prepareSources',{id:t.id,revision:t.revision})).j;t=(await req('confirmSources',{id:t.id,revision:t.revision,ids:[d.chunks[0].id]})).j;
 assert.equal((await req('handoffExport',{kind:'task',id:t.id,revision:t.revision},'other')).status,404);
 assert.equal((await req('handoffExport',{kind:'task',id:t.id,revision:t.revision},'owner',{origin:'https://evil.test'})).status,403);
 let ex=await req('handoffExport',{kind:'task',id:t.id,revision:t.revision});assert.equal(ex.status,200);t=ex.j.record;let p=ex.j.package;
 assert.ok(p.input.evidence[0].body.includes('区分国家'));assert.equal(p.input.writingRules,brief.writingRules);assert.ok(!JSON.stringify(p).includes('AI_KEY'));assert.equal(p.revision,t.revision);
 let output={title:'拉美入门',intent:'入门',queries:['拉美市场'],outline:'## 准备 [S1]',missing:[]};
 assert.equal((await req('handoffImport',{...payload(p),reviewed:false,result:output})).status,409);
 assert.equal((await req('handoffImport',{...payload(p),token:'wrong',result:output})).status,409);
 assert.equal((await req('handoffImport',{...payload(p),stage:'write',result:output})).status,409);
 assert.equal((await req('handoffImport',{...payload(p),result:{...output,outline:'## 捏造 [S99]'}})).status,400);
 assert.equal((await req('task/'+t.id)).j.revision,t.revision);
 // Downloading another package revokes the old token even for identical inputs.
 ex=await req('handoffExport',{kind:'task',id:t.id,revision:t.revision});t=ex.j.record;
 assert.equal((await req('handoffImport',{...payload(p),result:output})).status,409);p=ex.j.package;
 let imported=await req('handoffImport',{...payload(p),result:output});assert.equal(imported.status,200);t=imported.j.record;assert.equal(t.stage,'outline');
 assert.equal((await req('handoffImport',{...payload(p),result:output})).status,409);
 assert.equal((await req('handoffExport',{kind:'task',id:t.id,revision:t.revision})).status,400);
 assert.equal((await req('saveTask',{id:t.id,revision:t.revision,markdown:'绕过大纲 [S1]'})).status,400);
 t=(await req('approveOutline',{id:t.id,revision:t.revision})).j;
 ex=await req('handoffExport',{kind:'task',id:t.id,revision:t.revision});t=ex.j.record;p=ex.j.package;
 const draft={title:'拉美入门',markdown:'拉美市场需要区分国家条件。[S1]',seoTitle:'拉美',metaDescription:'入门',slug:'latam',missing:[]};
 const concurrent=await Promise.all([req('handoffImport',{...payload(p),result:{...draft,draftVersion:999,stage:'done'}}),req('handoffImport',{...payload(p),result:draft})]);assert.deepEqual(concurrent.map(r=>r.status).sort(),[200,409]);t=concurrent.find(r=>r.status===200).j.record;assert.equal(t.stage,'check');assert.equal(t.draftVersion,1);
 assert.equal((await req('complete',{id:t.id,revision:t.revision,confirmed:true})).status,409);
 ex=await req('handoffExport',{kind:'task',id:t.id,revision:t.revision});t=ex.j.record;p=ex.j.package;
 const checker={summary:'需核对',issues:[{severity:'medium',quote:'不存在的原句',reason:'条件',suggestion:'补充'}],missing:[]};
 assert.equal((await req('handoffImport',{...payload(p),result:checker})).status,400);
 t=(await req('handoffImport',{...payload(p),result:{...checker,issues:[{...checker.issues[0],quote:'拉美市场需要区分国家条件。'}]}})).j.record;assert.equal(t.stage,'review');
 const first=(await req('taskHistory/'+t.id)).j.versions[0];assert.equal(first.brief.keyword,brief.keyword);assert.equal(first.evidence[0].sourceVersion,1);
 t=(await req('requestRevision',{id:t.id,revision:t.revision})).j;assert.equal(t.stage,'revise');
 ex=await req('handoffExport',{kind:'task',id:t.id,revision:t.revision});t=ex.j.record;p=ex.j.package;assert.equal(p.input.issues.length,1);
 t=(await req('handoffImport',{...payload(p),result:{...draft,markdown:draft.markdown+'\n\n编辑说明'}})).j.record;assert.equal(t.draftVersion,2);assert.equal(t.round,1);
 assert.deepEqual((await req('taskHistory/'+t.id)).j.versions.map(v=>v.draftVersion),[2,1]);assert.equal((await req('taskHistory/'+t.id)).j.versions[1].markdown,first.markdown);
 ex=await req('handoffExport',{kind:'task',id:t.id,revision:t.revision});t=ex.j.record;p=ex.j.package;
 // Metadata, permissions and source version changes must invalidate exported results.
 await req('documentPermission',{id:d.id,revision:d.revision,external:false});
 assert.equal((await req('handoffImport',{...payload(p),result:{summary:'无问题',issues:[],missing:[]}})).status,409);
 assert.equal((await req('task/'+t.id)).j.stage,'check');assert.equal((await req('taskHistory/'+t.id)).j.versions.length,2);
 const download=await mf.dispatchFetch('https://studio.test/api/studio/taskHistory/'+t.id+'/'+encodeURIComponent(first.id),{headers:identity});assert.equal(download.status,200);assert.match(await download.text(),/区分国家/);
 assert.equal((await req('handoffImport',{kind:'task',id:t.id,revision:t.revision,blob:'x'.repeat(513*1024)})).status,400);
 assert.equal((await req('state')).j.config.model,true);assert.equal((await req('state')).j.config.manual,false);
 mock.assertNoPendingInterceptors();console.log('PASS: bound handoff exports, invalid/foreign/replayed/stale results rejected, source permission changes, outline and check gates, revision V1/V2 history and downloads, no paid API calls even with configured models.');
}finally{await mf.dispose();await mock.close();}
