import {rank} from './knowledge.mjs';
import {citationPriority} from './insights-policy.mjs';
import {convert} from 'html-to-text';
import {modelJSON,messages} from './agent.mjs';
import {publicReferenceURL,isPublicEvidence} from './usage-scope.mjs';
const normalized=text=>String(text||'').normalize('NFKC').toLowerCase().replace(/\s+/g,'');
export const originalURLs=material=>[material.originalReferenceURL,...String(material.body||'').matchAll(/https:\/\/[^\s<>"')\]]+/g)].filter(Boolean).map(value=>typeof value==='string'?value:value[0]).filter(Boolean).flatMap(value=>{try{return [publicReferenceURL(value)];}catch{return [];}});
export async function readPublicPage(value,fetcher=fetch){
 let url=publicReferenceURL(value);
 for(let redirects=0;redirects<4;redirects++){
  const response=await fetcher(url,{redirect:'manual',headers:{Accept:'text/html,text/plain'},signal:AbortSignal.timeout(12000)});
  if([301,302,303,307,308].includes(response.status)){const location=response.headers.get('location');if(!location)throw Error('公开来源跳转无效');url=publicReferenceURL(new URL(location,url).href);continue;}
  if(!response.ok||!/text\/(html|plain)|application\/xhtml\+xml/i.test(response.headers.get('content-type')||''))throw Error('公开来源无法匿名读取');
  if(Number(response.headers.get('content-length'))>1500000)throw Error('公开来源内容过大');
  const reader=response.body?.getReader();if(!reader)throw Error('公开来源为空');let bytes=0,html='';const decoder=new TextDecoder();try{while(true){const part=await reader.read();if(part.done)break;bytes+=part.value.length;if(bytes>1500000)throw Error('公开来源内容过大');html+=decoder.decode(part.value,{stream:true});}html+=decoder.decode();}finally{await reader.cancel();}
  const title=convert(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||new URL(url).hostname,{wordwrap:false});
  const body=convert(html,{wordwrap:false,selectors:[{selector:'a',options:{ignoreHref:true}},{selector:'img',format:'skip'},{selector:'script',format:'skip'},{selector:'style',format:'skip'}]});
  if(!body.trim())throw Error('公开来源正文为空');return {url,title,body};
 }
 throw Error('公开来源跳转次数过多');
}
// Public evidence is optional; unmatched writing materials remain usable without becoming citations.
export async function validatePublicReferences(materials,proposals,policy,{fetcher=fetch,libraryReferences=[]}={}){
 if(!Array.isArray(proposals)||proposals.length>20)throw Error('公开参考引用最多20条');
 const cache=new Map(),evidence=[],mappings=[],covered=new Set(),checks=[];
 for(const proposal of proposals){
  if(!proposal||typeof proposal.quote!=='string'||proposal.quote.trim().length<15||proposal.quote.length>8000||!Array.isArray(proposal.materialIds)||!proposal.materialIds.length)continue;
  const linked=materials.filter(m=>proposal.materialIds.includes(m.id));if(linked.length!==new Set(proposal.materialIds).size)throw Error('公开引用关联了不存在的写作素材');
  let url;try{url=publicReferenceURL(proposal.url);}catch{continue;}
  if(linked.some(m=>m.insightSourceId&&!isPublicEvidence(m)&&m.url===url)||libraryReferences.some(r=>r.insightSourceId&&!isPublicEvidence(r)&&r.url===url))continue;
  if(!policy.allowAlternativePublicSources&&linked.some(m=>m.usageScope==='reference'?m.referenceURL!==url:!originalURLs(m).includes(url)))continue;
  if(linked.some(m=>m.usageScope==='writing')&&!String(proposal.authorityReason||'').trim())continue;
  if(!cache.has(url))cache.set(url,readPublicPage(url,fetcher).catch(()=>null));const page=await cache.get(url);
  if(!page||!normalized(page.body).includes(normalized(proposal.quote))){checks.push({url,reason:'公开网页不可读取或原文不包含所引证据'});continue;}
  const known=libraryReferences.find(r=>r.id===proposal.referenceId&&r.referenceURL===url&&isPublicEvidence(r));
  const ref='S'+(evidence.length+1),snapshot={...(known||{}),id:known?.id||'public:'+ref,docId:known?.docId||null,title:page.title,body:proposal.quote.trim(),source:page.url,referenceURL:page.url,requestedURL:url,usageScope:'reference',canCite:true,publicVerifiedAt:new Date().toISOString(),externalPublic:!known||known.externalPublic===true,ref};
  evidence.push(snapshot);for(const material of linked){covered.add(material.id);mappings.push({materialId:material.id,reference:ref,authorityReason:String(proposal.authorityReason||''),referenceURL:page.url});}
 }
 return {evidence,mappings,checks,omitted:[],unreferenced:materials.filter(m=>!covered.has(m.id)).map(m=>({id:m.id,title:m.title,reason:'无对应公开引用，保留为写作素材，不列入参考资料'}))};
}
export async function resolvePublicEvidence(materials,catalog,policy,env){
 const publicSources=rank(materials.map(m=>[m.title,m.statement,m.body].filter(Boolean).join(' ').slice(0,4000)).join(' '),catalog.filter(isPublicEvidence),100).sort((a,b)=>citationPriority(a)-citationPriority(b)||b.score-a.score),proposals=[];
 for(const material of materials.filter(isPublicEvidence))proposals.push({referenceId:material.id,url:material.referenceURL,quote:String(material.originalBody||material.body||material.statement).replace(/!\[[^\]]*\]\([^)]*\)/g,'').replace(/^#{1,6}\s+/gm,'').replace(/\[([^\]]+)\]\([^)]*\)/g,'$1').replace(/\*\*|__/g,'').trim().slice(0,7000),materialIds:[material.id],authorityReason:'资料已标记为参考引用'});
 const internal=materials.filter(m=>!isPublicEvidence(m));
 if(internal.length&&publicSources.length){
  try{const result=await modelJSON(env,messages('研究策划 Agent',{materials:internal,publicSources,referencePolicy:policy},'{references:[{referenceId:string（必须来自publicSources）,url:string,quote:string（公开来源逐字原文，15–8000字符）,materialIds:string[],authorityReason:string（为何该公开来源能支撑素材中的同一事实）}]}；为所选素材匹配可核实的公开引用；先核对同一论点及适用条件，合适来源之间按citationPriority升序优先选用，数字越小越优先，同级比较直接相关性与时效，不能为优先级牺牲事实相关性；保留同一事实、地区、条件与时期；不得用相似主题代替事实核实。找不到引用就返回空references，不编造网址或引文；写作素材仍保留并可用于内容生产。'),4000);
  if(Array.isArray(result.references))for(const item of result.references){const reference=publicSources.find(s=>s.id===item.referenceId);if(reference&&item.url===reference.referenceURL&&normalized(reference.body).includes(normalized(item.quote)))proposals.push(item);}}catch{ /* Optional reference matching must not block use of writing materials. */ }
 }
 try{return await validatePublicReferences(materials,proposals.sort((a,b)=>citationPriority(publicSources.find(s=>s.id===a.referenceId))-citationPriority(publicSources.find(s=>s.id===b.referenceId))).slice(0,20),policy,{libraryReferences:catalog});}catch{return validatePublicReferences(materials,[],policy,{libraryReferences:catalog});}
}
