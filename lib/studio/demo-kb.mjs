import seed from './demo-kb-data.json' with {type:'json'};
import {rank} from './knowledge.mjs';
export const demoKBVersion=seed.version;
export const demoKBRules={
 extraction:['覆盖160份Markdown；按标题上下文和正文段落提取，保留原文，不补写图片、视频或链接中不存在的事实。','每条知识保存来源ID、文件名、SHA256、原文字符位置、类型和实体标签。','当前3494条为原文知识条目；分类与关联为建议，不代表逐条语义复核完成。'],
 storage:['Demo直接存入独立demoKnowledge记录，无结果确认或人工审核步骤。','按登录账号隔离，来源ID和数据集版本组成稳定记录键；重复初始化不会覆盖已有记录。','不改动正式document、chunk或历史文章，不把demo入库状态等同于正式审核或公开引用授权。','15份没有完整正文的资料保留来源清单，不编造知识；内部、竞品、历史活动和发布限制保留标签。'],
 relations:['来源关联：同一sourceId下的知识属于同一资料，可按章节回看。','条件关联：332条原整理候选用知识ID连接，保留候选标记；同章出现不代表已经证明适用关系。','重复关联：正文去空白及HTML标签后相同的条目互相连接，保留各自来源，不直接合并版本。','实体关联：同产品、同平台或同地区提供相关知识建议；共同实体不代表因果、等价或适用关系。','风险关联：重点复核问题连接相应来源及证据；保留差异，不自动裁决哪一方正确。'],
 search:['全文、标题、来源名和实体标签检索，支持拉美/拉丁美洲、国家和支付相关表达扩展。','复合主题按范围组合匹配：拉美跨境支付要求同时满足拉美范围及支付场景；只写跨境不自动命中全部资料。','返回全部匹配条目并分页，无前60条截断；关联建议在详情独立展示。'],
 writing:['Brief触发知识检索，使用本次命中知识快照并保留来源编号、修订与风险标签。','超过单次Codex任务包上下文上限时提示缩小主题，不静默截断。','网站仅导出任务包并导入Codex结果，不消耗OpenAI API额度；Codex额度由用户自己的Codex会话使用。','研究大纲、写作、检查与草稿历史保留；来源限制和待核实数字不得变成无条件的公开事实。']};
