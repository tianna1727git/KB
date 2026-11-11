import {PRODUCT_REGISTRY,resolveProducts,temporalState} from './organization-policy.mjs';
const ALIASES=[['拉美','拉丁美洲','latin america','latam'],['墨西哥','mexico'],['巴西','brazil'],['欧洲','europe'],['东南亚','southeast asia'],['亚马逊','amazon'],['美客多','mercado libre','mecado libre'],['派安盈','payoneer'],['收款','支付','回款'],['电商','ecommerce','e-commerce'],['跨境','出海','出口'],...PRODUCT_REGISTRY.map(product=>[product.name,...product.aliases])];
const normalize=value=>String(value||'').normalize('NFKC').toLowerCase().replace(/\s+/g,' ').trim();
const escape=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
function contains(text,term){return /^[a-z0-9][a-z0-9 -]*$/.test(term)?new RegExp('(^|[^a-z0-9])'+escape(term)+'([^a-z0-9]|$)','i').test(text):text.includes(term);}
export function queryConcepts(query){const q=normalize(query);if(!q)return [];if(/\.(pdf|md|markdown|docx?|xlsx?|pptx?|html?|txt)$/i.test(q))return [q];const concepts=[q],specificProduct=resolveProducts(query).length>0;for(const aliases of ALIASES)if(!(specificProduct&&aliases.includes('派安盈'))&&aliases.some(alias=>contains(q,normalize(alias))))concepts.push(...aliases.map(normalize));return [...new Set(concepts)].filter(Boolean);}
export function retrieveKnowledge(query,items,documents=[]){
 const terms=queryConcepts(query);if(!terms.length)return {items:[...items],total:items.length,directCount:items.length,contextCount:0,terms:[]};
 const docs=new Map(documents.map(doc=>[doc.id,doc])),byId=new Map(items.map(item=>[item.id,item])),byOriginal=new Map(items.filter(item=>item.sourceItemId).map(item=>[item.docId+':'+item.sourceItemId,item]));
 const index={process:new Map(),scenario:new Map(),research:new Map(),product:new Map()};const add=(map,key,item)=>{if(!key)return;const list=map.get(key)||[];list.push(item);map.set(key,list);};
 const matchedDocs=new Set();for(const doc of documents){const value=normalize((doc.name||'')+' '+(doc.markdown||''));if(terms.some(term=>contains(value,term)))matchedDocs.add(doc.id);}
 const hits=new Map();const addHit=(item,score,reason,direct=false)=>{const old=hits.get(item.id);if(old){old.score=Math.max(old.score,score);old.direct=old.direct||direct;if(!old.reasons.includes(reason))old.reasons.push(reason);}else hits.set(item.id,{item,score,direct,reasons:[reason]});};
 for(const item of items){
  const title=normalize(item.title),body=normalize(item.body||item.statement),tags=normalize([...(item.products||[]),...(item.platforms||[]),...(item.regions||[]),...(item.keywords||[]),item.organization?.scenario,item.organization?.researchTopic].filter(Boolean).join(' '));
  let score=0;for(const term of terms){if(contains(title,term))score+=50;if(contains(tags,term))score+=25;if(contains(body,term))score+=10;}
  if(score)addHit(item,score,'关键词/别名命中',true);else if(matchedDocs.has(item.docId))addHit(item,1,'命中资料内的关联上下文');
  add(index.process,item.processVersionId||item.flow?.processVersionId,item);add(index.scenario,item.scenarioId,item);add(index.research,item.researchTopicId,item);
  const products=item.productEntities?.filter(product=>product.status==='registered')||resolveProducts(title+' '+body+' '+tags);for(const product of products)add(index.product,product.id,item);
 }
 // One-hop expansion only: shared words do not imply causal or factual equivalence.
 const direct=[...hits.values()].filter(hit=>hit.direct).map(hit=>hit.item);
 for(const seed of direct){
  const process=seed.processVersionId||seed.flow?.processVersionId;for(const item of index.process.get(process)||[])addHit(item,4,'同一流程版本；分支与原步骤编号分别保留');
  for(const item of index.scenario.get(seed.scenarioId)||[])addHit(item,3,'共同操作场景（关联建议）');
  for(const item of index.research.get(seed.researchTopicId)||[])addHit(item,2,'共同研究主题（关联建议）');
  for(const link of seed.conditionLinks||[]){const target=byId.get(link.conditionItemId)||byOriginal.get(seed.docId+':'+link.conditionItemId);if(target&&target.docId===seed.docId)addHit(target,6,'原文支持的关联条件');}
  for(const key of ['previousSourceItemId','nextSourceItemId']){const target=byOriginal.get(seed.docId+':'+seed.flow?.[key]);if(target)addHit(target,5,'前后流程片段');}
 }
 for(const product of (/\.(pdf|md|markdown|docx?|xlsx?|pptx?|html?|txt)$/i.test(String(query))?[]:resolveProducts(query)))for(const item of index.product.get(product.id)||[])addHit(item,3,'同一已注册产品的跨分类资料（适用范围需核对）');
 const ranked=[...hits.values()].sort((a,b)=>Number(b.direct)-Number(a.direct)||b.score-a.score||String(a.item.id).localeCompare(String(b.item.id)));
 return {items:ranked.map(hit=>({...hit.item,retrieval:{score:hit.score,matchKind:hit.direct?'direct':'context',reasons:hit.reasons,temporal:temporalState(hit.item),libraryCategory:hit.item.libraryCategory||docs.get(hit.item.docId)?.libraryCategory||'未分类'}})),total:ranked.length,directCount:ranked.filter(hit=>hit.direct).length,contextCount:ranked.filter(hit=>!hit.direct).length,terms};
}
export function knowledgeContext(item,items,documents,budget=24000){
 const doc=documents.find(doc=>doc.id===item.docId);if(!doc)return null;const process=item.processVersionId||item.flow?.processVersionId;
 const siblings=items.filter(other=>other.docId===item.docId&&process&&(other.processVersionId||other.flow?.processVersionId)===process).sort((a,b)=>(a.start||0)-(b.start||0));
 const parentIds=new Set((item.sourceLocations||[]).map(location=>location.parentId).filter(Boolean));const blockIds=new Set((item.sourceLocations||[]).flatMap(location=>[location.blockId,location.previousBlockId,location.nextBlockId]).filter(Boolean));
 const segments=(doc.sourceSegments||[]).filter(segment=>parentIds.has(segment.parentId)||blockIds.has(segment.id));let size=0;const excerpts=[];
 for(const segment of segments){const text=doc.markdown?.slice(segment.start,segment.end)||'';if(size+text.length>budget)break;size+=text.length;excerpts.push({...segment,text});}
 return {sourceVersion:doc.sourceVersion||1,processVersionId:process||null,overviews:(doc.processOverviews||[]).filter(overview=>overview.processVersionId===process),steps:siblings.map(other=>({id:other.id,title:other.title,stepNumbers:other.organization?.stepNumbers||[],branch:other.organization?.branch||'',sequenceOrder:other.flow?.sequenceOrder||null})),segments:excerpts,totalSegments:segments.length,contextTruncated:excerpts.length<segments.length,notice:'上下文按原文位置排列。步骤分支和版本不能混合；共同实体仅表示相关，不代表事实等价。'};
}
