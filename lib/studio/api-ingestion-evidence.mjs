import {ingestionSchema,ingestionMessages} from './ingestion-agent.mjs';
// Only the API executor uses this protocol. Demo/manual handoffs retain their schemas.
export function evidenceAnchors(blocks){const anchors=[];for(const block of blocks){let n=0;const paragraphs=[...block.text.matchAll(/\S[\s\S]*?(?=\r?\n[ \t]*\r?\n|$)/g)];for(const paragraph of paragraphs){let cursor=0;while(cursor<paragraph[0].length){let end=Math.min(cursor+900,paragraph[0].length);if(end<paragraph[0].length){const line=paragraph[0].lastIndexOf('\n',end);if(line>cursor+250)end=line;}let quote=paragraph[0].slice(cursor,end).trim();cursor=end;if(!quote)continue;let at=block.text.indexOf(quote);if(block.text.indexOf(quote,at+1)>=0){quote=block.text.trim();at=block.text.indexOf(quote);}anchors.push({id:block.id+'-E'+(++n),blockId:block.id,quote,start:block.start+at,end:block.start+at+quote.length});}}}return anchors;}
const object=properties=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
const reference=ids=>object({anchorId:{type:'string',enum:ids}});
function requireAnchor(id,catalog){const a=catalog.find(a=>a.id===id);if(!a)throw Error('模型返回了不存在的证据编号，请重试当前步骤');return a;}
function exactEvidence(anchor){return {blockId:anchor.blockId,quote:anchor.quote};}
function catalog(items,prefix){return items.flatMap(item=>(item.evidence||[]).map((e,index)=>({...e,id:prefix+item.id+'-E'+(index+1),itemId:item.id})));}
const quotedFields=['prerequisites','conditions','toolInputs','toolOutputs','formulas'];
function organizationExcerpts(anchors){
 const excerpts=[];
 for(const anchor of anchors){
  for(const match of anchor.quote.matchAll(/[^。！？；\r\n]+[。！？；]?/gu)){
   const quote=match[0].trim();
   if(quote && quote.length<=1000 && !quote.startsWith('![')){
    excerpts.push({id:'Q'+(excerpts.length+1),anchorId:anchor.id,quote});
   }
  }
 }
 return excerpts;
}
export function apiEvidenceRequest(stage,data){const schema=ingestionSchema(stage,data);let input,hydrate,note;
 if(stage==='extract'){
  const anchors=evidenceAnchors(data.blocks);if(!anchors.length)throw Error('当前原文块没有可用文字证据');
  schema.properties.items.items.properties.evidence={type:'array',minItems:1,maxItems:12,items:reference(anchors.map(a=>a.id))};
  input={...data,blocks:data.blocks.map(({text,...b})=>b),evidenceAnchors:anchors};
  hydrate=raw=>({...raw,items:raw.items?.map(item=>({...item,evidence:item.evidence?.map(e=>e.anchorId===undefined?e:exactEvidence(requireAnchor(e.anchorId,anchors)))}))});
  note='证据协议：原文已按段落提供在 evidenceAnchors 中。evidence 每项只返回 {anchorId}，从给出的编号选择，不返回或抄写 quote。每个知识点选择1至12个编号；较长主张拆成可单独核验的知识点，无证据的原文块记录在omissions。引文必须覆盖 statement 的全部事实及条件。blocks 仅为原文块位置目录。不得把原文片段删改为新的证据。';

  const properties=schema.properties.items.items.properties;
  if(properties.organization){
   // The manual handoff schema is shared. Only modify this request's copy.
   properties.organization=structuredClone(properties.organization);
   const excerpts=organizationExcerpts(anchors);
   const byId=new Map(excerpts.map(q=>[q.id,q]));
   for(const field of quotedFields)properties.organization.properties[field]={type:'array',maxItems:20,items:{type:'string'}};
   input.organizationExcerpts=excerpts.map(({id,anchorId,quote})=>({id,anchorId,quote}));
   const hydrateEvidence=hydrate;
   hydrate=raw=>{
    const resolved=hydrateEvidence(raw);
    return {...resolved,items:resolved.items?.map((item,i)=>{
     if(!item.organization)return item;
     const selected=new Set(raw.items[i].evidence?.map(e=>e.anchorId));
     const organization={...item.organization};
     for(const field of quotedFields){
      if(!Array.isArray(organization[field]))throw Error('整理元数据列表无效');
      organization[field]=organization[field].map(id=>{
       const excerpt=byId.get(id);
       if(!excerpt || !selected.has(excerpt.anchorId))throw Error('条件引文编号未绑定当前切片：'+field+' '+String(id).slice(0,24));
       return excerpt.quote;
      });
     }
     return {...item,organization};
    })};
   };
   note+=' organization 的 prerequisites、conditions、toolInputs、toolOutputs、formulas 只填 organizationExcerpts 中的 Q 编号，必须同时在本条 evidence 选择其 anchorId。选完整且直接支持该字段的原句；找不到填空数组。不要填写自拟的条件文字。';
  }
 }else if(stage==='link'){
  const anchors=catalog(data.items,'C-');schema.properties.links.items.properties.evidence={type:'array',minItems:1,maxItems:12,items:reference(anchors.map(a=>a.id))};input={...data,evidenceAnchors:anchors};
  hydrate=raw=>({...raw,links:raw.links?.map(link=>({...link,evidence:link.evidence?.map(e=>{if(e.anchorId===undefined)return e;const a=requireAnchor(e.anchorId,anchors);if(a.itemId!==link.conditionItemId)throw Error('条件证据编号不属于被关联的条件条目');return exactEvidence(a);})}))});
  note='证据协议：links 的 evidence 每项仅返回 {anchorId}，从 evidenceAnchors 中选择1至12个属于 conditionItemId 的编号，不返回 quote。系统将从原文填回引文。编号选择不代表关联一定成立，仍需有明确适用关系。';
 }else{
  const current=catalog(data.items,'A-');const existing=(data.existing||[]).flatMap(item=>item.body?[{id:'X-'+item.id,itemId:item.id,quote:item.body}]:[]);const other=[...current,...existing];
  schema.properties.conflicts.items=object({itemId:{type:'string'},otherId:{type:'string'},reason:{type:'string'},currentAnchorId:{type:'string',enum:current.map(a=>a.id)},otherAnchorId:{type:'string',enum:other.map(a=>a.id)}});
  input={...data,conflictAnchors:other};hydrate=raw=>({...raw,conflicts:raw.conflicts?.map(c=>{if(c.currentAnchorId===undefined&&c.otherAnchorId===undefined)return c;const a=requireAnchor(c.currentAnchorId,current),b=requireAnchor(c.otherAnchorId,other);if(a.itemId!==c.itemId||b.itemId!==c.otherId)throw Error('冲突证据编号与对比条目不一致');return {itemId:c.itemId,otherId:c.otherId,reason:c.reason,currentQuote:a.quote,otherQuote:b.quote};})});
  note='证据协议：conflicts 用 currentAnchorId、otherAnchorId 选择 conflictAnchors 中对应 itemId、otherId 的原文证据，不抄写 currentQuote 或 otherQuote；系统会填回原文。继续逐项检查支持程度、数字、主体和条件，不因编号有效而判定事实正确。';
 }
 const messages=ingestionMessages(stage,input);messages[0].content+=' 本次使用 source-anchors-v1，以下引用方式取代上述逐字抄写要求：'+note;
 return {schema,messages,hydrate};
}