const regions=[['拉美','拉丁美洲','latam','latin america','墨西哥','巴西','阿根廷','哥伦比亚','智利','秘鲁'],['墨西哥','mexico','mxn'],['巴西','brazil','brl'],['印尼','indonesia','idr'],['欧洲','欧元','eur','英国','gbp']];
const payments=/支付|收款|付款|提现|提款|汇率|换汇|结汇|结算|电汇|swift|clabe|payment|receiving/i;
const paymentQuery=/支付|收款|付款|提现|汇率|换汇|结汇|结算|电汇|payment/i;
export function searchDemoKnowledge(query,items){
 const q=String(query||'').trim();if(!q)return items.map(i=>({...i,score:0}));
 const selected=/拉美|拉丁美洲|latam|latin america/i.test(q)?regions[0]:regions.slice(1).find(g=>g.some(w=>q.toLowerCase().includes(w)));
 const wantsPayment=paymentQuery.test(q);
 const matches=items.filter(i=>{const scope=[i.title,i.body,...i.regions||[],i.sourceName].join(' ');return (!selected||selected.some(w=>scope.toLowerCase().includes(w)))&&(!wantsPayment||payments.test(i.title+' '+i.body+' '+(i.products||[]).join(' ')));});
 if(selected||wantsPayment){const scores=new Map(rank(q,matches,matches.length).map(i=>[i.id,i.score]));return matches.map(i=>({...i,score:scores.get(i.id)||0})).sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id));}
 return rank(q,items,items.length);
}
export function flattenDemoRecords(records){return records.flatMap(d=>(d.items||[]).map(i=>({...i,docId:d.id,revision:d.revision,docRevision:d.revision,sourceId:d.sourceId,sourceName:d.name,sourceHash:d.hash,sourceVersion:d.sourceVersion,internalOnly:d.internalOnly,publicationRestricted:d.publicationRestricted,competitor:d.competitor,sourceIssues:d.issues})));}
export function demoRelations(item,items){const ids=new Map(items.map(i=>[i.id,i]));const list=(type,rows,reason)=>({type,total:rows.length,items:rows.slice(0,30).map(i=>({id:i.id,title:i.title,sourceName:i.sourceName,reason}))});return [list('同一来源',items.filter(i=>i.id!==item.id&&i.sourceId===item.sourceId),'同一资料'),list('条件候选',(item.conditions||[]).map(id=>ids.get(id)).filter(Boolean),'候选关联，未证明适用'),list('重复内容',(item.duplicates||[]).map(id=>ids.get(id)).filter(Boolean),'正文一致，来源独立'),list('共同实体',items.filter(i=>i.id!==item.id&&i.sourceId!==item.sourceId&&['products','platforms','regions'].some(k=>(item[k]||[]).some(v=>(i[k]||[]).includes(v)))),'共同实体，不代表因果或等价')];}
export async function demoKBAPI(req,env,ctx){const {uid,email,list,get,save,create,fail,json}=ctx;const action=new URL(req.url).pathname.split('/').pop(),url=new URL(req.url);
 if(action==='demoKbInit'){
  if(req.method!=='POST')fail('仅支持POST',405);if(email.toLowerCase()!=='tianna1727@gmail.com')fail('无权初始化演示资料',403);
  const b=await req.json(),offset=Number(b.offset||0);if(!Number.isInteger(offset)||offset<0||offset>160)fail('批次无效');const stamp=new Date().toISOString();
  const batch=seed.documents.slice(offset,offset+20);await env.DB.batch(batch.map(d=>env.DB.prepare('INSERT OR IGNORE INTO studio_records(id,kind,owner,state,revision,payload,created,updated) VALUES(?,?,?,?,1,?,?,?)').bind('demo-kb:'+seed.version+':'+uid+':'+d.id,'demoKnowledge',uid,'demo_ready',JSON.stringify({...d,id:undefined,sourceId:d.id,datasetVersion:seed.version}),stamp,stamp)));
  return json({next:Math.min(offset+20,160),total:160});
 }
 const records=(await list('demoKnowledge')).filter(d=>d.datasetVersion===seed.version),items=flattenDemoRecords(records);
 if(req.method==='GET'&&action==='demoKb'){
  const q=String(url.searchParams.get('q')||'').trim();if(q.length>500)fail('检索词最多500字');const page=Math.max(1,Number(url.searchParams.get('page')||1));if(!Number.isInteger(page))fail('页码无效');const found=searchDemoKnowledge(q,items),size=20;
  return json({version:seed.version,sourceCount:records.length,knowledgeCount:items.length,total:found.length,page,pages:Math.max(1,Math.ceil(found.length/size)),items:found.slice((page-1)*size,page*size).map(({body,evidence,...i})=>({...i,excerpt:body.slice(0,600)})),rules:demoKBRules,stats:seed.stats});
 }
 if(req.method==='GET'&&action==='demoKbItem'){const item=items.find(i=>i.id===url.searchParams.get('id'));if(!item)fail('知识不存在',404);return json({...item,evidence:item.evidence.map(e=>({...e,quote:item.body})),relations:demoRelations(item,items),conflicts:seed.conflicts.filter(c=>c.evidence.some(e=>e.sourceId===item.sourceId))});}
 // The article adapter reuses the original task/history storage; formal knowledge APIs stay unchanged.
 if(action.startsWith('demoKb')){const {demoKBWritingAPI}=await import('./demo-kb-writing.mjs');return demoKBWritingAPI(req,env,{...ctx,items,json,seedVersion:seed.version});}
 fail('接口不存在',404);
}
