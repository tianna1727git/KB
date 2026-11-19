import {canUse} from '../lib/studio/knowledge.mjs';
import {Miniflare} from 'miniflare';import {build} from 'esbuild';import {mkdirSync,readFileSync} from 'node:fs';import assert from 'node:assert/strict';
mkdirSync('.sites-runtime/tests',{recursive:true});await build({entryPoints:['tests/worker.ts'],bundle:true,format:'esm',platform:'browser',target:'es2022',outfile:'.sites-runtime/tests/material-categories.mjs'});
const mf=new Miniflare({modules:true,scriptPath:'.sites-runtime/tests/material-categories.mjs',compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],r2Buckets:['BUCKET']});
const headers={'oai-authenticated-user-id':'owner','oai-authenticated-user-email':'owner@payo.cn'};
async function req(path,body,h=headers){const response=await mf.dispatchFetch('https://studio.test/api/studio/'+path,{method:body?'POST':'GET',headers:{...h,...(body?{'content-type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});return {status:response.status,data:await response.json()};}
try{
 const db=await mf.getD1Database('DB');await db.exec(readFileSync('drizzle/0000_mature_bug.sql','utf8').replace(/--> statement-breakpoint/g,'').replace(/\n/g,' '));
 assert.equal((await req('materialCategories',null,{})).status,401);
 const original=(await req('materialCategories')).data;assert.equal(original.levels,3);assert.equal(original.revision,0);
 const time=new Date().toISOString();async function insert(id,kind,category,owner='owner',extra={}){await db.prepare('INSERT INTO studio_records VALUES(?,?,?,?,1,?,?,?)').bind(id,kind,owner,'saved',JSON.stringify({libraryCategory:category,...extra}),time,time).run();}
 await insert('source','library','Product Guide','owner',{name:'历史.pdf',fileKey:'kept.md',originalKey:'original.pdf',sha256:'kept-hash'});
 await insert('doc','document','Product Guide','owner',{name:'历史.pdf',libraryId:'source',hash:'kept-hash',markdown:'原文不变'});
 await insert('metadata','libraryMetadata','Product Guide','owner',{sourceId:'source'});
 await insert('chunk','chunk','Product Guide','owner',{docRevision:1,docId:'doc',body:'知识证据不变',title:'知识',risks:[]});
 await insert('other-source','library','Product Guide','other',{name:'另一成员.pdf'});
 const custom={name:'资料分类',key:'MaterialCategories',type:'cascade',levels:3,revision:0,nodes:[{value:'payo',label:'Payoneer',parent:null},{value:'standards',label:'标准',parent:'payo'},{value:'guide',label:'指南',parent:'standards'},{value:'cases',label:'案例',parent:null}]};
 assert.equal((await req('materialCategories',custom)).status,409);
 custom.migrations={'Product Guide':'guide'};
 let saved=await req('materialCategories',custom);assert.equal(saved.status,200,JSON.stringify(saved));assert.equal(saved.data.revision,1);
 assert.equal((await req('materialCategories',null,{'oai-authenticated-user-id':'other','oai-authenticated-user-email':'other@payo.cn'})).data.nodes[0].value,'About Payoneer');
 for(const id of ['source','doc','metadata','chunk']){const row=await db.prepare('SELECT payload,revision FROM studio_records WHERE id=?').bind(id).first();assert.equal(JSON.parse(row.payload).libraryCategory,'guide');assert.equal(row.revision,id==='metadata'?2:1);}
 const usableDoc=await db.prepare("SELECT * FROM studio_records WHERE id='doc'").first(),usableChunk=await db.prepare("SELECT * FROM studio_records WHERE id='chunk'").first();assert.equal(canUse({...JSON.parse(usableChunk.payload),id:'chunk',revision:usableChunk.revision,state:'approved'},[{...JSON.parse(usableDoc.payload),id:'doc',revision:usableDoc.revision,state:'ready'}]),true);
 const foreign=await db.prepare('SELECT payload,revision FROM studio_records WHERE id=?').bind('other-source').first();assert.equal(foreign.revision,1);assert.equal(JSON.parse(foreign.payload).libraryCategory,'Product Guide');
 const source=JSON.parse((await db.prepare('SELECT payload FROM studio_records WHERE id=?').bind('source').first()).payload);assert.equal(source.fileKey,'kept.md');assert.equal(source.originalKey,'original.pdf');assert.equal(source.sha256,'kept-hash');
 assert.equal((await req('materialCategories',custom)).status,409); // stale revision cannot migrate twice
 await assert.rejects(()=>insert('stale-source','library','Product Guide')); // concurrent stale upload guard
 assert.equal((await req('libraryCategoryUpdate',{id:'source',libraryCategory:'nonexistent',categoryRevision:0})).status,400);
 assert.equal((await req('libraryCategoryUpdate',{id:'source',libraryCategory:'payo',categoryRevision:0})).status,200); // parent selection is allowed
 const upload=new FormData();upload.set('file',new File(['# 新资料\n\n保留原文和自定义分类。'],'custom.md',{type:'text/markdown'}));upload.set('libraryCategory','guide');upload.set('usageScope','writing');upload.set('consent','true');
 const uploadRequest=new Request('https://test',{method:'POST',body:upload});const uploaded=await mf.dispatchFetch('https://studio.test/api/studio/librarySubmit',{method:'POST',headers:{...headers,'content-type':uploadRequest.headers.get('content-type')},body:await uploadRequest.arrayBuffer()});const uploadedData=await uploaded.json();assert.equal(uploaded.status,200,JSON.stringify(uploadedData));assert.equal(uploadedData.file.libraryCategory,'guide');
 const batch=await req('libraryCategoryBatchUpdate',{items:[{id:'source',categoryRevision:1}],libraryCategory:'guide'});assert.equal(batch.status,200);assert.deepEqual(batch.data.updated,['source']);
 const filtered=await req('knowledge?page=1&category=payo');assert.equal(filtered.status,200);assert.equal(filtered.data.total,1);
 const reduced={...saved.data,levels:1,nodes:saved.data.nodes.filter(n=>n.parent===null),migrations:{guide:'payo'}};
 const deleted=await req('materialCategories',reduced);assert.equal(deleted.status,200,JSON.stringify(deleted));
 const renamed={...deleted.data,nodes:deleted.data.nodes.map(n=>n.value==='payo'?{...n,label:'派安盈'}:n),migrations:{}};
 const nameSaved=await req('materialCategories',renamed);assert.equal(nameSaved.status,200);assert.equal(nameSaved.data.nodes[0].label,'派安盈');assert.equal(JSON.parse((await db.prepare('SELECT payload FROM studio_records WHERE id=?').bind('chunk').first()).payload).libraryCategory,'payo');
 const cycle={...nameSaved.data,nodes:[{value:'a',label:'A',parent:'b'},{value:'b',label:'B',parent:'a'}]};assert.equal((await req('materialCategories',cycle)).status,400);
 assert.equal((await req('materialCategories',nameSaved.data,{...headers,origin:'https://evil.test'})).status,403);
 // Two simultaneous saves of the same revision: exactly one succeeds, no partial migration.
 const a={...nameSaved.data,nodes:[...nameSaved.data.nodes,{value:'a',label:'A',parent:null}]},b={...nameSaved.data,nodes:[...nameSaved.data.nodes,{value:'b',label:'B',parent:null}]};
 const races=await Promise.all([req('materialCategories',a),req('materialCategories',b)]);assert.deepEqual(races.map(r=>r.status).sort(),[200,409]);
 console.log('PASS: account-scoped config, three-level values, parent filters, safe linked migrations and foreign-owner preservation, reduced levels, label rename, concurrency CAS/DB guards, invalid options, auth and CSRF.');
}finally{await mf.dispose();}
