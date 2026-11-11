import {sourceBlocks,validateExtraction} from './ingestion-agent.mjs';
import {canUse,citationCheck} from './knowledge.mjs';
type R=Record<string,any>;
const hash=async(s:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))).map(n=>n.toString(16).padStart(2,'0')).join('');
export async function offlineAPI(req:Request,env:any,ctx:R){
 const {get,list,save,uid,fail,json}=ctx;
 if(req.method!=='POST')fail('仅支持 POST',405);
 const raw=await req.text();if(new TextEncoder().encode(raw).length>512*1024)fail('结果包最大512 KB');
 let b:R;try{b=JSON.parse(raw);}catch{fail('请选择有效的 JSON 结果包');}
 if(b!.format!=='payo-codex-v1'||b!.reviewed!==true)fail('请核对结果并勾选导入确认');
 const p=b!.package;if(!p||!['knowledge','draft'].includes(p.kind))fail('结果包类型无效');
 const packageHash=await hash(JSON.stringify(p));
 if(p.kind==='knowledge'){
  if(typeof p.sourceSha256!=='string'||!/^[a-f0-9]{64}$/.test(p.sourceSha256))fail('缺少来源指纹');
  const sources=(await list('library')).filter((f:R)=>f.sha256===p.sourceSha256);
  if(sources.length!==1)fail('当前账号资料库中找不到唯一的对应原文，请先保存资料或核对版本');
  const source=sources[0],file=await env.BUCKET.get(source.fileKey);if(!file)fail('资料原文不存在');
  const markdown=await file.text();if(await hash(markdown)!==p.sourceSha256)fail('原文指纹不一致，请重新整理');
  const blocks=sourceBlocks(markdown),result=validateExtraction(p,blocks,'C-');
  if(!result.items.length)fail('结果中没有知识条目');
  const id='offline:'+uid+':'+packageHash;
  const prior=(await list('ingestion')).find((j:R)=>j.id===id);if(prior)return json({kind:'knowledge',id,duplicate:true});
  const time=new Date().toISOString(),payload={sourceId:source.id,sourceKind:'library',name:source.name,fileKey:source.fileKey,hash:p.sourceSha256,sourceVersion:1,cacheKey:packageHash,pipeline:'codex-offline-v1',origin:'codex-offline',model:'Codex 预先整理（非本站模型调用）',blocks,batches:1,cursor:1,stage:'complete',items:result.items,omissions:result.omissions,links:[],checks:result.items.map((i:R)=>({itemId:i.id,supported:true,issues:['仅通过原文引文匹配；语义、条件、时效性及冲突未经独立模型复核，请人工核对。']})),conflicts:[],summary:'Codex 预先整理结果。程序仅验证引文位置；未执行在线模型复核或全库冲突检查。',events:[{name:'人工导入 Codex 预先整理结果',stage:'import',time}],usage:{input:0,output:0,total:0,reportedCalls:0,attempts:0},error:''};
  await env.DB.prepare('INSERT OR IGNORE INTO studio_records(id,kind,owner,state,revision,payload,created,updated) VALUES(?,?,?,?,1,?,?,?)').bind(id,'ingestion',uid,'succeeded',JSON.stringify(payload),time,time).run();
  return json({kind:'knowledge',id});
 }
 const t=await get(b!.taskId,'task');
 if(t.revision!==b!.revision||t.state==='running')fail('任务已变化，请刷新后重试',409);
 if((t.offlinePackages||[]).includes(packageHash))return json({kind:'draft',id:t.id,duplicate:true});
 if(!t.sourcesConfirmed||!t.selectedSourceIds?.length||!['research','review','check'].includes(t.stage))fail('请先新建 Brief 并确认 Sources，再导入草稿');
 if(t.draftVersion&&!t.offlineOrigin)fail('已有其他方式生成的正文，请另建任务导入');
 for(const field of ['keyword','platform','audience','writingRules','description'])if(String(p.brief?.[field]||'')!==String(t[field]||''))fail('Brief 与结果包不一致：'+field);
 for(const [field,max] of [['title',200],['markdown',60000],['outline',10000]] as const)if(typeof p[field]!=='string'||!p[field].trim()||p[field].length>max)fail('草稿字段无效：'+field);
 if(!Array.isArray(p.sources)||!p.sources.length||p.sources.length>20)fail('请选择1–20条有效来源');
 const docs=await list('document'),chunks=await list('chunk'),evidence:R[]=[];
 for(let i=0;i<p.sources.length;i++){
  const ref=p.sources[i];if(ref.ref!=='S'+(i+1))fail('来源编号必须依次为 S1、S2');
  const found=[];for(const k of chunks){const d=docs.find((d:R)=>d.id===k.docId);if(t.selectedSourceIds.includes(k.id)&&canUse(k,docs)&&k.external&&k.purpose!=='rule'&&d?.hash===ref.sourceSha256&&await hash(k.body)===ref.bodySha256)found.push({k,d});}
  if(found.length!==1)fail('来源已变化、未审核、未获引用许可或未在 Sources 中选择：'+ref.ref);
  const {k,d}=found[0];evidence.push({id:k.id,revision:k.revision,docId:k.docId,docRevision:k.docRevision,title:k.title,body:k.body,heading:k.heading,source:d.source,sourceVersion:d.sourceVersion||1,start:k.start,end:k.end,ref:ref.ref});
 }
 if(new Set(evidence.map(e=>e.id)).size!==evidence.length)fail('来源重复');
 citationCheck(p.markdown,evidence);citationCheck(p.outline,evidence);
 const rules=chunks.filter((k:R)=>canUse(k,docs)&&k.purpose!=='fact').map((k:R)=>({id:k.id,revision:k.revision,docId:k.docId,docRevision:k.docRevision,title:k.title,body:k.body,sourceVersion:docs.find((d:R)=>d.id===k.docId)?.sourceVersion||1}));
 if(rules.length>30)fail('有效写作规则超过30条，请缩小规则范围');
 const version=(t.draftVersion||0)+1,time=new Date().toISOString();
 const payload={...t,title:p.title,markdown:p.markdown,outline:p.outline,evidence,rules:[],draftVersion:version,stage:'review',offlineOrigin:'Codex 预先生成，未执行本站模型检查',offlinePackages:[...(t.offlinePackages||[]),packageHash],lastOfflineHash:packageHash,issues:[],missing:['草稿为 Codex 预先准备；来源时效、适用条件和事实仍需人工审核。'],checkSummary:'尚未执行在线模型检查，请人工核对正文与来源后再确认交付。',events:[...t.events,{name:'导入 Codex 预先生成草稿 V'+version,state:'complete',time}],error:''};
 payload.rules=rules;
 if(rules.length)payload.missing.push('已保留当前知识库写作规则快照，导入内容是否遵循这些规则需人工核对。');
 const history={taskId:t.id,draftVersion:version,title:p.title,markdown:p.markdown,outline:p.outline,evidence,rules,writingRules:t.writingRules||'',taskRevision:t.revision+1,offlineOrigin:payload.offlineOrigin};
 const results=await env.DB.batch([
  env.DB.prepare('UPDATE studio_records SET payload=?,state=?,revision=revision+1,updated=? WHERE id=? AND owner=? AND revision=?').bind(JSON.stringify(payload),'waiting',time,t.id,uid,t.revision),
  env.DB.prepare("INSERT OR IGNORE INTO studio_records(id,kind,owner,state,revision,payload,created,updated) SELECT ?,?,?,?,1,?,?,? WHERE EXISTS(SELECT 1 FROM studio_records WHERE id=? AND owner=? AND revision=? AND json_extract(payload,'$.lastOfflineHash')=?)").bind('draft:'+t.id+':'+version,'history',uid,'saved',JSON.stringify(history),time,time,t.id,uid,t.revision+1,packageHash)
 ]);
 if(results[0].meta.changes!==1)fail('任务已变化，请刷新后重试',409);
 return json({kind:'draft',id:t.id});
}
