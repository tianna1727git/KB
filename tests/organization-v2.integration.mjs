import {Miniflare,createFetchMock} from 'miniflare';
import {build} from 'esbuild';import {mkdirSync,readFileSync,readdirSync} from 'node:fs';import assert from 'node:assert/strict';
mkdirSync('.sites-runtime/tests',{recursive:true});await build({entryPoints:['tests/worker.ts'],bundle:true,format:'esm',platform:'browser',target:'es2022',outfile:'.sites-runtime/tests/organization-v2.mjs'});
const mock=createFetchMock();mock.disableNetConnect();
const mf=new Miniflare({modules:true,scriptPath:'.sites-runtime/tests/organization-v2.mjs',compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],r2Buckets:['BUCKET'],fetchMock:mock});
async function req(path,body,uid='owner',extra={}){const headers={'oai-authenticated-user-id':uid,'oai-authenticated-user-email':uid+'@example.com',...extra};let payload;if(body instanceof FormData){const r=new Request('https://test',{method:'POST',body});headers['content-type']=r.headers.get('content-type');payload=await r.arrayBuffer();}else if(body){payload=JSON.stringify(body);headers['content-type']='application/json';}const r=await mf.dispatchFetch('https://studio.test/api/studio/'+path,{method:body?'POST':'GET',headers,body:payload});return {status:r.status,j:await r.json()};}
try{
 const db=await mf.getD1Database('DB');for(const f of readdirSync('drizzle').filter(f=>f.endsWith('.sql')))await db.exec(readFileSync('drizzle/'+f,'utf8').replace(/--> statement-breakpoint/g,'').replace(/\n/g,' '));
 const markdown='# 随心付企业账户绑定\n\n仅限企业账户。\n第1步 准备资料。\n\n第2步 点击确认按钮完成绑定。\n';
 const time=new Date().toISOString();
 async function insert(id,kind,payload,state='stored',owner='owner'){await db.prepare('INSERT INTO studio_records(id,kind,owner,state,revision,payload,created,updated) VALUES(?,?,?,?,1,?,?,?)').bind(id,kind,owner,state,JSON.stringify(payload),time,time).run();}
 await insert('guide-source','library',{name:'企业账户绑定.md',sha256:'guide-hash',fileKey:'guide.md',libraryCategory:'Events',sourceFormat:'pdf',conversionState:'done'});
 await (await mf.getR2Bucket('BUCKET')).put('guide.md',markdown);
 assert.equal((await req('libraryCategoryUpdate',{id:'guide-source',categoryRevision:0,libraryCategory:'Product Guide'})).status,200);
 let r=await req('ingestionStart',{executionMode:'manual',id:'guide-source'});assert.equal(r.status,200,JSON.stringify(r.j));let job=r.j;assert.equal(job.organizationContext.libraryCategory,'Product Guide');
 const exported=await req('knowledgePacketExport',{id:job.id,revision:job.revision});assert.equal(exported.status,200);const packet=exported.j.package;assert.equal(packet.input.blocks.map(b=>b.text).join(''),markdown);assert.ok(packet.schemas.extract.properties.items.items.properties.organization);assert.match(packet.prompts[0].instructions,/步骤编号/);
 const org={scenario:'企业账户绑定',process:'账户绑定',stepNumbers:[1],branch:'',prerequisites:['仅限企业账户。'],conditions:[],dates:[],contentRole:'evergreen',researchTopic:'',toolInputs:[],toolOutputs:[],formulas:[]};
 const item=(quote,step)=>({title:'账户绑定步骤'+step,statement:quote,type:'操作流程',products:['随心付'],platforms:[],regions:[],keywords:['账户绑定'],evidence:[{blockId:'B1',quote}],organization:{...org,stepNumbers:[step],prerequisites:step===1?org.prerequisites:[]}});
 const result={extractions:[{items:[item('仅限企业账户。\n第1步 准备资料。',1),item('第2步 点击确认按钮完成绑定。',2)],omissions:[]}],links:{links:[]},audit:{checks:[{itemId:'P0-K1',supported:true,issues:[]},{itemId:'P0-K2',supported:true,issues:[]}],conflicts:[],summary:'核对完成',uncovered:[]}};
 const imported=await req('knowledgePacketImport',{...packet.resultTemplate,result,reviewed:true});assert.equal(imported.status,200,JSON.stringify(imported.j));job=imported.j.record;
 const committed=await req('ingestionCommit',{id:job.id,revision:job.revision,ids:job.items.map(i=>i.id),reviewed:true});assert.equal(committed.status,200,JSON.stringify(committed.j));
 const detail=(await req('document/'+committed.j.document.id)).j;assert.equal(detail.external,false);assert.equal(detail.processOverviews.length,1);assert.equal(detail.sourceSegments.length,packet.input.blocks.length);assert.ok(detail.chunks.every(k=>k.state==='pending'&&k.libraryCategory==='Product Guide'&&k.sourceFormat==='pdf'));
 const first=detail.chunks.find(k=>k.flow.originalStepNumbers[0]===1);assert.equal(first.flow.nextSourceItemId,'P0-K2');assert.equal(first.productEntities[0].id,'product:payoneer-card');
 const kd=(await req('knowledgeItem/'+first.id)).j;assert.equal(kd.context.steps.length,2);assert.equal((await req('knowledgeItem/'+first.id,undefined,'other')).status,404);
 assert.equal((await db.prepare('SELECT revision FROM studio_records WHERE id=?').bind('guide-source').first()).revision,1);
 await insert('public-source','document',{name:'随心付完整指南',external:true,purpose:'fact',sourceVersion:1},'ready');
 for(let i=0;i<75;i++)await insert('approved-'+i,'chunk',{docId:'public-source',docRevision:1,title:'随心付知识'+i,body:'随心付相关资料'+i,external:true,purpose:'fact'},'approved');
 await insert('foreign-source','document',{name:'随心付',external:true,purpose:'fact'},'ready','other');await insert('foreign-chunk','chunk',{docId:'foreign-source',docRevision:1,title:'随心付机密',body:'随心付',external:true,purpose:'fact'},'approved','other');
 await insert('writing-task','task',{keyword:'Payoneer Card',stage:'sources'},'waiting');
 r=await req('prepareSources',{id:'writing-task',revision:1});assert.equal(r.status,200,JSON.stringify(r.j));const task=r.j;assert.equal(task.sourceCount,75);assert.equal(task.sourceCandidates.length,60);assert.equal(task.sourceCandidateIds.length,75);
 const more=await req('sourceCandidates/writing-task?offset=60');assert.equal(more.status,200);assert.equal(more.j.items.length,15);assert.equal(more.j.nextOffset,null);assert.ok(more.j.items.every(k=>k.owner==='owner'));
 assert.equal((await req('sourceCandidates/writing-task?offset=60',undefined,'other')).status,404);
 const selected=more.j.items[0];r=await req('confirmSources',{id:task.id,revision:task.revision,ids:[selected.id],snapshots:[selected]});assert.equal(r.status,200,JSON.stringify(r.j));assert.deepEqual(r.j.selectedSourceIds,[selected.id]);
 mock.assertNoPendingInterceptors();console.log('PASS: category override → v2 packet → exact evidence import → persisted process/product metadata; pending review, source revision and ownership preserved; all 75 writing candidates pageable and selectable beyond first 60. No model calls.');
}finally{await mf.dispose();await mock.close();}
