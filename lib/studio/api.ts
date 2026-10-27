import libraryFiles from './library-data.json';
import {splitMarkdown,coverage,rank,canUse,citationCheck} from './knowledge.mjs';
import {agentInfo,modelJSON,messages} from './agent.mjs';
type R=Record<string,any>;
const id=()=>crypto.randomUUID(),now=()=>new Date().toISOString();
function fail(message:string,code=400):never{throw Object.assign(new Error(message),{code});}
const json=(data:any,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export async function api(req:Request,env:any){try{
 if(!env.DB||!env.BUCKET)fail('存储服务尚未就绪',503);
 const uid=req.headers.get('oai-authenticated-user-id'),email=req.headers.get('oai-authenticated-user-email');if(!uid||!email)fail('请使用 ChatGPT 登录工作台。',401);
 if(req.method!=='GET'){const origin=req.headers.get('origin');if(origin&&origin!==new URL(req.url).origin)fail('不允许跨站请求',403);}
 async function list(kind:string){const r=await env.DB.prepare('SELECT * FROM studio_records WHERE owner=? AND kind=? ORDER BY created DESC').bind(uid,kind).all();return r.results.map(parse);}
 function parse(r:any){return {...JSON.parse(r.payload),id:r.id,kind:r.kind,state:r.state,owner:r.owner,revision:r.revision,created:r.created,updated:r.updated};}
 async function get(rid:string,kind?:string){const r=await env.DB.prepare('SELECT * FROM studio_records WHERE id=? AND owner=?').bind(rid,uid).first();if(!r||kind&&r.kind!==kind)fail('记录不存在或无权访问',404);return parse(r);}
 async function create(kind:string,p:R,state='draft'){const rid=id(),t=now();await env.DB.prepare('INSERT INTO studio_records(id,kind,owner,state,revision,payload,created,updated) VALUES(?,?,?,?,1,?,?,?)').bind(rid,kind,uid,state,JSON.stringify(p),t,t).run();return get(rid);}
 async function save(r:R,p:R,state=r.state){const res=await env.DB.prepare('UPDATE studio_records SET payload=?,state=?,revision=revision+1,updated=? WHERE id=? AND owner=? AND revision=?').bind(JSON.stringify({...r,...p}),state,now(),r.id,uid,r.revision).run();if(res.meta.changes!==1)fail('内容已更新，请刷新后重试',409);return get(r.id);}
 const path=new URL(req.url).pathname.replace('/api/studio/','').split('/'),action=path[0];
 const docs=async()=>list('document');
 async function usable(){const ds=await docs();return (await list('chunk')).filter((k:R)=>canUse(k,ds));}
 async function taskView(t:R){const ds=await docs(),ks=await list('chunk');return {...t,stale:(t.evidence||[]).filter((s:R)=>{const k=ks.find((x:R)=>x.id===s.id);return !k||k.revision!==s.revision||!canUse(k,ds);}).map((s:R)=>s.ref)};}
 if(req.method==='GET'){
 if(action==='library'){
 if(email.toLowerCase()!=='tianna1727@gmail.com'){if(path[1])fail('资料不存在',404);return json({files:[],total:0});}
 if(!path[1])return json({files:(await list('library')).map(({fileKey,...f}:R)=>f),total:libraryFiles.length});
 const f=await get(path[1],'library'),stored=await env.BUCKET.get(f.fileKey);if(!stored)fail('原文件不存在',404);
 if(path[2]==='download')return new Response(stored.body,{headers:{'Content-Type':'text/markdown;charset=utf-8','Content-Disposition':"attachment; filename*=UTF-8''"+encodeURIComponent(f.name),'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
 return json({...f,markdown:await stored.text()});
 }
 if(action==='state')return json({documents:await docs(),chunks:await list('chunk'),tasks:await list('task'),agents:agentInfo,user:{id:uid,email,name:email.split('@')[0]},config:{model:!!env.AI_URL&&!!env.AI_MODEL,semantic:false}});
 if(action==='document'){const d=await get(path[1],'document');return json({...d,chunks:(await list('chunk')).filter((k:R)=>k.docId===d.id&&k.state!=='excluded')});}
 if(action==='task'){let t=await get(path[1],'task');if(t.state==='running'&&Date.now()-Date.parse(t.updated)>180000)t=await save(t,{error:'上次执行中断，请重试当前步骤。'},'failed');return json(await taskView(t));}
 if(action==='source'){const d=await get(path[1],'document'),f=await env.BUCKET.get(d.fileKey);if(!f)fail('原文件不存在',404);return new Response(f.body,{headers:{'Content-Type':'text/markdown;charset=utf-8','Content-Disposition':'attachment; filename="source.md"','Cache-Control':'no-store'}});}
 fail('接口不存在',404);}
 if(req.method!=='POST')fail('请求方法无效',405);
 if(action==='upload'){
 const form=await req.formData(),file=form.get('file');if(!(file instanceof File)||! /\.(md|markdown)$/i.test(file.name))fail('请选择 .md 或 .markdown 文件。');if(!file.size||file.size>2*1024*1024)fail('文件应为 1 字节至 2 MB。');const bytes=await file.arrayBuffer();let markdown='';try{markdown=new TextDecoder('utf-8',{fatal:true}).decode(bytes).replace(/^\uFEFF/,'');}catch{fail('请将 Markdown 文件保存为 UTF-8 编码。');}
 const category=String(form.get('category')||'产品'),purpose=String(form.get('purpose')||'fact');if(!['产品','品牌','法务','市场研究','客户案例','其他'].includes(category)||!['fact','rule','both'].includes(purpose))fail('分类或用途无效');const source=String(form.get('source')||'').trim();if(!source)fail('请填写资料来源');const region=String(form.get('region')||'').trim(),effective=String(form.get('effective')||''),expires=String(form.get('expires')||'');if(!effective||!Number.isFinite(Date.parse(effective))||expires&&(!Number.isFinite(Date.parse(expires))||Date.parse(expires)<=Date.parse(effective)))fail('请填写正确的生效日期和到期日期');
 const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(n=>n.toString(16).padStart(2,'0')).join('');const duplicate=(await docs()).find((d:R)=>d.hash===digest);if(duplicate)return json({document:duplicate,duplicate:true});const slices=splitMarkdown(markdown);if(!coverage(markdown,slices))fail('来源覆盖检查失败');const fileKey='sources/'+uid+'/'+id()+'.md';await env.BUCKET.put(fileKey,markdown,{httpMetadata:{contentType:'text/markdown;charset=utf-8'}});
 const d=await create('document',{name:file.name,markdown,hash:digest,fileKey,category,purpose,source,region,effective,expires,external:form.get('external')==='true',coverage:true,events:[{name:'Markdown上传',state:'complete',time:now()},{name:'结构切片与原文比对',state:'complete',time:now()},{name:'风险确认',state:'waiting'}]},'review');
 for(const c of slices)await create('chunk',{...c,docId:d.id,docRevision:d.revision,category,purpose,region,external:d.external,keywords:[],originalBody:c.body},'pending');return json({document:d,count:slices.length});}
 const b:any=await req.json();
 if(action==='libraryImport'){
 if(email.toLowerCase()!=='tianna1727@gmail.com')fail('无权导入此资料集',403);
 const offset=Number(b.offset||0);if(!Number.isInteger(offset)||offset<0||offset>libraryFiles.length)fail('批次无效');
 const batch=libraryFiles.slice(offset,offset+10);let added=0;
 for(const {markdown,...f} of batch){
 const rid='library-'+uid+'-'+f.id;const exists=await env.DB.prepare('SELECT id FROM studio_records WHERE id=? AND owner=?').bind(rid,uid).first();if(exists)continue;
 const fileKey='library/'+uid+'/'+f.id+'.md';await env.BUCKET.put(fileKey,markdown,{httpMetadata:{contentType:'text/markdown;charset=utf-8'}});const t=now();
 await env.DB.prepare('INSERT OR IGNORE INTO studio_records(id,kind,owner,state,revision,payload,created,updated) VALUES(?,?,?,?,1,?,?,?)').bind(rid,'library',uid,'stored',JSON.stringify({...f,fileKey}),t,t).run();added++;
 }
 return json({added,next:Math.min(offset+10,libraryFiles.length),total:libraryFiles.length});
 }

 if(action==='mergeChunk'){
 const k=await get(b.id,'chunk');if(k.state!=='pending'||k.revision!==b.revision)fail('只能合并当前待确认版本');const all=(await list('chunk')).filter((x:R)=>x.docId===k.docId&&x.state!=='excluded').sort((a:R,b:R)=>a.order-b.order),next=all[all.findIndex((x:R)=>x.id===k.id)+1];if(!next||next.state!=='pending'||k.end!==next.start)fail('下一条不存在、已确认或来源不连续');const d=await get(k.docId,'document');const originalBody=d.markdown.slice(k.start,next.end),body=!k.edited&&!next.edited?originalBody:k.body+next.body;
 const merged=await create('chunk',{...k,title:next.title,body,originalBody,start:k.start,end:next.end,heading:next.heading,risks:[...new Set([...k.risks,...next.risks,'人工合并，请核对主题及条件完整性'])]},'pending');await save(k,{supersededBy:merged.id},'excluded');await save(next,{supersededBy:merged.id},'excluded');return json({id:merged.id});}
 if(action==='splitChunk'){
 const k=await get(b.id,'chunk');if(k.state!=='pending'||k.revision!==b.revision||k.edited)fail('仅可拆分未修改的待确认切片');const blocks=k.body.match(/[^]*?(?:\n\n|$)/g)?.filter(Boolean)||[];const at=Number(b.after);if(!Number.isInteger(at)||at<1||at>=blocks.length)fail('请填写有效的段落位置');const left=blocks.slice(0,at).join(''),right=blocks.slice(at).join('');if(left+right!==k.body)fail('拆分完整性检查失败');let offset=k.start;
 for(const [i,body] of [left,right].entries()){await create('chunk',{...k,title:k.title+' · '+(i+1),body,originalBody:body,start:offset,end:offset+body.length,order:k.order+i*.001,risks:[...k.risks,'人工拆分，请核对上下文及限制条件']},'pending');offset+=body.length;}await save(k,{reason:'已拆分，原始范围保留'},'excluded');return json({ok:true});}

 if(action==='search'){const q=String(b.query||'').trim();if(!q||q.length>500)fail('请输入不超过500字的检索问题');return json({results:rank(q,await usable()),mode:'全文、关键词与同义表达检索'});}
 if(action==='documentStatus'){const d=await get(b.id,'document');if(d.revision!==b.revision)fail('资料已更新，请刷新',409);const saved=await save(d,{disabled:!d.disabled});for(const k of (await list('chunk')).filter((k:R)=>k.docId===d.id))await save(k,{docRevision:saved.revision});return json(saved);}
 if(action==='chunkEdit'){const k=await get(b.id,'chunk');if(k.revision!==b.revision)fail('切片已更新，请刷新',409);if(k.state==='approved')fail('请先撤回确认，再修改切片');if(typeof b.title!=='string'||!b.title.trim()||b.title.length>200||typeof b.body!=='string'||!b.body.trim()||b.body.length>30000)fail('标题或正文无效');return json(await save(k,{title:b.title.trim(),body:b.body,edited:b.body!==k.originalBody,risks:[...k.risks.filter((x:string)=>x!=='人工修改内容，需再次对照原文'),...(b.body!==k.originalBody?['人工修改内容，需再次对照原文']:[])]},'pending'));}
 if(action==='confirm'){
 if(!Array.isArray(b.ids)||!b.ids.length||b.ids.length>200)fail('请选择1–200条切片');const selected=await Promise.all(b.ids.map((x:string)=>get(x,'chunk')));if(selected.some(k=>k.state!=='pending'))fail('仅可确认待确认切片');if(b.riskConfirmed!==true&&selected.some(k=>k.risks.length))fail('重点切片需要逐条对照确认');if(b.riskConfirmed&&selected.length!==1)fail('重点内容请逐条确认');if(selected.some(k=>!k.body.replace(/^#{1,6}[^\n]*(?:\n|$)/gm,'').trim()))fail('仅标题的切片不可入库，请补充正文');
 for(const k of selected)await save(k,{confirmedAt:now(),confirmedBy:uid},'approved');const docIds=[...new Set(selected.map(k=>k.docId))];for(const did of docIds){const d=await get(did),all=(await list('chunk')).filter((k:R)=>k.docId===did&&k.state!=='excluded');if(all.every((k:R)=>k.state==='approved')){const next=await save(d,{events:d.events.map((v:R)=>({...v,state:'complete'}))},'ready');for(const k of all)await save(k,{docRevision:next.revision});}}return json({ok:true});}
 if(action==='revoke'){const k=await get(b.id,'chunk');return json(await save(k,{confirmedAt:null},'pending'));}
 if(action==='createTask'){
 const keyword=String(b.keyword||'').trim();if(!keyword||keyword.length>200)fail('请输入不超过200字的主题关键词');const platform=String(b.platform||'官网'),audience=String(b.audience||'准备拓展海外市场的中国跨境电商卖家');if(!['官网','微信公众号','知乎','小红书'].includes(platform)||audience.length>300||String(b.description||'').length>3000)fail('写作需求格式无效');const t=await create('task',{keyword,platform,audience,description:String(b.description||''),title:keyword+'写作任务',stage:'research',events:[],queries:[],evidence:[],rules:[],outline:'',markdown:'',missing:[],issues:[],error:'',round:0},'waiting');return json(t);}
 if(action==='saveTask'){
 const t=await get(b.id,'task');if(t.state==='running')fail('步骤正在执行，请稍候',409);if(t.revision!==b.revision)fail('任务版本已更新',409);if(b.outline!==undefined){if(typeof b.outline!=='string'||!b.outline.trim()||b.outline.length>10000)fail('大纲格式无效');if(!t.evidence.length)fail('请先完成研究策划');await create('history',{taskId:t.id,outline:t.outline,markdown:t.markdown,evidence:t.evidence},'saved');return json(await save(t,{outline:b.outline,stage:'outline',markdown:'',issues:[],error:''},'waiting'));}
 if(typeof b.markdown!=='string'||b.markdown.length>60000)fail('正文过长或格式无效');await create('history',{taskId:t.id,markdown:t.markdown,evidence:t.evidence},'saved');return json(await save(t,{title:String(b.title||t.title).slice(0,200),markdown:b.markdown,stage:'check',issues:[],error:''},'waiting'));}
 if(action==='approveOutline'){const t=await get(b.id,'task');if(t.state==='running'||t.revision!==b.revision||t.stage!=='outline')fail('大纲状态已变化，请刷新',409);if((await taskView(t)).stale.length)fail('来源已变化，请重新研究');return json(await save(t,{stage:'write',outlineApprovedAt:now()},'waiting'));}
 if(action==='complete'){const t=await get(b.id,'task');if(t.state==='running'||t.revision!==b.revision||t.stage!=='review')fail('请完成内容检查后再确认交付',409);if((await taskView(t)).stale.length)fail('来源已变化，请重新研究');if(!t.markdown.trim())fail('正文为空');if(!b.confirmed)fail('请确认已人工审核正文、来源和待补充项');return json(await save(t,{stage:'done',approvedAt:now()},'done'));}
 if(action==='restartResearch'){const t=await get(b.id,'task');if(t.state==='running'||t.revision!==b.revision)fail('任务状态已变化',409);await create('history',{taskId:t.id,markdown:t.markdown,outline:t.outline,evidence:t.evidence},'saved');return json(await save(t,{stage:'research',evidence:[],rules:[],markdown:'',outline:'',issues:[],error:'',round:0},'waiting'));}
 if(action==='run'){
 let t=await get(b.id,'task');if(t.revision!==b.revision||t.state==='running')fail('任务正在执行或已更新',409);if(!['research','write','check','revise'].includes(t.stage))fail('当前步骤需要人工确认');if(!env.AI_URL||!env.AI_MODEL)fail('文章模型尚未配置。任务已保存，可在服务配置完成后继续。',503);
 if(t.stage!=='research'&&(await taskView(t)).stale.length)fail('引用知识已变化或失效，请重新研究');t=await save(t,{error:''},'running');const locked=t;const stage=t.stage;
 try{
 if(stage==='research'){
 const all=await usable(),facts=all.filter((k:R)=>k.external&&k.purpose!=='rule'),rules=all.filter((k:R)=>k.purpose!=='fact');if(!facts.length)throw Error('暂无可对外引用的已入库知识，请先上传并确认资料。');if(rules.length>30)throw Error('写作规则较多，请先整理规则范围');
 const plan:any=await modelJSON(env,messages('研究策划 Agent',{keyword:t.keyword,audience:t.audience,platform:t.platform,description:t.description,knowledgeCatalog:facts.slice(0,300).map((k:R)=>({title:k.title,region:k.region,category:k.category}))},'{intent:string, queries:string[]（最多8个检索问题）}'),1500);
 if(typeof plan.intent!=='string'||!Array.isArray(plan.queries)||!plan.queries.length||plan.queries.length>8||plan.queries.some((q:any)=>typeof q!=='string'||q.length>300))throw Error('研究计划格式无效，请重试');
 const queries=[t.keyword,...plan.queries],hits=new Map();for(const q of queries)for(const k of rank(q,facts,8))hits.set(k.id,k);const primary=[...hits.values()].sort((a:any,b:any)=>b.score-a.score).slice(0,10) as R[];const contextHits=new Map(primary.map(k=>[k.id,k]));for(const k of primary)for(const neighbor of facts.filter((x:R)=>x.docId===k.docId&&Math.abs(x.order-k.order)<=1))contextHits.set(neighbor.id,neighbor);const found=[...contextHits.values()] as R[];
 if(!found.length)throw Error('没有找到相关的可引用知识，请补充资料或修改关键词');
 const ds=await docs();const snap=(k:R)=>({id:k.id,revision:k.revision,docId:k.docId,docRevision:k.docRevision,title:k.title,body:k.body,heading:k.heading,region:k.region,source:ds.find((d:R)=>d.id===k.docId)?.source,start:k.start,end:k.end});const evidence=found.map((k,i)=>({...snap(k),ref:'S'+(i+1)})),ruleSnaps=rules.map(snap);
 const context={intent:plan.intent,platform:t.platform,audience:t.audience,description:t.description,evidence,rules:ruleSnaps};if(JSON.stringify(context).length>100000)throw Error('知识上下文超过上限，请缩小主题或整理资料。');
 const outline:any=await modelJSON(env,messages('研究策划 Agent',context,'{title:string,outline:string（Markdown大纲，每节标注依据[S1]）,missing:string[]}'),3000);if(typeof outline.title!=='string'||typeof outline.outline!=='string'||!outline.outline.trim()||outline.outline.length>10000||!Array.isArray(outline.missing))throw Error('大纲格式无效');citationCheck(outline.outline,evidence);
 await save(t,{title:outline.title.slice(0,200),intent:plan.intent,queries,evidence,rules:ruleSnaps,outline:outline.outline,missing:outline.missing.slice(0,30),stage:'outline',events:[...t.events,{name:'研究策划',agent:'research',state:'complete',time:now(),detail:queries.length+'个检索问题，'+evidence.length+'条证据'}]},'waiting');
 }else if(stage==='write'||stage==='revise'){
 if(stage==='revise'&&t.round>=2)throw Error('已达到两轮修改上限，请人工处理剩余问题');
 const data={keyword:t.keyword,platform:t.platform,audience:t.audience,description:t.description,outline:t.outline,evidence:t.evidence,rules:t.rules,...(stage==='revise'?{draft:t.markdown,issues:t.issues}:{})};const output:any=await modelJSON(env,messages('内容写作 Agent',data,'{title:string,markdown:string（正文事实段落使用[S1]引用，缺口写【待补充】）,seoTitle:string,metaDescription:string,slug:string,missing:string[]}'),6500);
 if(typeof output.title!=='string'||typeof output.markdown!=='string'||!output.markdown.trim()||output.markdown.length>60000||!Array.isArray(output.missing))throw Error('正文格式无效');citationCheck(output.markdown,t.evidence);await create('history',{taskId:t.id,markdown:t.markdown,evidence:t.evidence},'saved');await save(t,{...Object.fromEntries(['title','markdown','seoTitle','metaDescription','slug','missing'].map(k=>[k,output[k]])),stage:'check',round:stage==='revise'?t.round+1:t.round,events:[...t.events,{name:stage==='revise'?'按意见修改':'文章起草',agent:'writer',state:'complete',time:now()}]},'waiting');
 }else{
 citationCheck(t.markdown,t.evidence);const output:any=await modelJSON(env,messages('内容检查 Agent',{markdown:t.markdown,evidence:t.evidence,rules:t.rules,audience:t.audience,keyword:t.keyword},'{summary:string,issues:[{severity:"high"或"medium"或"low",quote:string（正文原句）,reason:string,suggestion:string}],missing:string[]}'),4000);
 if(typeof output.summary!=='string'||!Array.isArray(output.issues)||output.issues.length>50||output.issues.some((x:R)=>!['high','medium','low'].includes(x.severity)||typeof x.quote!=='string'||!x.quote||!t.markdown.includes(x.quote)||typeof x.reason!=='string'||typeof x.suggestion!=='string'))throw Error('检查结果缺少有效段落定位，请重试');await save(t,{issues:output.issues,checkSummary:output.summary,stage:'review',events:[...t.events,{name:'内容检查',agent:'checker',state:'complete',time:now()}]},'waiting');}
 const latest=await get(t.id);if((await taskView(latest)).stale.length)await save(latest,{error:'执行期间引用知识已变化，请重新研究'},'failed');
 }catch(error:any){const latest=await get(t.id);await save(latest,{error:error.message||'执行失败',stage},'failed');}
 return json(await taskView(await get(locked.id)));}
 if(action==='requestRevision'){const t=await get(b.id,'task');if(t.state==='running'||t.revision!==b.revision||t.stage!=='review'||t.round>=2)fail('当前不能自动修改，请人工编辑或刷新');return json(await save(t,{stage:'revise'},'waiting'));}
 fail('接口不存在',404);
 }catch(e:any){return json({error:e.message||'操作失败'},e.code||400);}}
