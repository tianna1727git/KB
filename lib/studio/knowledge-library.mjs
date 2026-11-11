import {sourceUsage} from './usage-scope.mjs';
import {retrieveKnowledge,knowledgeContext} from './retrieval.mjs';
import {temporalState} from './organization-policy.mjs';
import {canUse} from './knowledge.mjs';
import {relatedKnowledge} from './knowledge-model.mjs';
import {LIBRARY_CATEGORIES} from './library-categories.mjs';
export function withCurrentSourceCategories(documents,libraries=[],metadata=[]){
 const byId=new Map(libraries.map(source=>[source.id,source])),byHash=new Map(libraries.filter(source=>source.sha256).map(source=>[source.sha256,source])),bySource=new Map(metadata.map(entry=>[entry.sourceId,entry]));
 return documents.map(document=>{
  const source=byId.get(document.libraryId)||(document.hash&&byHash.get(document.hash));
  const current=bySource.get(source?.id)||bySource.get(document.id);
  return {...document,libraryCategory:current?.libraryCategory??source?.libraryCategory??document.libraryCategory??'',categoryRevision:current?.revision||0,sourceLibraryId:source?.id||document.familyId||document.id};
 });
}
export function describeKnowledge(items,documents){const docs=new Map(documents.map(d=>[d.id,d]));return items.filter(k=>k.state!=='excluded').map(k=>{const d=docs.get(k.docId),available=!!canUse(k,d?[d]:[]),waitingForSource=k.state==='approved'&&!!d&&d.state!=='ready'&&!d.disabled&&!d.supersededBy;return {...k,...sourceUsage(d),usageRevision:d?.usageRevision||0,temporal:temporalState(k),libraryCategory:d?(d.libraryCategory||'未分类'):(k.libraryCategory||'未分类'),sourceLibraryId:d?.sourceLibraryId||k.docId,available,waitingForSource,sourceName:d?.name||'来源缺失',source:d?.source||'',sourceVersion:d?.sourceVersion||1,sourceState:d?.state||'missing',availabilityReason:available?(sourceUsage(d).canCite?'参考引用':'写作素材'):k.state==='pending'?'待确认':waitingForSource?'切片已确认，来源尚待完成审核':'历史 / 停用'};});}
function categoryCounts(items){
 const counts=new Map();
 for(const item of items){const name=item.libraryCategory||'未分类';counts.set(name,(counts.get(name)||0)+1);}
 const order=name=>name==='未分类'?LIBRARY_CATEGORIES.length+1:LIBRARY_CATEGORIES.includes(name)?LIBRARY_CATEGORIES.indexOf(name):LIBRARY_CATEGORIES.length;
 return [...counts].map(([name,count])=>({name,count})).sort((a,b)=>order(a.name)-order(b.name)||a.name.localeCompare(b.name,'zh-CN'));
}
export function knowledgeLibraryPage(items,documents,options={}){
 const all=describeKnowledge(items,documents),q=String(options.q||'').trim().toLowerCase(),status=options.status||'all',type=options.type||'all',source=options.source||'all',category=String(options.category||'all'),directOnly=options.directOnly===true||options.directOnly==='true',page=Number(options.page??1),pageSize=Number(options.pageSize??20);
 if(q.length>500||category.length>200||!Number.isInteger(page)||page<1||!Number.isInteger(pageSize)||pageSize<1||pageSize>50||!['all','available','pending','review','history'].includes(status))throw Error('知识检索参数无效');
 const eligible=all.filter(k=>(source==='all'||k.docId===source)&&(status==='all'||status==='available'&&k.available||status==='pending'&&k.state==='pending'||status==='review'&&k.waitingForSource||status==='history'&&k.state==='approved'&&!k.available&&!k.waitingForSource)&&(type==='all'||k.type===type));
 const retrieval=retrieveKnowledge(q,eligible,documents);
 const visible=retrieval.items.filter(k=>!q||!directOnly||k.retrieval?.matchKind==='direct');
 const categories=categoryCounts(visible);
 const filtered=visible.filter(k=>category==='all'||k.libraryCategory===category);
 const pages=Math.max(1,Math.ceil(filtered.length/pageSize)),current=Math.min(page,pages);
 return {
  items:filtered.slice((current-1)*pageSize,current*pageSize).map(k=>({...k,related:relatedKnowledge(k,all)})),total:filtered.length,sourceCount:new Set(filtered.map(item=>item.sourceLibraryId||item.docId)).size,
  categories,libraryCategories:categoryCounts(all),
  retrieval:{directCount:retrieval.directCount,contextCount:retrieval.contextCount,terms:retrieval.terms,method:'关键词/别名与实体召回 + 一跳上下文扩展；非向量检索'},
  page:current,pages,pageSize,
  summary:{total:all.length,available:all.filter(k=>k.available).length,risk:all.filter(k=>k.state==='pending'&&k.risks?.length).length,waitingForSource:all.filter(k=>k.waitingForSource).length},
  safeIds:filtered.filter(k=>k.state==='pending'&&!k.risks?.length).slice(0,200).map(k=>k.id),
  sources:documents.filter(d=>all.some(k=>k.docId===d.id)).map(d=>({id:d.id,name:d.name,state:d.state}))
 };
}
export function knowledgeLibraryItem(id,items,documents){const all=describeKnowledge(items,documents),k=all.find(k=>k.id===id);return k?{...k,context:knowledgeContext(k,all,documents),related:relatedKnowledge(k,all)}:null;}
