import {canUse,rank} from './knowledge.mjs';
export function sourceDiagnostics(chunks,documents,topic,stamp=Date.now()){
 const reasons={pending:'知识尚未审核',source_missing:'找不到对应来源',source_pending:'来源尚未全部审核',disabled:'来源已停用',superseded:'来源已被新版替代',revision:'知识与来源修订不一致',future:'尚未到生效日期',expired:'已过有效期',internal:'仅限内部使用，未允许对外引用',rule:'属于写作规则，不作为事实 Sources'};
 const counts=new Map(),blocked=new Map(),eligible=[];
 for(const k of chunks.filter(k=>k.state!=='excluded')){
  const d=documents.find(d=>d.id===k.docId);let reason='';
  if(k.state!=='approved')reason='pending';else if(!d)reason='source_missing';else if(d.disabled)reason='disabled';else if(d.supersededBy)reason='superseded';else if(d.state!=='ready')reason='source_pending';else if(k.docRevision!==d.revision)reason='revision';else if(d.effective&&!(Date.parse(d.effective)<=stamp))reason='future';else if(d.expires&&!(Date.parse(d.expires)>stamp))reason='expired';else if(k.usageScope===undefined&&!k.external)reason='internal';else if(k.purpose==='rule')reason='rule';
  if(!reason&&canUse(k,documents,stamp)){eligible.push(k);continue;}
  reason=reason||'source_pending';counts.set(reason,(counts.get(reason)||0)+1);blocked.set(k.id,reason);
 }
 const related=rank(topic,chunks.filter(k=>blocked.has(k.id)),chunks.length),suggestions=[];
 for(const k of related){if(suggestions.some(s=>s.documentId===k.docId))continue;const d=documents.find(d=>d.id===k.docId);suggestions.push({documentId:d?.id||null,sourceName:d?.name||'来源不存在',knowledgeTitle:k.title,reason:reasons[blocked.get(k.id)]});if(suggestions.length===8)break;}
 return {total:chunks.filter(k=>k.state!=='excluded').length,eligible:eligible.length,excluded:[...counts].map(([key,count])=>({key,label:reasons[key],count})),suggestions};
}
