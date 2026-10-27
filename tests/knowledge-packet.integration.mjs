import {Miniflare,createFetchMock} from 'miniflare';
import {build} from 'esbuild';import {mkdirSync,readFileSync,readdirSync} from 'node:fs';import assert from 'node:assert/strict';
mkdirSync('.sites-runtime/tests',{recursive:true});await build({entryPoints:['tests/worker.ts'],bundle:true,format:'esm',platform:'browser',target:'es2022',outfile:'.sites-runtime/tests/knowledge-packet.mjs'});
const mock=createFetchMock();mock.disableNetConnect();
const mf=new Miniflare({modules:true,scriptPath:'.sites-runtime/tests/knowledge-packet.mjs',compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],r2Buckets:['BUCKET'],fetchMock:mock});
async function req(path,body,uid='owner',extra={}){const headers={'oai-authenticated-user-id':uid,'oai-authenticated-user-email':uid+'@example.com',...extra};let payload;if(body instanceof FormData){const r=new Request('https://test',{method:'POST',body});headers['content-type']=r.headers.get('content-type');payload=await r.arrayBuffer();}else if(body){payload=JSON.stringify(body);headers['content-type']='application/json';}const r=await mf.dispatchFetch('https://studio.test/api/studio/'+path,{method:body?'POST':'GET',headers,body:payload});return {status:r.status,j:await r.json()};}
try{
 const db=await mf.getD1Database('DB');for(const f of readdirSync('drizzle').filter(f=>f.endsWith('.sql')))await db.exec(readFileSync('drizzle/'+f,'utf8').replace(/--> statement-breakpoint/g,'').replace(/\n/g,' '));
 const form=new FormData();form.set('mode','markdown');form.set('file',new File(['# 收款\n支持墨西哥收款。\n\n# 资格\n仅限企业账户。'],'资料.md'));const file=(await req('libraryUpload',form)).j.file;
 let job=(await req('ingestionStart',{id:file.id})).j;
 assert.equal((await req('knowledgePacketExport',{id:job.id,revision:job.revision},'other')).status,404);
 assert.equal((await req('knowledgePacketExport',{id:job.id,revision:job.revision},'owner',{origin:'https://evil.test'})).status,403);
 let ex=await req('knowledgePacketExport',{id:job.id,revision:job.revision});assert.equal(ex.status,200);let p=ex.j.package;
 const item=(statement)=>({title:statement,statement,type:'产品说明',products:['收款'],platforms:[],regions:['墨西哥'],keywords:[],evidence:[{blockId:'B1',quote:statement}]});
 const output={extractions:[{items:[item('支持墨西哥收款。'),item('仅限企业账户。')],omissions:[]}],links:{links:[{itemId:'P0-K1',conditionItemId:'P0-K2',reason:'主体条件',evidence:[{blockId:'B1',quote:'仅限企业账户。'}]}]},audit:{checks:[{itemId:'P0-K1',supported:true,issues:[]},{itemId:'P0-K2',supported:true,issues:[]}],conflicts:[],summary:'需人工审核',uncovered:[]}};
 const send=result=>req('knowledgePacketImport',{...p.resultTemplate,result,reviewed:true});
 assert.equal((await send({...output,extractions:[]})).status,400);
 const invalid=structuredClone(output);invalid.extractions[0].items[0].evidence[0].quote='伪造引文';assert.equal((await send(invalid)).status,400);
 assert.equal((await req('ingestionJob?id='+job.id)).j.stage,'extract');
 assert.equal((await req('knowledgePacketImport',{...p.resultTemplate,result:output,reviewed:false})).status,409);
 job=(await req('ingestionJob?id='+job.id)).j;const previous=p;ex=await req('knowledgePacketExport',{id:job.id,revision:job.revision});p=ex.j.package;
 assert.equal((await req('knowledgePacketImport',{...previous.resultTemplate,result:output,reviewed:true})).status,409);
 const result=await send(output);assert.equal(result.status,200,JSON.stringify(result.j));job=result.j.record;assert.equal(job.state,'succeeded');assert.equal(job.links.length,1);assert.equal(job.items.length,2);assert.equal(job.usage.attempts,0);
 assert.equal((await send(output)).j.duplicate,true);assert.equal((await req('knowledge')).j.items.length,0);
 const committed=await req('ingestionCommit',{id:job.id,revision:job.revision,ids:job.items.map(i=>i.id),reviewed:true});assert.equal(committed.status,200,JSON.stringify(committed.j));const d=(await req('document/'+committed.j.document.id)).j;assert.equal(d.external,false);assert.ok(d.chunks.every(k=>k.state==='pending'));assert.match(d.chunks[0].body,/仅限企业/);
 mock.assertNoPendingInterceptors();console.log('PASS: whole-document packet, complete extraction/link/audit import, forged evidence/old packet/foreign owner rejected, retry idempotency, manual review retained, no model calls.');
}finally{await mf.dispose();await mock.close();}
