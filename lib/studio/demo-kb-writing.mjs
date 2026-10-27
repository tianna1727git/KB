import {searchDemoKnowledge} from './demo-kb.mjs';
import {citationCheck} from './knowledge.mjs';
import {messages} from './agent.mjs';
const hash=async v=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(v))))).map(n=>n.toString(16).padStart(2,'0')).join('');
const text=(v,max)=>{if(typeof v!=='string'||!v.trim()||v.length>max)throw Error('文本为空或超过上限');return v;};
const strings=v=>{if(!Array.isArray(v)||v.length>30||v.some(s=>typeof s!=='string'||s.length>1000))throw Error('列表格式无效');return v;};
function brief(b){return {keyword:text(b.keyword,200),platform:['官网','微信公众号','知乎','小红书'].includes(b.platform)?b.platform:'官网',audience:text(b.audience,300),description:text(b.description,3000),writingRules:String(b.writingRules||'').slice(0,5000)};}
const snap=(i,n)=>({id:i.id,ref:'S'+(n+1),revision:i.revision,docId:i.docId,docRevision:i.docRevision,title:i.title,body:i.body,source:i.sourceName,sourceName:i.sourceName,sourceId:i.sourceId,sourceHash:i.sourceHash,sourceVersion:i.sourceVersion,internalOnly:i.internalOnly,publicationRestricted:i.publicationRestricted,competitor:i.competitor,risks:i.risks,conditions:i.conditions});
export async function demoKBWritingAPI(req,env,ctx){const {get,save,create,json,fail,items,persistDraft,captureDraft,uid}=ctx;
 if(req.method!=='POST')fail('仅支持POST',405);const raw=await req.text();if(new TextEncoder().encode(raw).length>512*1024)fail('结果包最大512 KB');const b=JSON.parse(raw),action=new URL(req.url).pathname.split('/').pop();
 if(action==='demoKbCreateTask'){
  const info=brief(b),found=searchDemoKnowledge(info.keyword,items);if(!found.length)fail('知识库没有匹配内容，请调整主题');const evidence=found.map(snap);if(JSON.stringify(evidence).length>180000)fail('相关知识超出单次任务包上限，请缩小Brief主题；知识库仍可查看全部结果。');
  const payload={...info,demoFlow:true,demoKnowledgeMode:true,title:info.keyword+'写作任务',stage:'research',evidence,rules:[],queries:[info.keyword],sourceCount:found.length,outline:'',markdown:'',issues:[],missing:[],events:[],error:'',round:0,sourcesConfirmed:true,draftVersion:0};
  if(b.id){const t=await get(b.id,'task');if(!t.demoKnowledgeMode||t.revision!==b.revision)fail('任务已变化',409);await captureDraft(t);return json(await save(t,{...payload,draftVersion:t.draftVersion||0},'waiting'));}
  return json(await create('task',payload,'waiting'));
 }
 if(action==='demoKbExample'){
  const rid='demo-kb-example:'+uid+':v1';try{return json(await get(rid,'task'));}catch(e){if(e.code!==404)throw e;}
  const wanted=[['D025','仅支持企业资讯注册'],['D025','绑定必备 18 位'],['D082','场景一:没有Amazon.com'],['D127','实际汇率可能'],['D136','本方案目前仅面向']];
  const evidence=wanted.map(([sid,term])=>items.find(i=>i.sourceId===sid&&i.body.includes(term))).filter(Boolean).map(snap);if(evidence.length!==wanted.length)fail('示例所需知识尚未入库',503);
  const markdown=`进入拉美市场前，建议把国家、平台、账户主体和回款用途放在同一张准备清单中。本篇以现有知识库中的墨西哥收款场景为例，说明如何准备账户和核对适用条件。\n\n## 一、先确定平台、店铺类型与账户主体\n\n准备收款资料时，先写清楚自己经营的是哪个平台、哪个站点，以及账户注册主体。现有美客多墨西哥站教程明确：该绑定方案仅支持以企业信息注册的 Payoneer 账户，个人账户无法按该方案操作。不能把“支持墨西哥收款”理解成所有类型的账户均可直接绑定。[S1]\n\n建议先整理经营主体、店铺类型、拟使用的收款币种，以及后台要求的信息，再进入绑定步骤。\n\n## 二、收款配置要区分已有账户和首次注册\n\n亚马逊墨西哥站指南区分了两种情况：没有美国站账号时，资料给出的路径是先绑定 Payoneer USD 收款账户，审核通过后再绑定 MXN 收款账户；已有美国站账号时，则在激活墨西哥站后直接配置 MXN 收款账户。这些是该指南描述的不同场景，实际操作前仍需核对当前平台页面。[S3]\n\n美客多教程还要求准备18位CLABE账号、受益人完整名和银行地址，并从 Payoneer 后台复制相应信息。[S2] 应使用自己账户后台的信息，不照抄教程截图中的示例账号。\n\n## 三、把回款用途纳入经营准备\n\n回款后是否需要换汇、提现或支付采购款，应结合自己的经营需求安排。墨西哥收款账户资料明确提示，实际汇率会因市场波动、交易时间和客户情况而不同；资料中的价格比较不能变成每笔交易的固定承诺。[S4]\n\n如果还计划把回款用于1688跨境直采，要单独核对方案资格。现有资料写明，该方案目前仅面向符合条件的派安盈香港企业账户开放，不能直接推广到所有企业或个人账户。[S5]\n\n## 四、开始操作前的准备清单\n\n- 确定目标国家、平台和店铺类型。\n- 核对经营主体与拟使用账户是否满足方案条件。\n- 从本人账户后台取得银行信息，逐项核对受益人及账号字段。\n- 区分收款、换汇、提现和采购付款的需求。\n- 核实当前费用、适用规则和操作页面。\n\n本文依据库内资料展示准备思路。税务、清关要求、实时费用及现行平台规则仍需按具体国家和业务场景补充，不能从这些收款教程推导得出。`;
  const t={id:rid,...brief({keyword:'拉美跨境支付',platform:'官网',audience:'准备拓展拉美市场的中国跨境电商卖家',description:'说明墨西哥跨境收款准备、平台配置差异和主体条件，不编造费率或市场规模。',writingRules:'基于知识库，保留引用与限定条件'}),demoFlow:true,demoKnowledgeMode:true,demoExample:true,title:'拉美跨境支付入门：从平台账户到回款使用的准备清单',stage:'check',state:'waiting',revision:1,evidence,rules:[],queries:['拉美跨境支付'],outline:'## 平台与主体\n## 配置差异\n## 回款用途\n## 准备清单',markdown,draftVersion:1,issues:[],missing:['实时费用、现行平台要求及税务清关资料待补充'],round:0,events:[{name:'Codex根据demo知识库生成示例草稿',time:new Date().toISOString(),state:'complete'}],error:'',generatedBy:'Codex chat',offlineOrigin:'Codex离线生成的演示草稿，尚未完成文章检查'};
  citationCheck(markdown,evidence);const stamp=new Date().toISOString();
  await env.DB.batch([env.DB.prepare('INSERT OR IGNORE INTO studio_records(id,kind,owner,state,revision,payload,created,updated) VALUES(?,?,?,?,1,?,?,?)').bind(rid,'task',uid,'waiting',JSON.stringify(t),stamp,stamp),env.DB.prepare('INSERT OR IGNORE INTO studio_records(id,kind,owner,state,revision,payload,created,updated) VALUES(?,?,?,?,1,?,?,?)').bind('draft:'+rid+':1','history',uid,'saved',JSON.stringify({...t,taskId:rid,brief:{keyword:t.keyword,platform:t.platform,audience:t.audience,description:t.description,writingRules:t.writingRules}}),stamp,stamp)]);return json(await get(rid,'task'));
 }
 const t=await get(b.id,'task');if(!t.demoKnowledgeMode||t.revision!==b.revision||t.state==='running')fail('任务已变化',409);
 const valid=()=>t.evidence.every(s=>items.some(i=>i.id===s.id&&i.docId===s.docId&&i.revision===s.revision&&i.sourceHash===s.sourceHash));
 if(!valid())fail('Demo知识版本已变化，请重新提交Brief',409);
 if(action==='demoKbApproveOutline'){if(t.stage!=='outline')fail('请先准备大纲',409);return json(await save(t,{stage:'write',outlineApprovedAt:new Date().toISOString(),handoff:null},'waiting'));}
 if(action==='demoKbComplete'){if(t.stage!=='review'||b.confirmed!==true)fail('请先检查文章并确认交付',409);return json(await save(t,{stage:'done',approvedAt:new Date().toISOString()},'done'));}
 if(action==='demoKbRevise'){if(t.stage!=='review'||t.round>=2)fail('当前不能修改',409);return json(await save(t,{stage:'revise',handoff:null},'waiting'));}
 if(action==='demoKbRestart'){await captureDraft(t);return json(await save(t,{stage:'research',markdown:'',outline:'',issues:[],handoff:null,outlineApprovedAt:null},'waiting'));}
 if(action==='demoKbSaveTask'){
  if(b.outline!==undefined){if(t.stage!=='outline')fail('当前不能修改大纲');text(b.outline,10000);citationCheck(b.outline,t.evidence);return json(await save(t,{outline:b.outline,handoff:null,outlineApprovedAt:null},'waiting'));}
  if(!t.markdown||!['check','review','done'].includes(t.stage))fail('请先生成文章');text(b.markdown,60000);citationCheck(b.markdown,t.evidence);await captureDraft(t);return json(await persistDraft(t,{title:text(b.title,200),markdown:b.markdown,stage:'check',draftVersion:t.draftVersion+1,issues:[],handoff:null,error:''}));
 }
 if(!['research','write','revise','check'].includes(t.stage))fail('当前需要人工确认',409);
 if(t.stage==='write'&&!t.outlineApprovedAt)fail('请先确认大纲');
 const input={keyword:t.keyword,platform:t.platform,audience:t.audience,description:t.description,writingRules:t.writingRules,outline:t.outline,draft:t.markdown,evidence:t.evidence,rules:t.rules,issues:t.issues};const fingerprint=await hash(input);
 const schema=t.stage==='research'?{title:'string',intent:'string',queries:['string'],outline:'Markdown with [S1]',missing:['string']}:t.stage==='check'?{summary:'string',issues:[{severity:'high|medium|low',quote:'正文原句',reason:'string',suggestion:'string'}],missing:['string']}:{title:'string',markdown:'Markdown with [S1]',seoTitle:'string',metaDescription:'string',slug:'string',missing:['string']};
 if(action==='demoKbExport'){
  const token=crypto.randomUUID(),record=await save(t,{handoff:{token,fingerprint,stage:t.stage}},'waiting');const envelope={format:'payo-handoff-v1',kind:'task',id:t.id,revision:record.revision,stage:t.stage,token};
  return json({record,package:{...envelope,agent:t.stage==='research'?'研究策划 Agent':t.stage==='check'?'检查 Agent':'写作 Agent',instructions:'人工交给Codex执行，不调用付费模型API。依据Brief和给定知识生成；内部、竞品、未授权、历史或疑似错误的资料不得转换成无条件公开事实，信息不足列为missing。只填写resultTemplate.result并返回完整JSON。',input,prompt:messages('内容生产 Agent',input,JSON.stringify(schema)),outputSchema:schema,resultTemplate:{...envelope,result:{}}}});
 }
 if(action!=='demoKbImport')fail('接口不存在',404);
 if(b.format!=='payo-handoff-v1'||b.kind!=='task'||b.reviewed!==true||b.stage!==t.stage||!t.handoff||b.token!==t.handoff.token||fingerprint!==t.handoff.fingerprint)fail('结果包不匹配',409);
 const o=b.result;if(!o||typeof o!=='object')fail('结果格式无效');strings(o.missing);let update;
 if(t.stage==='research'){text(o.title,200);text(o.intent,3000);text(o.outline,10000);strings(o.queries);citationCheck(o.outline,t.evidence);update={title:o.title,intent:o.intent,outline:o.outline,queries:o.queries,missing:o.missing,stage:'outline'};}
 else if(t.stage==='check'){text(o.summary,3000);if(!Array.isArray(o.issues)||o.issues.length>50)fail('问题格式无效');for(const i of o.issues){if(!['high','medium','low'].includes(i.severity)||!t.markdown.includes(text(i.quote,60000)))fail('问题未定位到正文');text(i.reason,3000);text(i.suggestion,3000);}update={checkSummary:o.summary,issues:o.issues.map(({severity,quote,reason,suggestion})=>({severity,quote,reason,suggestion})),missing:o.missing,stage:'review'};}
 else {text(o.title,200);text(o.markdown,60000);citationCheck(o.markdown,t.evidence);for(const k of ['seoTitle','metaDescription','slug'])if(typeof o[k]!=='string'||o[k].length>1000)fail('SEO格式无效');await captureDraft(t);update={title:o.title,markdown:o.markdown,seoTitle:o.seoTitle,metaDescription:o.metaDescription,slug:o.slug,missing:o.missing,stage:'check',draftVersion:t.draftVersion+1,round:t.stage==='revise'?t.round+1:t.round,issues:[]};}
 update={...update,handoff:null,error:'',events:[...t.events,{name:'导入Codex '+t.stage+'结果',state:'complete',time:new Date().toISOString()}]};const result=update.draftVersion?await persistDraft(t,update):await save(t,update,'waiting');return json({record:result});
}
