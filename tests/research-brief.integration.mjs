import assert from 'node:assert/strict';
import {mkdirSync, readdirSync, readFileSync} from 'node:fs';
import {build} from 'esbuild';
import {Miniflare, createFetchMock} from 'miniflare';

mkdirSync('.sites-runtime/tests',{recursive:true});
const scriptPath='.sites-runtime/tests/research-brief.mjs';
await build({entryPoints:['tests/worker.ts'],bundle:true,format:'esm',platform:'browser',outfile:scriptPath});
const mock=createFetchMock();
mock.disableNetConnect();
const mf=new Miniflare({modules:true,scriptPath,compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],r2Buckets:['BUCKET'],fetchMock:mock,bindings:{AI_URL:'https://model.example/generate',AI_MODEL:'fixture'}});
async function request(path,body){
 const response=await mf.dispatchFetch('https://studio.test/api/studio/'+path,{method:body?'POST':'GET',headers:{'oai-authenticated-user-id':'owner','oai-authenticated-user-email':'owner@example.com','Content-Type':'application/json'},body:body&&JSON.stringify(body)});
 return {status:response.status,data:await response.json()};
}
try {
 const db=await mf.getD1Database('DB');
 for(const file of readdirSync('drizzle').filter(f=>f.endsWith('.sql')))await db.exec(readFileSync('drizzle/'+file,'utf8').replace(/--> statement-breakpoint/g,'').replace(/\n/g,' '));
 const rules=(await request('researchRules')).data.rules;
 rules.push(['测试角度','从实际订单场景切入']);
 assert.equal((await request('researchRules',{revision:0,rules})).status,200);
 assert.equal((await request('researchRules',{revision:0,rules})).status,409);
 const source={id:'industry',name:'行业观察',type:'rss',url:'https://news.company.com/rss',enabled:true};
 const settings=await request('insightsSettings',{revision:0,sources:[source],defaultDays:15,weeklyEnabled:false});
 assert.equal(settings.status,200,JSON.stringify(settings.data));
 const article={sourceId:source.id,sourceName:source.name,title:'海外订单收款',url:'https://news.company.com/order',publishedAt:new Date().toISOString(),content:'如何核对海外订单收款。'};
 await db.prepare("INSERT INTO studio_records(id,kind,owner,state,revision,payload,created,updated) VALUES('article','insightArticle','owner','saved',1,?,?,?)").bind(JSON.stringify(article),article.publishedAt,article.publishedAt).run();
 const title='海外订单收款怎么核对？';
 const modelReport={topics:[{title,angle:'从对账切入',reason:'实际订单问题',recommendedKeyword:'收款',outline:['核对订单'],evidence:['article','keyword.import'],sourceReferences:[{articleId:'article',readerQuestion:'如何对账？',borrowableIdea:'按订单解释',payoAngle:'核对到账明细'},{articleId:'unknown'}]}],keywordClusters:[{name:'收款',coreKeyword:'收款',evidence:['keyword.import']}]};
 let input;
 mock.get('https://model.example').intercept({path:'/generate',method:'POST'}).reply(200,async opts=>{
  input=JSON.parse(JSON.parse(await new Response(opts.body).text()).messages[1].content);
  return JSON.stringify({choices:[{message:{content:JSON.stringify(modelReport)}}]});
 });
 const result=await request('insightsResearch',{keyword:'收款',days:15,keywordFile:'关键词,月均搜索量,数据来源,数据日期\n收款,12,用户报表,2026-11'});
 assert.equal(result.status,200,JSON.stringify(result.data));
 assert.ok(input.constraints.some(text=>text.includes('从实际订单场景切入')));
 const {topics,savedId,savedAt,keywordClusters}=result.data;
 assert.equal(topics[0].sourceReferences.length,1);
 assert.deepEqual(keywordClusters[0].topicIndices,[0]);
 const saved=(await request('insightsSavedResearch')).data.saved;
 assert.equal(saved.report.topics[0].sourceReferences[0].url,article.url);
 const create={keyword:'收款',topic:title,insightIds:['article'],researchSelection:{id:savedId,savedAt,index:0},titleSelection:true};
 const task=await request('createTask',create);
 assert.equal(task.status,200,JSON.stringify(task.data));
 assert.equal(task.data.writingBrief.sourceReferences[0].borrowableIdea,'按订单解释');
 assert.deepEqual(task.data.writingBrief.outline,['核对订单']);
 assert.equal((await request('createTask',{...create,researchSelection:{...create.researchSelection,savedAt:'stale'}})).status,409);
 const confirmed=await request('confirmInsightSources',{id:task.data.id,revision:task.data.revision});
 assert.equal(confirmed.status,200);
 mock.get('https://model.example').intercept({path:'/generate',method:'POST'}).reply(200,{choices:[{message:{content:JSON.stringify({intent:'核对订单',queries:['收款']})}}]});
 const ready=await request('run',{id:task.data.id,revision:confirmed.data.revision});
 assert.equal(ready.data.stage,'write',JSON.stringify(ready.data));
 assert.equal(ready.data.selectedTitle.title,title);
 console.log('Research rules, Sources, imported metrics, saved topic and writing Brief passed.');
} finally {await mf.dispose();}
