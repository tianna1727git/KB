import {Miniflare,createFetchMock} from 'miniflare';
import {build} from 'esbuild';
import {mkdirSync,readFileSync,readdirSync} from 'node:fs';
import assert from 'node:assert/strict';
mkdirSync('.sites-runtime/tests',{recursive:true});
await build({entryPoints:['tests/mcp-worker.ts'],bundle:true,format:'esm',platform:'browser',target:'es2022',outfile:'.sites-runtime/tests/mcp.mjs'});
const mock=createFetchMock();mock.disableNetConnect();
const mf=new Miniflare({modules:true,scriptPath:'.sites-runtime/tests/mcp.mjs',compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],r2Buckets:['BUCKET'],fetchMock:mock});
async function rpc(method,params={},uid='owner'){
 const headers={'Content-Type':'application/json'};
 if(uid){headers['oai-authenticated-user-id']=uid;headers['oai-authenticated-user-email']=uid+'@example.com';}
 const r=await mf.dispatchFetch('https://studio.test/mcp',{method:'POST',headers,body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});
 return (await r.json()).result;
}
async function tool(name,args={},uid='owner',error=false){const r=await rpc('tools/call',{name,arguments:args},uid);assert.equal(r.isError,error,JSON.stringify(r));return error?r.content[0].text:JSON.parse(r.content[0].text);}
try{
 const db=await mf.getD1Database('DB'),bucket=await mf.getR2Bucket('BUCKET');
 for(const f of readdirSync('drizzle').filter(f=>f.endsWith('.sql')))await db.exec(readFileSync('drizzle/'+f,'utf8').replace(/--> statement-breakpoint/g,'').replace(/\n/g,' '));
 const time=new Date().toISOString();
 const insert=async(id,owner,payload)=>db.prepare('INSERT INTO studio_records(id,kind,owner,state,revision,payload,created,updated) VALUES(?,?,?,?,1,?,?,?)').bind(id,'library',owner,'stored',JSON.stringify(payload),time,time).run();
 const markdown='# 随心付企业账户绑定\n\n仅限企业账户。\n第1步 准备资料。\n\n第2步 点击确认按钮完成绑定。\n';
 await insert('guide-source','owner',{name:'企业账户绑定.md',sha256:'guide-hash',fileKey:'guide.md',originalKey:'private-original.pdf',libraryCategory:'Product Guide',sourceFormat:'pdf',conversionState:'done'});
 await insert('foreign-source','other',{name:'机密资料',fileKey:'foreign.md',libraryCategory:'Events'});
 await bucket.put('guide.md',markdown);await bucket.put('private-original.pdf','original');await bucket.put('foreign.md','其他账号的机密正文');
 assert.deepEqual((await rpc('server/discover',{},null)).supportedVersions,['2026-07-28']);
 const listed=await rpc('tools/list',{},null);assert.equal(listed.tools.length,11);
 await tool('payo_identity',{},null,true);await tool('payo_list_sources',{owner:'other'},'owner',true);
 assert.equal((await tool('payo_identity')).policyVersion,'knowledge-organization-v2');
 let list=await tool('payo_list_sources');assert.equal(list.total,1);assert.equal(list.items[0].id,'guide-source');assert.ok(!JSON.stringify(list).includes('private-original.pdf'));
 const first=await tool('payo_read_source',{id:'guide-source',kind:'library',limit:10});assert.equal(first.markdown,markdown.slice(0,10));assert.equal(first.nextOffset,10);
 await tool('payo_read_source',{id:'foreign-source',kind:'library'},'owner',true);
 let job=await tool('payo_start_organization',{id:'guide-source'});assert.equal(job.organizationContext.policyVersion,'knowledge-organization-v2');
 await tool('payo_export_packet',{id:job.id,revision:job.revision},'other',true);
 const exported=await tool('payo_export_packet',{id:job.id,revision:job.revision});const packet=exported.package;
 assert.equal(packet.input.blocks.map(b=>b.text).join(''),markdown);
 const org={scenario:'企业账户绑定',process:'账户绑定',stepNumbers:[1],branch:'',prerequisites:['仅限企业账户。'],conditions:[],dates:[],contentRole:'evergreen',researchTopic:'',toolInputs:[],toolOutputs:[],formulas:[]};
 const item=(quote,step)=>({title:'账户绑定步骤'+step,statement:quote,type:'操作流程',products:['随心付'],platforms:[],regions:[],keywords:['账户绑定'],evidence:[{blockId:'B1',quote}],organization:{...org,stepNumbers:[step],prerequisites:step===1?org.prerequisites:[]}});
 const result={extractions:[{items:[item('仅限企业账户。\n第1步 准备资料。',1),item('第2步 点击确认按钮完成绑定。',2)],omissions:[]}],links:{links:[]},audit:{checks:[{itemId:'P0-K1',supported:true,issues:[]},{itemId:'P0-K2',supported:true,issues:[]}],conflicts:[],summary:'核对完成',uncovered:[]}};
 const args={...packet.resultTemplate,result,reviewed:true};
 await tool('payo_import_packet',{...args,revision:args.revision-1},'owner',true);
 const forged=structuredClone(args);forged.result.extractions[0].items[0].evidence[0].quote='伪造的正文';await tool('payo_import_packet',forged,'owner',true);
 job=(await tool('payo_import_packet',args)).record;
 await tool('payo_commit_organization',{id:job.id,revision:job.revision,ids:job.items.map(i=>i.id),reviewed:true},'other',true);
 const committed=await tool('payo_commit_organization',{id:job.id,revision:job.revision,ids:job.items.map(i=>i.id),reviewed:true});
 const found=await tool('payo_search_knowledge',{q:'随心付'});assert.equal(found.total,2);assert.ok(found.items.every(k=>k.libraryCategory==='Product Guide'&&k.state==='pending'&&k.external===false));
 const detail=await tool('payo_read_knowledge',{id:found.items[0].id});assert.equal(detail.docId,committed.document.id);assert.ok(detail.evidence.length);
 await tool('payo_read_knowledge',{id:found.items[0].id},'other',true);
 assert.equal((await tool('payo_search_knowledge',{q:'随心付'},'other')).total,0);
 assert.equal(await (await bucket.get('guide.md')).text(),markdown);assert.equal(await (await bucket.get('private-original.pdf')).text(),'original');
 assert.equal((await db.prepare('SELECT revision FROM studio_records WHERE id=?').bind('guide-source').first()).revision,1);
 mock.assertNoPendingInterceptors();console.log('PASS MCP: discovery, anonymous denial, strict arguments, private source list/read, v2 extraction → exact evidence import → pending knowledge, keyword retrieval, cross-account isolation, stale/forged rejection, original preservation. No model calls.');
}finally{await mf.dispose();await mock.close();}
